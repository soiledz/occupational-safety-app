const bcrypt = require('bcryptjs');
const { dbGet, dbRun } = require('./database');

async function seedDefaultUsers() {
  // Check if any users exist
  const existingUsers = await dbGet('SELECT COUNT(*) as count FROM users');

  if (existingUsers.count > 0) {
    console.log('Users already exist, skipping seed');
    return;
  }

  console.log('Creating default users...');

  // Create default hospital
  const hospitalResult = await dbRun(
    'INSERT INTO hospitals (name, address) VALUES (?, ?)',
    ['Лікарня №1', 'м. Одеса, вул. Приморська, 1']
  );
  const hospitalId = hospitalResult.lastID;

  // Create default departments
  await dbRun('INSERT INTO departments (hospital_id, name) VALUES (?, ?)', [hospitalId, 'Хірургічне відділення']);
  await dbRun('INSERT INTO departments (hospital_id, name) VALUES (?, ?)', [hospitalId, 'Терапевтичне відділення']);
  await dbRun('INSERT INTO departments (hospital_id, name) VALUES (?, ?)', [hospitalId, 'Поліклініка']);

  // Create default periodicity settings
  await dbRun('INSERT INTO periodicity_settings (hospital_id, category, months_period) VALUES (?, ?, ?)', [hospitalId, 'instruction', 12]);
  await dbRun('INSERT INTO periodicity_settings (hospital_id, category, months_period) VALUES (?, ?, ?)', [hospitalId, 'medical', 12]);
  await dbRun('INSERT INTO periodicity_settings (hospital_id, category, months_period) VALUES (?, ?, ?)', [hospitalId, 'extinguisher', 12]);

  // Create superadmin
  const superHash = bcrypt.hashSync('admin123', 10);
  await dbRun(
    'INSERT INTO users (hospital_id, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [null, 'admin@system.ua', superHash, 'superadmin']
  );

  // Create hospital manager
  const managerHash = bcrypt.hashSync('manager123', 10);
  await dbRun(
    'INSERT INTO users (hospital_id, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [hospitalId, 'manager@hospital1.ua', managerHash, 'hospital_manager']
  );

  console.log('✅ Default users created:');
  console.log('   Superadmin: admin@system.ua / admin123');
  console.log('   Manager: manager@hospital1.ua / manager123');
}

module.exports = { seedDefaultUsers };
