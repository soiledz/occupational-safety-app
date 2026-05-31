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
const PORT = process.env.PORT || 10000;

const allowedOrigins = [
  'https://safety-frontend-8vqf.onrender.com',
  'https://safety-frontend.onrender.com',
  'http://localhost:5173'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

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

// Асинхронная функция запуска базы данных и сервера
const startServer = async () => {
  try {
    if (process.env.DATABASE_URL) {
      console.log('Using PostgreSQL database');
      // Ожидаем полную инициализацию Postgres
      await initDatabasePg(); 
      console.log('PostgreSQL database initialized successfully');
    } else {
      console.log('Using SQLite database');
      // Ожидаем инициализацию SQLite и сид пользователей последовательно
      await initDatabase();
      await seedDefaultUsers();
      console.log('SQLite database initialized and seeded successfully');
    }

    // Запуск прослушивания порта только после успешной готовности базы данных
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      if (!process.env.DATABASE_URL) {
        console.log('Default users (SQLite only):');
        console.log('  Superadmin: admin@system.ua / admin123');
        console.log('  Manager:    manager@hospital1.ua / manager123');
      }
    });

  } catch (error) {
    console.error('Critical error during server startup:', error);
    process.exit(1); // Завершаем процесс, если база не подключилась
  }
};

// Запуск приложения
startServer();
