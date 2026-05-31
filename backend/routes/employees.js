const express = require('express');
const { dbGet, dbAll, dbRun } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  const { hospital_id, role } = req.user;
  try {
    let query, params;
    if (role === 'superadmin') {
      query = `SELECT e.id, e.full_name, e.position, d.id as department_id, d.name as department_name, h.id as hospital_id, h.name as hospital_name
        FROM employees e JOIN departments d ON e.department_id = d.id JOIN hospitals h ON d.hospital_id = h.id ORDER BY e.full_name`;
      params = [];
    } else {
      query = `SELECT e.id, e.full_name, e.position, d.id as department_id, d.name as department_name
        FROM employees e JOIN departments d ON e.department_id = d.id WHERE d.hospital_id = ? ORDER BY e.full_name`;
      params = [hospital_id];
    }
    const employees = await dbAll(query, params);
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  const { hospital_id, role } = req.user;
  const { full_name, position, department_id } = req.body;

  if (!full_name || !position || !department_id) {
    return res.status(400).json({ error: 'full_name, position, and department_id are required' });
  }

  try {
    if (role !== 'superadmin') {
      const dept = await dbGet('SELECT * FROM departments WHERE id = ? AND hospital_id = ?', [department_id, hospital_id]);
      if (!dept) return res.status(403).json({ error: 'Department not found or access denied' });
    }

    const result = await dbRun('INSERT INTO employees (department_id, full_name, position) VALUES (?, ?, ?)', [department_id, full_name, position]);
    const newEmployee = await dbGet(
      'SELECT e.id, e.full_name, e.position, d.name as department_name FROM employees e JOIN departments d ON e.department_id = d.id WHERE e.id = ?',
      [result.lastID]
    );
    res.status(201).json(newEmployee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  const { hospital_id, role } = req.user;
  const { id } = req.params;
  const { full_name, position, department_id } = req.body;

  try {
    const employee = await dbGet('SELECT e.*, d.hospital_id FROM employees e JOIN departments d ON e.department_id = d.id WHERE e.id = ?', [id]);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    if (role !== 'superadmin' && employee.hospital_id !== hospital_id) return res.status(403).json({ error: 'Access denied' });

    await dbRun('UPDATE employees SET full_name = ?, position = ?, department_id = ? WHERE id = ?',
      [full_name || employee.full_name, position || employee.position, department_id || employee.department_id, id]);

    const updated = await dbGet(
      'SELECT e.id, e.full_name, e.position, d.name as department_name FROM employees e JOIN departments d ON e.department_id = d.id WHERE e.id = ?',
      [id]
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  const { hospital_id, role } = req.user;
  const { id } = req.params;

  try {
    const employee = await dbGet('SELECT e.*, d.hospital_id FROM employees e JOIN departments d ON e.department_id = d.id WHERE e.id = ?', [id]);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    if (role !== 'superadmin' && employee.hospital_id !== hospital_id) return res.status(403).json({ error: 'Access denied' });

    await dbRun('DELETE FROM employees WHERE id = ?', [id]);
    res.json({ message: 'Employee deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
