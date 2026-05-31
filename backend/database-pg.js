const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDatabase() {
  const client = await pool.connect();
  try {
    // 1. Hospitals
    await client.query(`
      CREATE TABLE IF NOT EXISTS hospitals (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Departments
    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
        name TEXT NOT NULL
      )
    `);

    // 3. Users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('superadmin', 'hospital_manager')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Employees
    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
        full_name TEXT NOT NULL,
        position TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Periodicity Settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS periodicity_settings (
        id SERIAL PRIMARY KEY,
        hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
        category TEXT NOT NULL CHECK(category IN ('instruction', 'medical', 'extinguisher')),
        months_period INTEGER NOT NULL DEFAULT 12,
        UNIQUE(hospital_id, category)
      )
    `);

    // 6. Control Records
    await client.query(`
      CREATE TABLE IF NOT EXISTS control_records (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        object_name TEXT,
        category TEXT NOT NULL CHECK(category IN ('instruction', 'medical', 'extinguisher')),
        last_date DATE,
        next_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('PostgreSQL database initialized successfully');

    // Проверка сид-данных
    const result = await client.query('SELECT COUNT(*) as count FROM hospitals');
    if (parseInt(result.rows[0].count) === 0) {
      await seedData(client);
    }
  } finally {
    client.release();
  }
}

async function seedData(client) {
  const bcrypt = require('bcryptjs');

  const hospitalResult = await client.query(
    'INSERT INTO hospitals (name, address) VALUES ($1, $2) RETURNING id',
    ['Лікарня №1', 'м. Одеса, вул. Приморська, 1']
  );
  const hospitalId = hospitalResult.rows[0].id;

  await client.query('INSERT INTO departments (hospital_id, name) VALUES ($1, $2)', [hospitalId, 'Хірургічне відділення']);
  await client.query('INSERT INTO departments (hospital_id, name) VALUES ($1, $2)', [hospitalId, 'Терапевтичне відділення']);
  await client.query('INSERT INTO departments (hospital_id, name) VALUES ($1, $2)', [hospitalId, 'Поліклініка']);

  await client.query('INSERT INTO periodicity_settings (hospital_id, category, months_period) VALUES ($1, $2, $3)', [hospitalId, 'instruction', 12]);
  await client.query('INSERT INTO periodicity_settings (hospital_id, category, months_period) VALUES ($1, $2, $3)', [hospitalId, 'medical', 12]);
  await client.query('INSERT INTO periodicity_settings (hospital_id, category, months_period) VALUES ($1, $2, $3)', [hospitalId, 'extinguisher', 12]);

  const superHash = bcrypt.hashSync('admin123', 10);
  await client.query(
    'INSERT INTO users (hospital_id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
    [null, 'admin@system.ua', superHash, 'superadmin']
  );

  const managerHash = bcrypt.hashSync('manager123', 10);
  await client.query(
    'INSERT INTO users (hospital_id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
    [hospitalId, 'manager@hospital1.ua', managerHash, 'hospital_manager']
  );

  console.log('Seed data inserted into PostgreSQL');
}

// Хелпер автоматической конвертации знаков "?" в "$1, $2, ..." для Postgres
// Избавляет от необходимости переписывать SQL-код внутри роутов
function convertPlaceholders(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

async function dbGet(sql, params = []) {
  const pgSql = convertPlaceholders(sql);
  const result = await pool.query(pgSql, params);
  return result.rows[0] || null;
}

async function dbAll(sql, params = []) {
  const pgSql = convertPlaceholders(sql);
  const result = await pool.query(pgSql, params);
  return result.rows;
}

async function dbRun(sql, params = []) {
  let pgSql = convertPlaceholders(sql);
  
  // Автоматически добавляем 'RETURNING id' для всех запросов INSERT,
  // если этого слова еще нет в запросе. Это заставит Postgres
  // возвращать новый ID так же, как это делает SQLite через lastID.
  if (/^\s*insert\s+/i.test(pgSql) && !/returning/i.test(pgSql)) {
    pgSql += ' RETURNING id';
  }
  
  const result = await pool.query(pgSql, params);
  return { 
    // Если Postgres вернул строку с id, берем его, иначе 0
    lastID: result.rows[0]?.id || 0, 
    changes: result.rowCount 
  };
}

module.exports = { pool, initDatabase, dbGet, dbAll, dbRun };