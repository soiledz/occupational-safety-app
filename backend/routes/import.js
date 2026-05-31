const express = require('express');
const xlsx = require('xlsx');
const { dbGet, dbAll, dbRun } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/employees', authenticateToken, requireRole('superadmin', 'hospital_manager'), async (req, res) => {
  const { hospital_id, role } = req.user;
  const { data } = req.body;

  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'No data provided' });
  }

  let targetHospitalId;
  if (role === 'superadmin') {
    targetHospitalId = req.body.hospital_id || hospital_id;
  } else {
    targetHospitalId = hospital_id;
  }

  if (!targetHospitalId) {
    return res.status(400).json({ error: 'hospital_id is required. For superadmin, provide hospital_id in request body.' });
  }

  const hospital = await dbGet('SELECT id FROM hospitals WHERE id = ?', [targetHospitalId]);
  if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

  const results = { imported: 0, errors: [], createdDepartments: [] };

  try {
    for (const row of data) {
      const fullName = row['ПІБ'] || row['ПІБ'] || row['ФИО'] || row['full_name'];
      const position = row['Посада'] || row['Посада'] || row['Должность'] || row['position'];
      const deptName = row['Відділення'] || row['Відділення'] || row['Отделение'] || row['department'];

      if (!fullName || !position || !deptName) {
        results.errors.push({ row, reason: 'Missing required fields (ПІБ, Посада, Відділення)' });
        continue;
      }

      // Get or create department
      let dept = await dbGet('SELECT id FROM departments WHERE hospital_id = ? AND name = ?', [targetHospitalId, deptName.trim()]);
      let deptId;
      if (!dept) {
        const result = await dbRun('INSERT INTO departments (hospital_id, name) VALUES (?, ?)', [targetHospitalId, deptName.trim()]);
        deptId = result.lastID;
        results.createdDepartments.push(deptName.trim());
      } else {
        deptId = dept.id;
      }

      await dbRun('INSERT INTO employees (department_id, full_name, position) VALUES (?, ?, ?)', 
        [deptId, fullName.trim(), position.trim()]);
      results.imported++;
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message, results });
  }
});

router.post('/records', authenticateToken, requireRole('superadmin', 'hospital_manager'), async (req, res) => {
  const { hospital_id, role } = req.user;
  const { data } = req.body;

  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'No data provided' });
  }

  let targetHospitalId;
  if (role === 'superadmin') {
    targetHospitalId = req.body.hospital_id || hospital_id;
  } else {
    targetHospitalId = hospital_id;
  }

  const results = { imported: 0, errors: [] };

  try {
    for (const row of data) {
      const fullName = row['ПІБ'] || row['full_name'];
      const objectName = row["Об'єкт"] || row["object_name"];
      const categoryRaw = row['Категорія'] || row['Категория'] || row['category'];
      const lastDate = row['Остання дата'] || row['Дата'] || row['last_date'];

      let category = null;
      const catLower = (categoryRaw || '').toLowerCase().trim();
      if (catLower.includes('інструктаж') || catLower.includes('instruction')) category = 'instruction';
      else if (catLower.includes('мед') || catLower.includes('medical')) category = 'medical';
      else if (catLower.includes('вогне') || catLower.includes('extinguisher') || catLower.includes('огнетуш')) category = 'extinguisher';

      if (!category) {
        results.errors.push({ row, reason: 'Unknown category. Use: інструктаж, медогляд, вогнегасник' });
        continue;
      }

      let employeeId = null;
      if (category !== 'extinguisher') {
        if (!fullName) {
          results.errors.push({ row, reason: 'ПІБ is required for non-extinguisher records' });
          continue;
        }
        const employee = await dbGet(`
          SELECT e.id FROM employees e
          JOIN departments d ON e.department_id = d.id
          WHERE d.hospital_id = ? AND e.full_name = ?
        `, [targetHospitalId, fullName.trim()]);

        if (!employee) {
          results.errors.push({ row, reason: `Employee not found: ${fullName}` });
          continue;
        }
        employeeId = employee.id;
      } else {
        if (!objectName) {
          results.errors.push({ row, reason: 'object_name is required for extinguisher records' });
          continue;
        }
      }

      const settings = await dbGet('SELECT months_period FROM periodicity_settings WHERE hospital_id = ? AND category = ?', [targetHospitalId, category]);
      const months = settings ? settings.months_period : 12;

      let nextDate = null;
      if (lastDate) {
        const ld = new Date(lastDate);
        const nd = new Date(ld);
        nd.setMonth(nd.getMonth() + months);
        nextDate = nd.toISOString().split('T')[0];
      }

      await dbRun(
        'INSERT INTO control_records (employee_id, object_name, category, last_date, next_date) VALUES (?, ?, ?, ?, ?)',
        [employeeId, objectName || null, category, lastDate || null, nextDate]
      );
      results.imported++;
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message, results });
  }
});

router.get('/template/:type', authenticateToken, (req, res) => {
  const { type } = req.params;

  let headers, sampleData;
  if (type === 'employees') {
    headers = ['ПІБ', 'Посада', 'Відділення'];
    sampleData = [
      ['Іваненко Іван Іванович', 'Лікар-хірург', 'Хірургічне відділення'],
      ['Петренко Петро Петрович', 'Медсестра', 'Терапевтичне відділення'],
    ];
  } else if (type === 'records') {
    headers = ['ПІБ', 'Об\'єкт', 'Категорія', 'Остання дата'];
    sampleData = [
      ['Іваненко Іван Іванович', '', 'інструктаж', '2025-05-15'],
      ['Петренко Петро Петрович', '', 'медогляд', '2025-03-20'],
      ['', 'Вогнегасник №12', 'вогнегасник', '2025-01-10'],
    ];
  } else {
    return res.status(400).json({ error: 'Invalid template type. Use: employees or records' });
  }

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([headers, ...sampleData]);
  xlsx.utils.book_append_sheet(wb, ws, 'Template');

  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xls' });

  res.setHeader('Content-Disposition', `attachment; filename="template_${type}.xls"`);
  res.setHeader('Content-Type', 'application/vnd.ms-excel');
  res.send(buffer);
});

module.exports = router;
