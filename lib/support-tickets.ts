import { getPool } from '@/lib/db';
import { sendAdmissionFormEmail } from '@/lib/mailer';

/**
 * Support Ticketing System
 *
 * Logs queries raised by any account and lets super admins (or anyone with the
 * `support_ticket.manage` permission) view every account's tickets and reply.
 *
 * Tables are created lazily on first use, matching the pattern used by
 * lib/activity-log.ts so no migration file is required.
 */

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export const TICKET_STATUSES: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
export const TICKET_PRIORITIES: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];

export interface SupportTicket {
  id: number;
  subject: string;
  category: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  message: string;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  role_id: number | null;
  department: string | null;
  reply_count: number;
  last_reply_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportTicketReply {
  id: number;
  ticket_id: number;
  message: string;
  author_user_id: number | null;
  author_name: string | null;
  is_admin: number;
  created_at: string;
}

let ensured = false;

async function ensureTables() {
  if (ensured) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      subject VARCHAR(255) NOT NULL,
      category VARCHAR(80) NULL,
      priority VARCHAR(20) NOT NULL DEFAULT 'normal',
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      message LONGTEXT NOT NULL,
      user_id INT NULL,
      user_name VARCHAR(255) NULL,
      user_email VARCHAR(255) NULL,
      role_id INT NULL,
      department VARCHAR(120) NULL,
      reply_count INT NOT NULL DEFAULT 0,
      last_reply_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_tickets_user (user_id, created_at),
      INDEX idx_tickets_status (status, created_at)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS support_ticket_replies (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      ticket_id BIGINT NOT NULL,
      message LONGTEXT NOT NULL,
      author_user_id INT NULL,
      author_name VARCHAR(255) NULL,
      is_admin TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_replies_ticket (ticket_id, created_at)
    )
  `);
  ensured = true;
}

interface ListTicketsOptions {
  /** When set, only return tickets raised by this user (non-admin view). */
  userId?: number;
  status?: TicketStatus | 'all';
  search?: string;
  limit?: number;
}

export async function listTickets(opts: ListTicketsOptions): Promise<SupportTicket[]> {
  await ensureTables();
  const pool = getPool();

  const where: string[] = [];
  const params: (string | number)[] = [];

  if (opts.userId != null) {
    where.push('user_id = ?');
    params.push(opts.userId);
  }
  if (opts.status && opts.status !== 'all') {
    where.push('status = ?');
    params.push(opts.status);
  }
  if (opts.search && opts.search.trim()) {
    const like = `%${opts.search.trim()}%`;
    where.push('(subject LIKE ? OR message LIKE ? OR user_name LIKE ? OR user_email LIKE ?)');
    params.push(like, like, like, like);
  }

  const limit = opts.limit == null ? null : Math.min(Math.max(opts.limit, 1), 500);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limitSql = limit == null ? '' : ` LIMIT ${limit}`;

  const [rows] = await pool.query(
    `SELECT * FROM support_tickets ${whereSql}
     ORDER BY (status IN ('open','in_progress')) DESC,
              COALESCE(last_reply_at, created_at) DESC${limitSql}`,
    params
  );
  return rows as SupportTicket[];
}

export async function getTicket(id: number): Promise<SupportTicket | null> {
  await ensureTables();
  const pool = getPool();
  const [rows] = await pool.query('SELECT * FROM support_tickets WHERE id = ? LIMIT 1', [id]);
  return (rows as SupportTicket[])[0] ?? null;
}

export async function getReplies(ticketId: number): Promise<SupportTicketReply[]> {
  await ensureTables();
  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT * FROM support_ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC',
    [ticketId]
  );
  return rows as SupportTicketReply[];
}

interface CreateTicketInput {
  subject: string;
  message: string;
  category?: string | null;
  priority?: TicketPriority;
  userId: number | null;
  userName: string | null;
  userEmail: string | null;
  roleId: number | null;
  department: string | null;
}

export async function createTicket(input: CreateTicketInput): Promise<number> {
  await ensureTables();
  const pool = getPool();
  const priority = TICKET_PRIORITIES.includes(input.priority as TicketPriority)
    ? input.priority
    : 'normal';
  const [result] = await pool.query(
    `INSERT INTO support_tickets
       (subject, category, priority, status, message, user_id, user_name, user_email, role_id, department)
     VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)`,
    [
      input.subject,
      input.category ?? null,
      priority,
      input.message,
      input.userId,
      input.userName,
      input.userEmail,
      input.roleId,
      input.department,
    ]
  );
  return (result as { insertId: number }).insertId;
}

// "Admin" category tickets always go to the Accounts Department role — looked up by
// title rather than a hardcoded role id, since role ids aren't stable across
// deployments (confirmed role id 24 = "Accounts Department" in this DB, but that's
// incidental). Never throws: a notification failure should never block ticket
// creation, so callers can fire this without awaiting error handling.
export async function notifyAccountsDepartmentIfAdminCategory(ticket: {
  id: number;
  subject: string;
  message: string;
  category: string | null;
  userName: string | null;
  userEmail: string | null;
}): Promise<void> {
  if (String(ticket.category ?? '').trim().toLowerCase() !== 'admin') return;

  try {
    const pool = getPool();
    const [roleRows] = await pool.query(
      `SELECT id FROM role WHERE title = 'Accounts Department' AND (\`delete\` = 0 OR \`delete\` IS NULL) LIMIT 1`
    ) as [Array<{ id: number }>, unknown];
    const roleId = roleRows[0]?.id;
    if (!roleId) return;

    const [userRows] = await pool.query(
      `SELECT email, firstname FROM awt_adminuser
       WHERE role = ? AND (deleted = 0 OR deleted IS NULL) AND email IS NOT NULL AND email <> ''`,
      [roleId]
    ) as [Array<{ email: string; firstname: string | null }>, unknown];
    if (!userRows.length) return;

    const raisedBy = ticket.userName || 'A staff member';
    const subject = `[Admin] New Support Ticket: ${ticket.subject}`;
    const text = [
      `A new Admin-category support ticket has been raised.`,
      '',
      `Ticket #${ticket.id}: ${ticket.subject}`,
      `Raised by: ${raisedBy}${ticket.userEmail ? ` (${ticket.userEmail})` : ''}`,
      '',
      ticket.message,
    ].join('\n');

    await Promise.all(userRows.map((u) =>
      sendAdmissionFormEmail({
        toEmail: u.email,
        admissionFormUrl: '#',
        subject,
        text,
      }).catch((err) => {
        console.error('[support-tickets] Failed to notify Accounts Department:', u.email, err);
      })
    ));
  } catch (err) {
    console.error('[support-tickets] notifyAccountsDepartmentIfAdminCategory failed:', err);
  }
}

interface AddReplyInput {
  ticketId: number;
  message: string;
  authorUserId: number | null;
  authorName: string | null;
  isAdmin: boolean;
}

export async function addReply(input: AddReplyInput): Promise<number> {
  await ensureTables();
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO support_ticket_replies
       (ticket_id, message, author_user_id, author_name, is_admin)
     VALUES (?, ?, ?, ?, ?)`,
    [input.ticketId, input.message, input.authorUserId, input.authorName, input.isAdmin ? 1 : 0]
  );

  // Keep the ticket summary fields fresh. An admin reply moves an open ticket
  // into "in_progress" so it is clearly being handled.
  await pool.query(
    `UPDATE support_tickets
       SET reply_count = reply_count + 1,
           last_reply_at = CURRENT_TIMESTAMP,
           status = CASE WHEN ? = 1 AND status = 'open' THEN 'in_progress' ELSE status END
     WHERE id = ?`,
    [input.isAdmin ? 1 : 0, input.ticketId]
  );
  return (result as { insertId: number }).insertId;
}

export async function updateTicketStatus(id: number, status: TicketStatus): Promise<void> {
  await ensureTables();
  const pool = getPool();
  await pool.query('UPDATE support_tickets SET status = ? WHERE id = ?', [status, id]);
}

/** Counts grouped by status — used for the admin dashboard summary cards. */
export async function getTicketStats(userId?: number): Promise<Record<TicketStatus | 'total', number>> {
  await ensureTables();
  const pool = getPool();
  const params: (string | number)[] = [];
  let whereSql = '';
  if (userId != null) {
    whereSql = 'WHERE user_id = ?';
    params.push(userId);
  }
  const [rows] = await pool.query(
    `SELECT status, COUNT(*) AS c FROM support_tickets ${whereSql} GROUP BY status`,
    params
  );
  const stats: Record<TicketStatus | 'total', number> = {
    open: 0, in_progress: 0, resolved: 0, closed: 0, total: 0,
  };
  for (const r of rows as { status: TicketStatus; c: number }[]) {
    if (r.status in stats) stats[r.status] = Number(r.c);
    stats.total += Number(r.c);
  }
  return stats;
}
