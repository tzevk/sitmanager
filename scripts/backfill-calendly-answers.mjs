// One-off: fill appointments.calendly_answers from Calendly for rows synced before the column existed.
// Only writes calendly_answers. Usage: node --env-file=.env.local scripts/backfill-calendly-answers.mjs
import mysql from 'mysql2/promise';

const T = process.env.CALENDLY_API_TOKEN;
const c = await mysql.createConnection(process.env.DATABASE_URL || {
  host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, port: process.env.DB_PORT,
});
const [rows] = await c.query(`SELECT id, calendly_invitee_uri FROM appointments WHERE calendly_invitee_uri IS NOT NULL AND calendly_answers IS NULL`);
let ok = 0, empty = 0, failed = 0;
for (const r of rows) {
  try {
    const res = await fetch(r.calendly_invitee_uri, { headers: { Authorization: `Bearer ${T}` } });
    if (!res.ok) throw new Error(String(res.status));
    const inv = (await res.json()).resource;
    const qa = (inv.questions_and_answers ?? [])
      .map((q) => ({ question: String(q.question || '').trim(), answer: String(q.answer ?? '').trim() }))
      .filter((q) => q.question);
    if (!qa.length) { empty++; continue; }
    await c.query(`UPDATE appointments SET calendly_answers = ? WHERE id = ?`, [JSON.stringify(qa), r.id]);
    ok++;
  } catch (e) { failed++; console.log('failed', r.id, e.message); }
}
console.log({ total: rows.length, ok, empty, failed });
await c.end();
