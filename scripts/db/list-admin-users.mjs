#!/usr/bin/env node
/**
 * List admin users from the database.
 * Usage: node scripts/db/list-admin-users.mjs
 * Reads DB credentials from .env.local
 */
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: '.env.local' });

async function main() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 2,
    dateStrings: true,
  });

  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.firstname, u.lastname, u.email,
              r.title AS role_title, u.deleted
       FROM awt_adminuser u
       LEFT JOIN role r ON r.id = u.role
       WHERE u.deleted = 0
       ORDER BY u.id ASC`
    );

    if (!rows.length) {
      console.log('No active admin users found.');
      return;
    }

    console.log(`\nFound ${rows.length} active admin user(s):\n`);
    console.log(
      'ID'.padEnd(6) +
      'Username'.padEnd(20) +
      'Name'.padEnd(30) +
      'Email'.padEnd(35) +
      'Role'
    );
    console.log('-'.repeat(100));

    for (const u of rows) {
      const name = `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim();
      console.log(
        String(u.id).padEnd(6) +
        String(u.username ?? '').padEnd(20) +
        name.padEnd(30) +
        String(u.email ?? '').padEnd(35) +
        String(u.role_title ?? 'N/A')
      );
    }
    console.log('');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
