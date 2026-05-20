#!/usr/bin/env node
/**
 * Reset an admin user's password.
 * Usage: node scripts/db/reset-user-password.mjs <username> <new-password>
 * Reads DB credentials from .env.local
 */
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });

const [username, newPassword] = process.argv.slice(2);

if (!username || !newPassword) {
  console.error('Usage: node scripts/db/reset-user-password.mjs <username> <new-password>');
  process.exit(1);
}

async function main() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 2,
  });

  try {
    // Check user exists
    const [rows] = await pool.query(
      `SELECT id, username, firstname, lastname FROM awt_adminuser WHERE username = ? AND deleted = 0`,
      [username]
    );

    if (!rows.length) {
      console.error(`No active user found with username: "${username}"`);
      process.exit(1);
    }

    const user = rows[0];
    const hashedPassword = crypto.createHash('md5').update(newPassword).digest('hex');

    await pool.query(
      `UPDATE awt_adminuser SET password = ? WHERE id = ?`,
      [hashedPassword, user.id]
    );

    console.log(`Password reset successfully for user: ${user.firstname} ${user.lastname} (${user.username})`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
