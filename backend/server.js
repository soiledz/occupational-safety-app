require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./database');
const { initDatabase: initDatabasePg } = require('./database-pg');
const { seedDefaultUsers } = require('./seed');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const employeesRoutes = require('./routes/employees');
const settingsRoutes = require('./routes/settings');
const recordsRoutes = require('./routes/records');
const importRoutes = require('./routes/import');

const app = express();
const PORT = process.env.PORT || 3001;

const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? (process.env.CORS_ORIGIN || 'https://safety-frontend.onrender.com')
    : 'http://localhost:5173',
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

if (process.env.DATABASE_URL) {
  console.log('Using PostgreSQL database');
  initDatabasePg().catch(console.error);
} else {
  console.log('Using SQLite database');
  initDatabase();
}
seedDefaultUsers().catch(console.error);

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/records', recordsRoutes);
app.use('/api/import', importRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Default users:');
  console.log('  Superadmin: admin@system.ua / admin123');
  console.log('  Manager:    manager@hospital1.ua / manager123');
});
