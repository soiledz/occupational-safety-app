const express = require('express');
const { dbAll } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  const { hospital_id, role } = req.user;
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    let statsQuery, statsParams;
    if (role === 'superadmin') {
      statsQuery = `
        SELECT cr.category,
          SUM(CASE WHEN cr.next_date < ? THEN 1 ELSE 0 END) as overdue,
          SUM(CASE WHEN cr.next_date >= ? AND cr.next_date <= ? THEN 1 ELSE 0 END) as warning,
          SUM(CASE WHEN cr.next_date > ? THEN 1 ELSE 0 END) as ok
        FROM control_records cr
        LEFT JOIN employees e ON cr.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        GROUP BY cr.category
      `;
      statsParams = [today, today, thirtyDaysLater, thirtyDaysLater];
    } else {
      statsQuery = `
        SELECT cr.category,
          SUM(CASE WHEN cr.next_date < ? THEN 1 ELSE 0 END) as overdue,
          SUM(CASE WHEN cr.next_date >= ? AND cr.next_date <= ? THEN 1 ELSE 0 END) as warning,
          SUM(CASE WHEN cr.next_date > ? THEN 1 ELSE 0 END) as ok
        FROM control_records cr
        LEFT JOIN employees e ON cr.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE d.hospital_id = ? OR cr.employee_id IS NULL
        GROUP BY cr.category
      `;
      statsParams = [today, today, thirtyDaysLater, thirtyDaysLater, hospital_id];
    }

    const stats = await dbAll(statsQuery, statsParams);

    let upcomingQuery, upcomingParams;
    if (role === 'superadmin') {
      upcomingQuery = `
        SELECT cr.id, cr.category, cr.object_name, cr.next_date,
          e.full_name as employee_name, d.name as department_name, h.name as hospital_name
        FROM control_records cr
        LEFT JOIN employees e ON cr.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN hospitals h ON d.hospital_id = h.id
        WHERE cr.next_date <= ? AND cr.next_date >= ?
        ORDER BY cr.next_date ASC LIMIT 50
      `;
      upcomingParams = [thirtyDaysLater, today];
    } else {
      upcomingQuery = `
        SELECT cr.id, cr.category, cr.object_name, cr.next_date,
          e.full_name as employee_name, d.name as department_name
        FROM control_records cr
        LEFT JOIN employees e ON cr.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE (d.hospital_id = ? OR cr.employee_id IS NULL)
          AND cr.next_date <= ? AND cr.next_date >= ?
        ORDER BY cr.next_date ASC LIMIT 50
      `;
      upcomingParams = [hospital_id, thirtyDaysLater, today];
    }

    const upcoming = await dbAll(upcomingQuery, upcomingParams);

    const categorized = { instruction: [], medical: [], extinguisher: [] };
    upcoming.forEach(record => {
      if (categorized[record.category]) categorized[record.category].push(record);
    });

    res.json({
      stats: stats.reduce((acc, s) => {
        acc[s.category] = { overdue: s.overdue || 0, warning: s.warning || 0, ok: s.ok || 0 };
        return acc;
      }, {}),
      upcoming: categorized
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
