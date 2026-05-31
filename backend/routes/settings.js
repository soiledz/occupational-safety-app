const express = require('express');
const { dbGet, dbAll, dbRun } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

async function recalculateNextDates(hospitalId, category) {
  const settings = await dbGet('SELECT months_period FROM periodicity_settings WHERE hospital_id = ? AND category = ?', [hospitalId, category]);
  if (!settings) return;

  const records = await dbAll(`
    SELECT cr.id, cr.last_date FROM control_records cr
    LEFT JOIN employees e ON cr.employee_id = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    WHERE (d.hospital_id = ? OR cr.employee_id IS NULL) AND cr.category = ?
  `, [hospitalId, category]);

  for (const record of records) {
    if (record.last_date) {
      const lastDate = new Date(record.last_date);
      const nextDate = new Date(lastDate);
      nextDate.setMonth(nextDate.getMonth() + settings.months_period);
      await dbRun('UPDATE control_records SET next_date = ? WHERE id = ?', [nextDate.toISOString().split('T')[0], record.id]);
    }
  }
}

router.get('/', authenticateToken, async (req, res) => {
  const { hospital_id, role } = req.user;
  try {
    let query, params;
    if (role === 'superadmin') {
      query = 'SELECT ps.*, h.name as hospital_name FROM periodicity_settings ps JOIN hospitals h ON ps.hospital_id = h.id';
      params = [];
    } else {
      query = 'SELECT * FROM periodicity_settings WHERE hospital_id = ?';
      params = [hospital_id];
    }
    const settings = await dbAll(query, params);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticateToken, requireRole('superadmin', 'hospital_manager'), async (req, res) => {
  const { hospital_id, role } = req.user;
  const { category, months_period } = req.body;

  if (!category || !months_period) {
    return res.status(400).json({ error: 'category and months_period are required' });
  }

  const targetHospitalId = role === 'superadmin' ? (req.body.hospital_id || hospital_id) : hospital_id;
  if (!targetHospitalId) return res.status(400).json({ error: 'hospital_id is required' });

  try {
    const existing = await dbGet('SELECT id FROM periodicity_settings WHERE hospital_id = ? AND category = ?', [targetHospitalId, category]);
    if (existing) {
      await dbRun('UPDATE periodicity_settings SET months_period = ? WHERE id = ?', [months_period, existing.id]);
    } else {
      await dbRun('INSERT INTO periodicity_settings (hospital_id, category, months_period) VALUES (?, ?, ?)', [targetHospitalId, category, months_period]);
    }

    await recalculateNextDates(targetHospitalId, category);

    const updated = await dbGet(
      'SELECT ps.*, h.name as hospital_name FROM periodicity_settings ps JOIN hospitals h ON ps.hospital_id = h.id WHERE ps.hospital_id = ? AND ps.category = ?',
      [targetHospitalId, category]
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
