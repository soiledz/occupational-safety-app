#!/usr/bin/env node
/**
 * CLI tool for adding users to the occupational safety app
 * Usage: node add-user.js
 */

const readline = require('readline');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  console.log('\n🏥 Охорона праці — Додавання користувача\n');

  const email = await ask('Email: ');
  const password = await ask('Пароль: ');

  console.log('\nРолі:');
  console.log('  1. superadmin — повний доступ до всіх лікарень');
  console.log('  2. hospital_manager — доступ тільки до своєї лікарні');
  const roleChoice = await ask('\nОберіть роль (1/2): ');
  const role = roleChoice === '1' ? 'superadmin' : 'hospital_manager';

  let hospital_id = null;
  if (role === 'hospital_manager') {
    // Show existing hospitals
    const hospitals = await new Promise((resolve, reject) => {
      db.all('SELECT id, name FROM hospitals', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    console.log('\nІснуючі лікарні:');
    hospitals.forEach(h => console.log(`  ${h.id}. ${h.name}`));

    const hospitalId = await ask('\nID лікарні (або Enter для створення нової): ');
    if (hospitalId.trim()) {
      hospital_id = parseInt(hospitalId);
    } else {
      // Create new hospital
      const hospitalName = await ask('Назва нової лікарні: ');
      const hospitalAddress = await ask('Адреса: ');

      const result = await new Promise((resolve, reject) => {
        db.run('INSERT INTO hospitals (name, address) VALUES (?, ?)', 
          [hospitalName, hospitalAddress], function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
      });

      hospital_id = result;
      console.log(`\n✅ Створено лікарню "${hospitalName}" (ID: ${hospital_id})`);
    }
  }

  // Check if email exists
  const existing = await new Promise((resolve, reject) => {
    db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (existing) {
    console.log('\n❌ Помилка: Користувач з таким email вже існує!');
    process.exit(1);
  }

  const hash = bcrypt.hashSync(password, 10);

  const result = await new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO users (hospital_id, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [hospital_id, email, hash, role],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });

  console.log('\n✅ Користувача успішно створено!');
  console.log(`   ID: ${result}`);
  console.log(`   Email: ${email}`);
  console.log(`   Роль: ${role}`);
  console.log(`   Лікарня ID: ${hospital_id || 'немає (superadmin)'}`);
  console.log('\n🔑 Тепер можна увійти в систему.');

  db.close();
  rl.close();
}

main().catch(err => {
  console.error('\n❌ Помилка:', err.message);
  db.close();
  rl.close();
  process.exit(1);
});
