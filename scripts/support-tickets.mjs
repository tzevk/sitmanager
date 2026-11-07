/**
 * Helper for the /tickets Claude Code skill (.claude/skills/tickets/SKILL.md).
 * Reads and writes support tickets directly in the DB from .env.local.
 *
 *   node scripts/support-tickets.mjs list                 open + in_progress tickets awaiting support
 *   node scripts/support-tickets.mjs show <id>            ticket + full thread (incl. internal notes)
 *   node scripts/support-tickets.mjs reply <id> <file>    public reply (visible to the ticket owner)
 *   node scripts/support-tickets.mjs note <id> <file>     internal note (admins only)
 *   node scripts/support-tickets.mjs status <id> <open|in_progress|resolved|closed>
 *
 * Message text is read from a file so quotes/newlines survive the shell.
 * Replies are posted with author_name "Support (Auto)", author_user_id NULL.
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dir, '../.env.local'), quiet: true });

const AUTHOR = 'Support (Auto)';
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

const [cmd, idArg, arg2] = process.argv.slice(2);
const id = Number(idArg);

const c = await mysql.createConnection({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true,
});

async function ensureInternalCol() {
  const [[r]] = await c.query(
    `SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'support_ticket_replies' AND COLUMN_NAME = 'is_internal'`);
  if (!Number(r.n)) await c.query(`ALTER TABLE support_ticket_replies ADD COLUMN is_internal TINYINT(1) NOT NULL DEFAULT 0 AFTER is_admin`);
}

function readMsg(file) {
  const text = readFileSync(file, 'utf8').trim();
  if (!text) throw new Error('Message file is empty');
  return text;
}

try {
  await ensureInternalCol();
  if (cmd === 'list') {
    // Tickets where the last word is not from support (new, or the user replied since).
    const [rows] = await c.query(`
      SELECT t.id, t.subject, t.category, t.priority, t.status, t.user_name, t.department, t.created_at,
             (SELECT r.is_admin FROM support_ticket_replies r WHERE r.ticket_id = t.id AND r.is_internal = 0
               ORDER BY r.created_at DESC, r.id DESC LIMIT 1) AS last_public_by_admin,
             (SELECT COUNT(*) FROM support_ticket_replies r WHERE r.ticket_id = t.id AND r.is_internal = 1) AS notes
      FROM support_tickets t
      WHERE t.status IN ('open','in_progress')
      ORDER BY FIELD(t.priority,'urgent','high','normal','low'), t.created_at`);
    const waiting = rows.filter((r) => r.last_public_by_admin !== 1);
    console.log(JSON.stringify({ awaiting_support: waiting, total_open: rows.length }, null, 2));
  } else if (cmd === 'show') {
    const [[t]] = await c.query(`SELECT * FROM support_tickets WHERE id = ?`, [id]);
    if (!t) throw new Error(`Ticket ${id} not found`);
    const [replies] = await c.query(
      `SELECT id, author_name, is_admin, is_internal, created_at, message FROM support_ticket_replies
       WHERE ticket_id = ? ORDER BY created_at, id`, [id]);
    console.log(JSON.stringify({ ticket: t, replies }, null, 2));
  } else if (cmd === 'reply' || cmd === 'note') {
    const internal = cmd === 'note' ? 1 : 0;
    const msg = readMsg(arg2);
    const [res] = await c.query(
      `INSERT INTO support_ticket_replies (ticket_id, message, author_user_id, author_name, is_admin, is_internal)
       VALUES (?, ?, NULL, ?, 1, ?)`, [id, msg, AUTHOR, internal]);
    if (!internal) {
      await c.query(
        `UPDATE support_tickets SET reply_count = reply_count + 1, last_reply_at = CURRENT_TIMESTAMP,
           status = IF(status = 'open', 'in_progress', status) WHERE id = ?`, [id]);
    }
    console.log(`${internal ? 'Note' : 'Reply'} #${res.insertId} added to ticket ${id}`);
  } else if (cmd === 'status') {
    if (!STATUSES.includes(arg2)) throw new Error(`Status must be one of ${STATUSES.join(', ')}`);
    await c.query(`UPDATE support_tickets SET status = ? WHERE id = ?`, [arg2, id]);
    console.log(`Ticket ${id} -> ${arg2}`);
  } else {
    console.log('Usage: list | show <id> | reply <id> <file> | note <id> <file> | status <id> <status>');
  }
} catch (e) {
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
