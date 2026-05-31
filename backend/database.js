const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  // Enable foreign keys support (required for SQLite)
  db.run('PRAGMA foreign_keys = ON');

  // Enable WAL mode for better concurrency
  db.run('PRAGMA journal_mode = WAL');
  db.serialize(() => {
    // 1. Hospitals
    db.run(`
      CREATE TABLE IF NOT EXISTS hospitals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Departments
    db.run(`
      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hospital_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
      )
    `);

    // 3. Users
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hospital_id INTEGER,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('superadmin', 'hospital_manager')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL
      )
    `);

    // 4. Employees
    db.run(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        department_id INTEGER NOT NULL,
        full_name TEXT NOT NULL,
        position TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
      )
    `);

    // 5. Periodicity Settings
    db.run(`
      CREATE TABLE IF NOT EXISTS periodicity_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hospital_id INTEGER NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('instruction', 'medical', 'extinguisher')),
        months_period INTEGER NOT NULL DEFAULT 12,
        UNIQUE(hospital_id, category),
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
      )
    `);

    // 6. Control Records
    db.run(`
      CREATE TABLE IF NOT EXISTS control_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER,
        object_name TEXT,
        category TEXT NOT NULL CHECK(category IN ('instruction', 'medical', 'extinguisher')),
        last_date DATE,
        next_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      )
    `);
  });

  // Check if seed data exists
  db.get('SELECT id FROM hospitals LIMIT 1', (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return;
    }
    if (!row) {
      seedData();
    } else {
      console.log('Database already seeded');
    }
  });

  console.log('Database initialized successfully');
}

function seedData() {
  const bcrypt = require('bcryptjs');

  db.serialize(() => {
    // Insert hospital
    db.run('INSERT INTO hospitals (name, address) VALUES (?, ?)', 
      ['Лікарня №1', 'м. Одеса, вул. Приморська, 1'], 
      function(err) {
        if (err) return console.error(err);
        const hospitalId = this.lastID;

        // Insert departments
        db.run('INSERT INTO departments (hospital_id, name) VALUES (?, ?)', [hospitalId, 'Хірургічне відділення']);
        db.run('INSERT INTO departments (hospital_id, name) VALUES (?, ?)', [hospitalId, 'Терапевтичне відділення']);
        db.run('INSERT INTO departments (hospital_id, name) VALUES (?, ?)', [hospitalId, 'Поліклініка'], function() {

          // Insert periodicity settings
          db.run('INSERT INTO periodicity_settings (hospital_id, category, months_period) VALUES (?, ?, ?)', [hospitalId, 'instruction', 12]);
          db.run('INSERT INTO periodicity_settings (hospital_id, category, months_period) VALUES (?, ?, ?)', [hospitalId, 'medical', 12]);
          db.run('INSERT INTO periodicity_settings (hospital_id, category, months_period) VALUES (?, ?, ?)', [hospitalId, 'extinguisher', 12]);

          // Insert users
          const hash = bcrypt.hashSync('admin123', 10);
          db.run('INSERT INTO users (hospital_id, email, password_hash, role) VALUES (?, ?, ?, ?)', 
            [null, 'admin@system.ua', hash, 'superadmin']);

          const managerHash = bcrypt.hashSync('manager123', 10);
          db.run('INSERT INTO users (hospital_id, email, password_hash, role) VALUES (?, ?, ?, ?)', 
            [hospitalId, 'manager@hospital1.ua', managerHash, 'hospital_manager']);

          console.log('Seed data inserted');
        });
      }
    );
  });
}

// Helper: promisified db methods
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

module.exports = { db, initDatabase, dbGet, dbAll, dbRun };
