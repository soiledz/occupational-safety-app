const express = require('express');
const { dbGet, dbAll, dbRun } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  const { hospital_id, role } = req.user;
  const { category, department_id } = req.query;

  try {
    let query = `
      SELECT cr.id, cr.employee_id, cr.object_name, cr.category, cr.last_date, cr.next_date,
        e.full_name as employee_name, e.position, d.id as department_id, d.name as department_name,
        h.id as hospital_id, h.name as hospital_name
      FROM control_records cr
      LEFT JOIN employees e ON cr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN hospitals h ON d.hospital_id = h.id
      WHERE 1=1
    `;
    let params = [];

    if (role !== 'superadmin') {
      query += ' AND (h.id = ? OR cr.employee_id IS NULL)';
      params.push(hospital_id);
    }
    if (category) {
      query += ' AND cr.category = ?';
      params.push(category);
    }
    if (department_id) {
      query += ' AND d.id = ?';
      params.push(department_id);
    }
    query += ' ORDER BY cr.next_date ASC';

    const records = await dbAll(query, params);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  const { hospital_id, role } = req.user;
  const { employee_id, object_name, category, last_date } = req.body;

  if (!category) return res.status(400).json({ error: 'category is required' });
  if (category === 'extinguisher' && !object_name) return res.status(400).json({ error: 'object_name is required for extinguisher records' });
  if (category !== 'extinguisher' && !employee_id) return res.status(400).json({ error: 'employee_id is required for non-extinguisher records' });

  try {
    if (employee_id && role !== 'superadmin') {
      const emp = await dbGet('SELECT e.* FROM employees e JOIN departments d ON e.department_id = d.id WHERE e.id = ? AND d.hospital_id = ?', [employee_id, hospital_id]);
      if (!emp) return res.status(403).json({ error: 'Employee not found or access denied' });
    }

    let targetHospitalId = hospital_id;
    if (employee_id) {
      const empData = await dbGet('SELECT d.hospital_id FROM employees e JOIN departments d ON e.department_id = d.id WHERE e.id = ?', [employee_id]);
      if (empData) targetHospitalId = empData.hospital_id;
    }

    const settings = await dbGet('SELECT months_period FROM periodicity_settings WHERE hospital_id = ? AND category = ?', [targetHospitalId, category]);
    const months = settings ? settings.months_period : 12;

    let nextDate = null;
    if (last_date) {
      const ld = new Date(last_date);
      const nd = new Date(ld);
      nd.setMonth(nd.getMonth() + months);
      nextDate = nd.toISOString().split('T')[0];
    }

    const result = await dbRun(
      'INSERT INTO control_records (employee_id, object_name, category, last_date, next_date) VALUES (?, ?, ?, ?, ?)',
      [employee_id || null, object_name || null, category, last_date || null, nextDate]
    );

    const newRecord = await dbGet(`
      SELECT cr.id, cr.employee_id, cr.object_name, cr.category, cr.last_date, cr.next_date,
        e.full_name as employee_name, e.position, d.id as department_id, d.name as department_name
      FROM control_records cr
      LEFT JOIN employees e ON cr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE cr.id = ?
    `, [result.lastID]);

    res.status(201).json(newRecord);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  const { hospital_id, role } = req.user;
  const { id } = req.params;
  const { employee_id, object_name, category, last_date } = req.body;

  try {
    const record = await dbGet(`
      SELECT cr.*, d.hospital_id as record_hospital_id FROM control_records cr
      LEFT JOIN employees e ON cr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE cr.id = ?
    `, [id]);

    if (!record) return res.status(404).json({ error: 'Record not found' });
    if (role !== 'superadmin' && record.record_hospital_id !== hospital_id) return res.status(403).json({ error: 'Access denied' });

    let targetCategory = category || record.category;
    let targetHospitalId = record.record_hospital_id || hospital_id;
    if (employee_id) {
      const empData = await dbGet('SELECT d.hospital_id FROM employees e JOIN departments d ON e.department_id = d.id WHERE e.id = ?', [employee_id]);
      if (empData) targetHospitalId = empData.hospital_id;
    }

    const settings = await dbGet('SELECT months_period FROM periodicity_settings WHERE hospital_id = ? AND category = ?', [targetHospitalId, targetCategory]);
    const months = settings ? settings.months_period : 12;

    const newLastDate = last_date !== undefined ? last_date : record.last_date;
    let nextDate = record.next_date;
    if (newLastDate) {
      const ld = new Date(newLastDate);
      const nd = new Date(ld);
      nd.setMonth(nd.getMonth() + months);
      nextDate = nd.toISOString().split('T')[0];
    }

    await dbRun(`
      UPDATE control_records SET employee_id = ?, object_name = ?, category = ?, last_date = ?, next_date = ?
      WHERE id = ?
    `, [
      employee_id !== undefined ? employee_id : record.employee_id,
      object_name !== undefined ? object_name : record.object_name,
      category || record.category,
      newLastDate,
      nextDate,
      id
    ]);

    const updated = await dbGet(`
      SELECT cr.id, cr.employee_id, cr.object_name, cr.category, cr.last_date, cr.next_date,
        e.full_name as employee_name, e.position, d.id as department_id, d.name as department_name
      FROM control_records cr
      LEFT JOIN employees e ON cr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE cr.id = ?
    `, [id]);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/complete', authenticateToken, async (req, res) => {
  const { hospital_id, role } = req.user;
  const { id } = req.params;

  try {
    const record = await dbGet(`
      SELECT cr.*, d.hospital_id as record_hospital_id FROM control_records cr
      LEFT JOIN employees e ON cr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE cr.id = ?
    `, [id]);

    if (!record) return res.status(404).json({ error: 'Record not found' });
    if (role !== 'superadmin' && record.record_hospital_id !== hospital_id) return res.status(403).json({ error: 'Access denied' });

    const today = new Date().toISOString().split('T')[0];
    const targetHospitalId = record.record_hospital_id || hospital_id;
    const settings = await dbGet('SELECT months_period FROM periodicity_settings WHERE hospital_id = ? AND category = ?', [targetHospitalId, record.category]);
    const months = settings ? settings.months_period : 12;

    const todayDate = new Date(today);
    const nextDate = new Date(todayDate);
    nextDate.setMonth(nextDate.getMonth() + months);
    const nextDateStr = nextDate.toISOString().split('T')[0];

    await dbRun('UPDATE control_records SET last_date = ?, next_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [today, nextDateStr, id]);

    const updated = await dbGet(`
      SELECT cr.id, cr.employee_id, cr.object_name, cr.category, cr.last_date, cr.next_date,
        e.full_name as employee_name, e.position, d.id as department_id, d.name as department_name
      FROM control_records cr
      LEFT JOIN employees e ON cr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE cr.id = ?
    `, [id]);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  const { hospital_id, role } = req.user;
  const { id } = req.params;

  try {
    const record = await dbGet(`
      SELECT cr.*, d.hospital_id as record_hospital_id FROM control_records cr
      LEFT JOIN employees e ON cr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE cr.id = ?
    `, [id]);

    if (!record) return res.status(404).json({ error: 'Record not found' });
    if (role !== 'superadmin' && record.record_hospital_id !== hospital_id) return res.status(403).json({ error: 'Access denied' });

    await dbRun('DELETE FROM control_records WHERE id = ?', [id]);
    res.json({ message: 'Record deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
