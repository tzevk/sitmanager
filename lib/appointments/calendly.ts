/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type mysql from 'mysql2/promise';
import { getPool } from '@/lib/db';
import { ensureAppointmentTables } from '@/lib/appointments/schema';
import {
  freeCounsellorsFor, loadDayContext, overlapsAny, pickCounsellor, supportsMode,
  type ApptMode, type CounsellorRow,
} from '@/lib/appointments/engine';
import {
  addHistory, fetchAppointment, getCounsellorEmail, nextAppointmentCode, syncTask, touchCounsellor, withBookingLock,
  type Actor, type AppointmentRow,
} from '@/lib/appointments/service';
import { sendCounsellorNotification } from '@/lib/appointments/notify';
import { APPT_TIMEZONE, fromMinutes } from '@/lib/appointments/time';

/**
 * Calendly → appointments sync.
 *
 * Calendly is the public booking page. Every Calendly booking (invitee) becomes
 * a row in `appointments` so it shows in the dashboard widget, calendar,
 * management table, counsellor tasks and 30-minute reminders.
 *
 * Two entry points, both idempotent (keyed on calendly_invitee_uri):
 *  - webhook  /api/webhook/calendly   — instant (needs a paid Calendly plan)
 *  - cron     /api/cron/calendly-sync — pull backstop every 10 min
 *
 * The Calendly event has one shared host account, so the internal counsellor is
 * chosen here: host email match → fair assignment among counsellors free by the
 * availability engine → any counsellor without a clashing appointment/block →
 * unassigned (staff assign manually).
 *
 * Applicant confirmation emails are sent by Calendly itself; we only notify the
 * assigned internal counsellor.
 */

const API = 'https://api.calendly.com';
const ACTOR: Actor = { userId: null, name: 'Calendly' };

export function calendlyConfigured() {
  return Boolean(process.env.CALENDLY_API_TOKEN?.trim());
}

async function calendly(pathOrUrl: string, init: RequestInit = {}): Promise<any> {
  const token = process.env.CALENDLY_API_TOKEN?.trim();
  if (!token) throw new Error('CALENDLY_API_TOKEN is not configured');
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${API}${pathOrUrl}`;
  if (!url.startsWith(API)) throw new Error('Refusing to call a non-Calendly URL');
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    cache: 'no-store',
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Calendly ${res.status}: ${body?.message || body?.title || res.statusText}`) as Error & { status?: number; body?: any };
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

// ── Key/value store (signing key, last sync) ───────────────────────────

export async function getIntegration(key: string): Promise<string | null> {
  await ensureAppointmentTables();
  const [rows] = await getPool().query(`SELECT v FROM appt_integrations WHERE k = ?`, [key]);
  return ((rows as any[])[0]?.v as string) ?? null;
}

async function setIntegration(key: string, value: string | null) {
  await getPool().query(
    `INSERT INTO appt_integrations (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)`,
    [key, value]
  );
}

// ── Mapping helpers ────────────────────────────────────────────────────

/** UTC ISO → institute-local { date, time }. */
function toLocal(iso: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APPT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return { date: `${g('year')}-${g('month')}-${g('day')}`, minutes: (Number(g('hour')) % 24) * 60 + Number(g('minute')) };
}

function answer(invitee: any, ...keywords: string[]): string {
  const qa = (invitee?.questions_and_answers ?? []) as { question: string; answer: string }[];
  const hit = qa.find((q) => keywords.some((k) => String(q.question || '').toLowerCase().includes(k)));
  return String(hit?.answer ?? '').trim();
}

const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');

async function matchCourse(db: Pick<mysql.Pool, 'query'>, program: string): Promise<{ id: number | null; name: string | null; guidance: boolean }> {
  if (!program || /do ?n.?t know|not sure|guidance/i.test(program)) return { id: null, name: null, guidance: true };
  const [rows] = await db.query(
    `SELECT Course_Id, Course_Name FROM course_mst WHERE COALESCE(IsDelete, 0) = 0 AND Course_Name IS NOT NULL`
  );
  const target = norm(program);
  const courses = rows as { Course_Id: number; Course_Name: string }[];
  const exact = courses.find((c) => norm(c.Course_Name) === target);
  const loose = exact ?? courses.find((c) => {
    const n = norm(c.Course_Name);
    return n.length > 5 && (target.startsWith(n) || n.startsWith(target) || target.replace(/s$/, '') === n.replace(/s$/, ''));
  });
  return loose ? { id: loose.Course_Id, name: loose.Course_Name, guidance: false } : { id: null, name: program.slice(0, 200), guidance: false };
}

function modeOf(event: any, invitee: any): ApptMode {
  const asked = answer(invitee, 'mode', 'online or offline', 'how would you like').toLowerCase();
  if (asked.includes('offline') || asked.includes('in person') || asked.includes('office')) return 'offline';
  if (asked.includes('online')) return 'online';
  const type = String(event?.location?.type || '').toLowerCase();
  return type === 'physical' || type === 'inbound_call' || type === 'outbound_call' ? 'offline' : 'online';
}

function splitName(invitee: any) {
  const first = String(invitee.first_name || '').trim();
  const last = String(invitee.last_name || '').trim();
  if (first || last) return { first: first || '-', last: last || '-' };
  const parts = String(invitee.name || '').trim().split(/\s+/);
  return { first: parts[0] || 'Applicant', last: parts.slice(1).join(' ') || '-' };
}

/**
 * Choose the internal counsellor for a Calendly booking (inside the booking lock).
 * Returns null when nobody can take it — the appointment is still recorded, unassigned.
 */
async function chooseCounsellor(
  conn: mysql.PoolConnection, date: string, start: number, end: number, mode: ApptMode,
  hostEmails: string[], preferUserId: number | null, excludeAppointmentId?: number
): Promise<CounsellorRow | null> {
  const ctx = await loadDayContext(conn, date, { excludeAppointmentId });
  const busy = (c: CounsellorRow) => overlapsAny(ctx.counsellorBusy.get(c.user_id) ?? [], start, end);

  const hosts = hostEmails.map((e) => e.toLowerCase());
  const byHost = ctx.counsellors.find((c) => c.email && hosts.includes(c.email.toLowerCase()) && !busy(c));
  if (byHost) return byHost;

  const free = freeCounsellorsFor(ctx, start, end, mode);
  const preferred = free.find((c) => c.user_id === preferUserId);
  if (preferred) return preferred;
  if (free.length) return pickCounsellor(conn, date, free);

  // Calendly owns public availability, so a booking may fall outside the
  // internal working hours — fall back to anyone without a real clash.
  const noClash = ctx.counsellors.filter((c) => supportsMode(c, mode) && !busy(c));
  const keep = noClash.find((c) => c.user_id === preferUserId);
  if (keep) return keep;
  return noClash.length ? pickCounsellor(conn, date, noClash) : null;
}

// ── Core upsert ─────────────────────────────────────────────────────────

export type SyncAction = 'created' | 'rescheduled' | 'cancelled' | 'no_show' | 'updated' | 'unchanged' | 'skipped';

interface ProcessResult { action: SyncAction; appointment?: AppointmentRow; previousCounsellor?: number | null }

export async function processInvitee(invitee: any, event: any): Promise<ProcessResult> {
  const pool = getPool();
  const canceled = invitee.status === 'canceled';
  const joinUrl: string | null = event?.location?.join_url || null;

  // Fast path outside the lock: already synced and nothing changed.
  const [pre] = await pool.query(
    `SELECT id, status, meeting_link FROM appointments WHERE calendly_invitee_uri = ? LIMIT 1`,
    [invitee.uri]
  );
  const existingPre = (pre as any[])[0];
  if (existingPre && !canceled && !invitee.no_show && (!joinUrl || joinUrl === existingPre.meeting_link)) {
    return { action: 'unchanged' };
  }
  if (!existingPre && canceled && !invitee.old_invitee) return { action: 'skipped' };

  return withBookingLock(async (conn, settings) => {
    const [rows] = await conn.query(`SELECT id FROM appointments WHERE calendly_invitee_uri = ? FOR UPDATE`, [invitee.uri]);
    const existingId = (rows as any[])[0]?.id as number | undefined;

    // ── Existing row: apply cancellation / no-show / meeting link.
    if (existingId) {
      const appt = (await fetchAppointment(conn, existingId))!;
      if (canceled) {
        if (invitee.rescheduled) return { action: 'unchanged' }; // the new invitee moves this row
        if (appt.status === 'Scheduled' || appt.status === 'No Show') {
          await conn.query(`UPDATE appointments SET status = 'Cancelled', slot_guard = NULL WHERE id = ?`, [existingId]);
          const reason = invitee.cancellation?.reason ? `Cancelled in Calendly: ${invitee.cancellation.reason}` : 'Cancelled in Calendly';
          await addHistory(conn, existingId, 'status', appt.status, 'Cancelled', ACTOR, reason.slice(0, 500));
          const updated = (await fetchAppointment(conn, existingId))!;
          await syncTask(conn, updated, ACTOR);
          return { action: 'cancelled', appointment: updated };
        }
        return { action: 'unchanged' };
      }
      if (invitee.no_show && appt.status === 'Scheduled') {
        await conn.query(`UPDATE appointments SET status = 'No Show' WHERE id = ?`, [existingId]);
        await addHistory(conn, existingId, 'status', 'Scheduled', 'No Show', ACTOR, 'Marked no-show in Calendly');
        const updated = (await fetchAppointment(conn, existingId))!;
        await syncTask(conn, updated, ACTOR);
        return { action: 'no_show', appointment: updated };
      }
      if (joinUrl && joinUrl !== appt.meeting_link && appt.mode === 'online') {
        await conn.query(`UPDATE appointments SET meeting_link = ? WHERE id = ?`, [joinUrl, existingId]);
        return { action: 'updated' };
      }
      return { action: 'unchanged' };
    }

    if (canceled) return { action: 'skipped' }; // never create rows for cancelled bookings

    // ── New booking (or the new half of a Calendly reschedule).
    const start = toLocal(event.start_time);
    const endMin = start.minutes + Math.max(5, Math.round((Date.parse(event.end_time) - Date.parse(event.start_time)) / 60000));
    const duration = endMin - start.minutes;
    const mode = modeOf(event, invitee);
    const hostEmails = (event.event_memberships ?? []).map((m: any) => String(m.user_email || '')).filter(Boolean);
    const location = mode === 'offline' ? (event?.location?.location || settings.office_address || null) : null;
    const meetingLink = mode === 'online' ? (joinUrl || settings.default_meeting_link || null) : null;

    let oldId: number | undefined;
    if (invitee.old_invitee) {
      const [old] = await conn.query(`SELECT id FROM appointments WHERE calendly_invitee_uri = ? FOR UPDATE`, [invitee.old_invitee]);
      oldId = (old as any[])[0]?.id;
    }

    if (oldId) {
      const appt = (await fetchAppointment(conn, oldId))!;
      const counsellor = await chooseCounsellor(conn, start.date, start.minutes, endMin, mode, hostEmails, appt.counsellor_user_id, oldId);
      await conn.query(
        `UPDATE appointments SET appt_date = ?, start_time = ?, end_time = ?, duration_minutes = ?, mode = ?,
           counsellor_user_id = ?, status = 'Scheduled', slot_guard = NULL, meeting_link = ?, location = ?,
           calendly_event_uri = ?, calendly_invitee_uri = ?, calendly_reschedule_url = ?, calendly_cancel_url = ?,
           reschedule_count = reschedule_count + 1
         WHERE id = ?`,
        [start.date, fromMinutes(start.minutes), fromMinutes(endMin), duration, mode, counsellor?.user_id ?? null,
          meetingLink, location, event.uri, invitee.uri, invitee.reschedule_url || null, invitee.cancel_url || null, oldId]
      );
      await addHistory(conn, oldId, 'rescheduled', `${appt.appt_date} ${appt.start_time}`, `${start.date} ${fromMinutes(start.minutes)}`, ACTOR, 'Rescheduled in Calendly');
      if ((counsellor?.user_id ?? null) !== appt.counsellor_user_id) {
        await addHistory(conn, oldId, 'reassigned', appt.counsellor_name, counsellor?.display_name ?? 'Unassigned', ACTOR);
        if (counsellor) await touchCounsellor(conn, counsellor.user_id);
      }
      const updated = (await fetchAppointment(conn, oldId))!;
      await syncTask(conn, updated, ACTOR);
      return { action: 'rescheduled', appointment: updated, previousCounsellor: appt.counsellor_user_id };
    }

    const { first, last } = splitName(invitee);
    const course = await matchCourse(conn, answer(invitee, 'program', 'course', 'training'));
    const mobile = (answer(invitee, 'mobile', 'phone', 'contact number') || invitee.text_reminder_number || '').replace(/[^\d+]/g, '').slice(0, 20);
    const counsellor = await chooseCounsellor(conn, start.date, start.minutes, endMin, mode, hostEmails, null);
    const code = await nextAppointmentCode(conn);

    const [res] = await conn.query(
      `INSERT INTO appointments
        (appointment_code, public_token, first_name, last_name, mobile, email, qualification, experience,
         course_id, program_name, needs_guidance, mode, appt_date, start_time, end_time, duration_minutes,
         counsellor_user_id, status, slot_guard, meeting_link, location, notes, source,
         calendly_event_uri, calendly_invitee_uri, calendly_reschedule_url, calendly_cancel_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled', NULL, ?, ?, ?, 'calendly', ?, ?, ?, ?)`,
      [
        code, randomBytes(16).toString('hex'), first.slice(0, 80), last.slice(0, 80), mobile || '-', String(invitee.email || '').slice(0, 150),
        answer(invitee, 'qualification').slice(0, 120) || null, answer(invitee, 'experience').slice(0, 80) || null,
        course.id, course.name, course.guidance ? 1 : 0, mode, start.date, fromMinutes(start.minutes), fromMinutes(endMin), duration,
        counsellor?.user_id ?? null, meetingLink, location,
        answer(invitee, 'anything', 'note', 'share').slice(0, 1000) || null,
        event.uri, invitee.uri, invitee.reschedule_url || null, invitee.cancel_url || null,
      ]
    );
    const id = Number((res as any).insertId);
    if (counsellor) await touchCounsellor(conn, counsellor.user_id);
    await addHistory(conn, id, 'created', null, `${start.date} ${fromMinutes(start.minutes)} · ${counsellor?.display_name ?? 'Unassigned'}`,
      ACTOR, counsellor ? 'Booked via Calendly' : 'Booked via Calendly — no counsellor free, assign manually');
    const appointment = (await fetchAppointment(conn, id))!;
    await syncTask(conn, appointment, ACTOR);
    return { action: 'created', appointment };
  });
}

/** Tell the internal counsellor(s) — Calendly already emails the applicant. */
async function notifyCounsellor(result: ProcessResult) {
  const a = result.appointment;
  if (!a) return;
  const pool = getPool();
  const kind = result.action === 'cancelled' ? 'cancelled' : result.action === 'rescheduled' ? 'rescheduled' : result.action === 'created' ? 'assigned' : null;
  if (!kind) return;
  try {
    const email = await getCounsellorEmail(pool, a.counsellor_user_id);
    if (email) await sendCounsellorNotification(a, email, kind);
    if (kind === 'rescheduled' && result.previousCounsellor && result.previousCounsellor !== a.counsellor_user_id) {
      const prev = await getCounsellorEmail(pool, result.previousCounsellor);
      if (prev) await sendCounsellorNotification(a, prev, 'cancelled');
    }
  } catch (err) {
    console.error('[calendly] counsellor notification failed', a.appointment_code, err);
  }
}

/** Fetch fresh invitee + event from Calendly (never trust webhook bodies) and upsert. */
export async function syncInviteeByUri(inviteeUri: string): Promise<SyncAction> {
  await ensureAppointmentTables();
  const invitee = (await calendly(inviteeUri)).resource;
  const event = (await calendly(invitee.event)).resource;
  const result = await processInvitee(invitee, event);
  await notifyCounsellor(result);
  return result.action;
}

// ── Pull sync (cron backstop + "Sync now") ──────────────────────────────

async function currentOrganization(): Promise<{ org: string; user: string }> {
  const me = (await calendly('/users/me')).resource;
  return { org: me.current_organization, user: me.uri };
}

export async function syncCalendly(opts: { daysBack?: number; daysAhead?: number } = {}) {
  await ensureAppointmentTables();
  const { org } = await currentOrganization();
  const min = new Date(Date.now() - (opts.daysBack ?? 3) * 86400000).toISOString();
  const max = new Date(Date.now() + (opts.daysAhead ?? 120) * 86400000).toISOString();

  const counts: Record<SyncAction | 'errors' | 'events', number> = {
    events: 0, created: 0, rescheduled: 0, cancelled: 0, no_show: 0, updated: 0, unchanged: 0, skipped: 0, errors: 0,
  };
  const errors: string[] = [];

  let url: string | null =
    `/scheduled_events?organization=${encodeURIComponent(org)}&min_start_time=${encodeURIComponent(min)}` +
    `&max_start_time=${encodeURIComponent(max)}&count=100&sort=start_time:asc`;
  while (url) {
    const page: any = await calendly(url);
    for (const event of page.collection ?? []) {
      counts.events++;
      let invUrl: string | null = `${event.uri}/invitees?count=100`;
      while (invUrl) {
        const inv: any = await calendly(invUrl);
        // Cancelled invitees first, then active ones, so a reschedule's old/new pair resolves deterministically.
        const list = [...(inv.collection ?? [])].sort((a: any, b: any) => Number(b.status === 'canceled') - Number(a.status === 'canceled'));
        for (const invitee of list) {
          try {
            const result = await processInvitee(invitee, event);
            counts[result.action]++;
            await notifyCounsellor(result);
          } catch (err) {
            counts.errors++;
            errors.push(`${invitee.email}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        invUrl = inv.pagination?.next_page || null;
      }
    }
    url = page.pagination?.next_page || null;
  }

  const summary = { at: new Date().toISOString(), counts, errors: errors.slice(0, 10) };
  await setIntegration('calendly_last_sync', JSON.stringify(summary));
  return summary;
}

// ── Webhook subscription management ────────────────────────────────────

const WEBHOOK_EVENTS = ['invitee.created', 'invitee.canceled', 'invitee_no_show.created', 'invitee_no_show.deleted'];

export async function calendlyStatus(callbackUrl: string) {
  await ensureAppointmentTables();
  const lastSync = await getIntegration('calendly_last_sync');
  if (!calendlyConfigured()) return { configured: false, lastSync: lastSync ? JSON.parse(lastSync) : null };
  const me = (await calendly('/users/me')).resource;
  let webhook: any = null;
  let webhookError: string | null = null;
  try {
    const subs = await calendly(`/webhook_subscriptions?organization=${encodeURIComponent(me.current_organization)}&scope=organization&count=100`);
    webhook = (subs.collection ?? []).find((s: any) => s.callback_url === callbackUrl) ?? null;
  } catch (err) {
    webhookError = err instanceof Error ? err.message : String(err);
  }
  return {
    configured: true,
    account: { name: me.name, email: me.email, scheduling_url: me.scheduling_url },
    webhook: webhook ? { state: webhook.state, events: webhook.events, created_at: webhook.created_at, callback_url: webhook.callback_url } : null,
    webhookError,
    hasSigningKey: Boolean(await getIntegration('calendly_signing_key')),
    lastSync: lastSync ? JSON.parse(lastSync) : null,
  };
}

/** (Re)create the organization webhook pointing at this deployment. */
export async function connectCalendlyWebhook(callbackUrl: string) {
  await ensureAppointmentTables();
  if (!/^https:\/\//.test(callbackUrl)) throw new Error('Calendly webhooks need a public https URL — connect from the deployed site, not localhost.');
  const { org, user } = await currentOrganization();

  const subs = await calendly(`/webhook_subscriptions?organization=${encodeURIComponent(org)}&scope=organization&count=100`);
  for (const s of subs.collection ?? []) {
    if (s.callback_url === callbackUrl) await calendly(s.uri, { method: 'DELETE' });
  }

  const signingKey = randomBytes(32).toString('hex');
  const created = await calendly('/webhook_subscriptions', {
    method: 'POST',
    body: JSON.stringify({ url: callbackUrl, events: WEBHOOK_EVENTS, organization: org, user, scope: 'organization', signing_key: signingKey }),
  });
  await setIntegration('calendly_signing_key', signingKey);
  return created.resource;
}

/** Verify `Calendly-Webhook-Signature: t=<ts>,v1=<hex>` over "<ts>.<raw body>". */
export async function verifyCalendlySignature(header: string | null, rawBody: string): Promise<boolean> {
  const key = process.env.CALENDLY_WEBHOOK_SIGNING_KEY?.trim() || (await getIntegration('calendly_signing_key'));
  if (!key || !header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=') as [string, string]));
  const t = Number(parts.t);
  if (!parts.v1 || !Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > 5 * 60) return false;
  const expected = createHmac('sha256', key).update(`${parts.t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(parts.v1, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
