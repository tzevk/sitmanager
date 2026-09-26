'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from 'react';

// ── Types & formatting ─────────────────────────────────────────────────

export type ApptStatus = 'Scheduled' | 'Completed' | 'No Show' | 'Cancelled';
export type ApptMode = 'online' | 'offline';

export interface Appointment {
  id: number;
  appointment_code: string;
  first_name: string;
  last_name: string;
  mobile: string;
  email: string;
  qualification: string | null;
  experience: string | null;
  course_id: number | null;
  program_name: string | null;
  needs_guidance: number;
  mode: ApptMode;
  appt_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  counsellor_user_id: number | null;
  counsellor_name: string | null;
  status: ApptStatus;
  meeting_link: string | null;
  location: string | null;
  notes: string | null;
  reschedule_count: number;
  source: string;
  email_error: string | null;
  created_at: string;
}

export const STATUSES: ApptStatus[] = ['Scheduled', 'Completed', 'No Show', 'Cancelled'];

export function fmt12(t: string | null | undefined) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function fmtDate(d: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-IN', { ...opts, timeZone: 'UTC' });
}

export function programOf(a: Pick<Appointment, 'needs_guidance' | 'program_name'>) {
  return a.needs_guidance ? 'Need guidance' : (a.program_name || '—');
}

/** Scheduled appointments whose end time has passed are "Pending" (awaiting outcome). */
export function isPending(a: Appointment, today: string, nowTime: string) {
  return a.status === 'Scheduled' && (a.appt_date < today || (a.appt_date === today && a.start_time <= nowTime));
}

export function localNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${String(Number(g('hour')) % 24).padStart(2, '0')}:${g('minute')}` };
}

export function statusCls(status: ApptStatus | 'Pending') {
  switch (status) {
    case 'Completed': return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
    case 'No Show': return 'bg-orange-100 text-orange-700 ring-orange-200';
    case 'Cancelled': return 'bg-rose-100 text-rose-700 ring-rose-200';
    case 'Pending': return 'bg-amber-100 text-amber-800 ring-amber-200';
    default: return 'bg-blue-100 text-blue-700 ring-blue-200';
  }
}

export function StatusBadge({ appt }: { appt: Appointment }) {
  const now = localNow();
  const label = isPending(appt, now.date, now.time) ? 'Pending' : appt.status;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${statusCls(label)}`}>{label}</span>;
}

export function ModeBadge({ mode }: { mode: ApptMode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${mode === 'online' ? 'bg-sky-100 text-sky-700' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'}`}>
      {mode === 'online' ? 'Online' : 'Offline'}
    </span>
  );
}

export const btnPrimary = 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#2E3093] px-3 py-2 text-xs font-semibold text-white hover:bg-[#252780] disabled:opacity-60 transition-colors';
export const btnGhost = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors';
export const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]';
export const labelCls = 'block text-[11px] font-semibold text-gray-600 mb-1';

async function patch(id: number, body: any) {
  const r = await fetch(`/api/appointments/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.success) throw new Error(d.error || d.message || 'Action failed');
  return d.appointment as Appointment;
}

// ── Detail modal with all actions + history ─────────────────────────────

type Panel = null | 'edit' | 'reschedule' | 'reassign' | 'status';

export function AppointmentDetailModal({
  id, onClose, onChanged,
}: { id: number; onClose: () => void; onChanged?: () => void }) {
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<Panel>(null);
  const [pendingStatus, setPendingStatus] = useState<ApptStatus | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetch(`/api/appointments/${id}`, { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!active) return;
        if (!r.ok || !d.success) { setError(d.error || 'Unable to load appointment'); return; }
        setError('');
        setAppt(d.appointment);
        setHistory(d.history || []);
        setCanManage(Boolean(d.canManage));
      })
      .catch(() => { if (active) setError('Unable to load appointment'); });
    return () => { active = false; };
  }, [id, reloadKey]);

  const done = () => { setPanel(null); setPendingStatus(null); setReloadKey((k) => k + 1); onChanged?.(); };

  const now = localNow();
  const isFutureStart = appt ? (appt.appt_date > now.date || (appt.appt_date === now.date && appt.start_time > now.time)) : false;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <p className="font-mono text-xs font-bold text-[#2E3093]">{appt?.appointment_code ?? '…'}</p>
            <h3 className="truncate text-base font-bold text-gray-900">{appt ? `${appt.first_name} ${appt.last_name}` : 'Loading…'}</h3>
            {appt && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <StatusBadge appt={appt} />
                <ModeBadge mode={appt.mode} />
                {appt.reschedule_count > 0 && <span className="text-[11px] text-gray-500">Rescheduled ×{appt.reschedule_count}</span>}
              </div>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Close">✕</button>
        </div>

        {error && <p className="mx-5 mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        {appt && (
          <div className="max-h-[75vh] overflow-y-auto px-5 py-4 space-y-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Info label="Date" value={fmtDate(appt.appt_date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} />
              <Info label="Time" value={`${fmt12(appt.start_time)} – ${fmt12(appt.end_time)} (${appt.duration_minutes} min)`} />
              <Info label="Training program" value={programOf(appt)} />
              <Info label="Counsellor" value={appt.counsellor_name || '—'} />
              <Info label="Mobile" value={<a className="text-[#2E3093]" href={`tel:${appt.mobile}`}>{appt.mobile}</a>} />
              <Info label="Email" value={<a className="text-[#2E3093] break-all" href={`mailto:${appt.email}`}>{appt.email}</a>} />
              <Info label="Qualification" value={appt.qualification || '—'} />
              <Info label="Experience" value={appt.experience || '—'} />
              {appt.mode === 'online'
                ? <Info label="Meeting link" value={appt.meeting_link ? <a className="text-[#2E3093] break-all" href={appt.meeting_link} target="_blank" rel="noreferrer">{appt.meeting_link}</a> : <span className="text-amber-600">Not set</span>} />
                : <Info label="Location" value={appt.location || '—'} />}
              <Info label="Booked" value={`${fmtDate(appt.created_at)} · ${appt.source === 'public' ? 'Website' : 'Staff'}`} />
              {appt.notes && <div className="sm:col-span-2"><Info label="Notes" value={<span className="whitespace-pre-wrap">{appt.notes}</span>} /></div>}
              {appt.email_error && <div className="sm:col-span-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Email issue: {appt.email_error}</div>}
            </dl>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
              <button className={btnGhost} onClick={() => setPanel(panel === 'edit' ? null : 'edit')} disabled={appt.status === 'Cancelled'}>Edit</button>
              {(appt.status === 'Scheduled' || appt.status === 'No Show') && (
                <button className={btnGhost} onClick={() => setPanel(panel === 'reschedule' ? null : 'reschedule')}>Reschedule</button>
              )}
              {canManage && appt.status === 'Scheduled' && (
                <button className={btnGhost} onClick={() => setPanel(panel === 'reassign' ? null : 'reassign')}>Reassign counsellor</button>
              )}
              {(appt.status === 'Scheduled' || appt.status === 'No Show') && (
                <button className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700" onClick={() => { setPendingStatus('Completed'); setPanel('status'); }}>Mark Completed</button>
              )}
              {(appt.status === 'Scheduled' || appt.status === 'Completed') && !isFutureStart && (
                <button className="inline-flex items-center rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600" onClick={() => { setPendingStatus('No Show'); setPanel('status'); }}>Mark No Show</button>
              )}
              {(appt.status === 'Scheduled' || appt.status === 'No Show') && (
                <button className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100" onClick={() => { setPendingStatus('Cancelled'); setPanel('status'); }}>Cancel</button>
              )}
            </div>

            {panel === 'edit' && <EditPanel appt={appt} onDone={done} />}
            {panel === 'reschedule' && <ReschedulePanel appt={appt} onDone={done} />}
            {panel === 'reassign' && <ReassignPanel appt={appt} onDone={done} />}
            {panel === 'status' && pendingStatus && <StatusPanel appt={appt} status={pendingStatus} onDone={done} onCancel={() => setPanel(null)} />}

            {/* History */}
            <div className="border-t border-gray-100 pt-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">History</p>
              <ol className="space-y-1.5">
                {history.map((h) => (
                  <li key={h.id} className="text-xs text-gray-600">
                    <span className="text-gray-400">{String(h.created_at).slice(0, 16).replace('T', ' ')}</span>{' · '}
                    <span className="font-semibold capitalize text-gray-800">{h.action}</span>
                    {(h.from_value || h.to_value) && <> {h.from_value && <span className="line-through text-gray-400">{h.from_value}</span>} {h.to_value && <>→ {h.to_value}</>}</>}
                    {h.note && <span className="italic"> — {h.note}</span>}
                    <span className="text-gray-400"> · {h.actor_name}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="font-medium text-gray-800">{value}</dd>
    </div>
  );
}

function PanelShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#2E3093]/15 bg-[#2E3093]/[0.03] p-3">
      <p className="mb-2 text-xs font-bold text-[#2E3093]">{title}</p>
      {children}
    </div>
  );
}

function useAction(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr('');
    try { await fn(); onDone(); } catch (e) { setErr(e instanceof Error ? e.message : 'Action failed'); } finally { setBusy(false); }
  };
  return { busy, err, run };
}

function EditPanel({ appt, onDone }: { appt: Appointment; onDone: () => void }) {
  const [f, setF] = useState({
    first_name: appt.first_name, last_name: appt.last_name, mobile: appt.mobile, email: appt.email,
    qualification: appt.qualification || '', experience: appt.experience || '', notes: appt.notes || '',
    meeting_link: appt.meeting_link || '', location: appt.location || '',
    course_id: appt.needs_guidance ? 'guidance' : String(appt.course_id ?? ''),
  });
  const [programs, setPrograms] = useState<{ id: number; name: string }[]>([]);
  const { busy, err, run } = useAction(onDone);
  useEffect(() => { fetch('/api/public/appointments/config').then((r) => r.json()).then((d) => setPrograms(d.programs || [])).catch(() => {}); }, []);
  const s = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <PanelShell title="Edit details">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label><span className={labelCls}>First name</span><input className={inputCls} value={f.first_name} onChange={s('first_name')} /></label>
        <label><span className={labelCls}>Last name</span><input className={inputCls} value={f.last_name} onChange={s('last_name')} /></label>
        <label><span className={labelCls}>Mobile</span><input className={inputCls} value={f.mobile} onChange={s('mobile')} /></label>
        <label><span className={labelCls}>Email</span><input className={inputCls} value={f.email} onChange={s('email')} /></label>
        <label><span className={labelCls}>Qualification</span><input className={inputCls} value={f.qualification} onChange={s('qualification')} /></label>
        <label><span className={labelCls}>Experience</span><input className={inputCls} value={f.experience} onChange={s('experience')} /></label>
        <label className="sm:col-span-2"><span className={labelCls}>Training program</span>
          <select className={inputCls} value={f.course_id} onChange={s('course_id')}>
            <option value="guidance">Need guidance</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        {appt.mode === 'online'
          ? <label className="sm:col-span-2"><span className={labelCls}>Meeting link</span><input className={inputCls} value={f.meeting_link} onChange={s('meeting_link')} placeholder="https://meet.google.com/…" /></label>
          : <label className="sm:col-span-2"><span className={labelCls}>Location</span><input className={inputCls} value={f.location} onChange={s('location')} /></label>}
        <label className="sm:col-span-2"><span className={labelCls}>Notes / counsellor recommendation</span><textarea className={inputCls} rows={3} value={f.notes} onChange={s('notes')} /></label>
      </div>
      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
      <div className="mt-2 flex justify-end">
        <button className={btnPrimary} disabled={busy} onClick={() => run(() => patch(appt.id, { action: 'edit', ...f, course_id: f.course_id === 'guidance' ? 'guidance' : Number(f.course_id) }))}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </PanelShell>
  );
}

function ReschedulePanel({ appt, onDone }: { appt: Appointment; onDone: () => void }) {
  const [date, setDate] = useState(appt.appt_date);
  const [mode, setMode] = useState<ApptMode>(appt.mode);
  const [result, setResult] = useState<{ key: string; slots: any[]; closed: string | null } | null>(null);
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const { busy, err, run } = useAction(onDone);

  const key = `${date}|${mode}`;
  const loading = result?.key !== key;
  const slots = loading ? [] : result!.slots;
  const closed = loading ? null : result!.closed;

  useEffect(() => {
    let active = true;
    fetch(`/api/appointments/slots?date=${date}&mode=${mode}&exclude=${appt.id}&duration=${appt.duration_minutes}`)
      .then((r) => r.json())
      .then((d) => { if (active) setResult({ key: `${date}|${mode}`, slots: d.slots || [], closed: d.closedReason || null }); })
      .catch(() => { if (active) setResult({ key: `${date}|${mode}`, slots: [], closed: null }); });
    return () => { active = false; };
  }, [date, mode, appt.id, appt.duration_minutes]);

  const selected = slots.find((s) => s.time === time);
  const keepsCounsellor = selected?.counsellors?.some((c: any) => c.user_id === appt.counsellor_user_id);

  return (
    <PanelShell title="Reschedule">
      <div className="flex flex-wrap gap-2">
        <label><span className={labelCls}>Date</span><input type="date" className={inputCls} value={date} onChange={(e) => { setDate(e.target.value); setTime(''); }} /></label>
        <label><span className={labelCls}>Mode</span>
          <select className={inputCls} value={mode} onChange={(e) => { setMode(e.target.value as ApptMode); setTime(''); }}>
            <option value="offline">Offline</option><option value="online">Online</option>
          </select>
        </label>
      </div>
      <div className="mt-2">
        {loading ? <p className="text-xs text-gray-400">Loading slots…</p> : closed ? <p className="text-xs text-rose-600">Closed — {closed}</p> : (
          <div className="flex flex-wrap gap-1.5">
            {slots.length === 0 && <p className="text-xs text-gray-500">No slots on this date.</p>}
            {slots.map((s) => (
              <button key={s.time} disabled={!s.available} onClick={() => setTime(s.time)}
                title={s.available ? s.counsellors.map((c: any) => c.name).join(', ') : 'No counsellor free'}
                className={`rounded-md border px-2 py-1 text-xs font-semibold ${time === s.time ? 'border-[#2E3093] bg-[#2E3093] text-white' : s.available ? 'border-gray-200 bg-white hover:border-[#2E3093]/50' : 'border-gray-100 bg-gray-50 text-gray-300 line-through'}`}>
                {fmt12(s.time)}
              </button>
            ))}
          </div>
        )}
      </div>
      {selected && (
        <p className="mt-2 text-xs text-gray-600">
          {keepsCounsellor ? `${appt.counsellor_name} is free — they will keep this appointment.` : `${appt.counsellor_name || 'Current counsellor'} is busy then — it will be fairly reassigned to one of: ${selected.counsellors.map((c: any) => c.name).join(', ')}.`}
        </p>
      )}
      <input className={`${inputCls} mt-2`} placeholder="Reason (optional, saved in history)" value={note} onChange={(e) => setNote(e.target.value)} />
      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
      <div className="mt-2 flex justify-end">
        <button className={btnPrimary} disabled={busy || !time} onClick={() => run(() => patch(appt.id, { action: 'reschedule', date, time, mode, note }))}>
          {busy ? 'Rescheduling…' : 'Confirm reschedule'}
        </button>
      </div>
    </PanelShell>
  );
}

function ReassignPanel({ appt, onDone }: { appt: Appointment; onDone: () => void }) {
  const [options, setOptions] = useState<{ user_id: number; name: string }[]>([]);
  const [target, setTarget] = useState<string>('auto');
  const [note, setNote] = useState('');
  const { busy, err, run } = useAction(onDone);

  useEffect(() => {
    fetch(`/api/appointments/slots?date=${appt.appt_date}&mode=${appt.mode}&exclude=${appt.id}&duration=${appt.duration_minutes}`)
      .then((r) => r.json())
      .then((d) => {
        const slot = (d.slots || []).find((s: any) => s.time === appt.start_time);
        setOptions((slot?.counsellors || []).filter((c: any) => c.user_id !== appt.counsellor_user_id));
      });
  }, [appt]);

  return (
    <PanelShell title="Reassign counsellor">
      <p className="mb-2 text-xs text-gray-500">Only counsellors free at {fmt12(appt.start_time)} on {fmtDate(appt.appt_date)} are listed.</p>
      <select className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="auto">Auto — fairest available counsellor</option>
        {options.map((c) => <option key={c.user_id} value={c.user_id}>{c.name}</option>)}
      </select>
      {options.length === 0 && <p className="mt-1 text-xs text-amber-700">No other counsellor is free for this slot. Reschedule instead.</p>}
      <input className={`${inputCls} mt-2`} placeholder="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
      <div className="mt-2 flex justify-end">
        <button className={btnPrimary} disabled={busy || options.length === 0} onClick={() => run(() => patch(appt.id, { action: 'reassign', counsellor_user_id: target === 'auto' ? 'auto' : Number(target), note }))}>
          {busy ? 'Reassigning…' : 'Reassign'}
        </button>
      </div>
    </PanelShell>
  );
}

function StatusPanel({ appt, status, onDone, onCancel }: { appt: Appointment; status: ApptStatus; onDone: () => void; onCancel: () => void }) {
  const [note, setNote] = useState('');
  const { busy, err, run } = useAction(onDone);
  const verb = status === 'Cancelled' ? 'Cancel appointment' : `Mark ${status}`;
  return (
    <PanelShell title={verb}>
      <input className={inputCls} placeholder={status === 'Cancelled' ? 'Reason for cancellation' : 'Note (optional)'} value={note} onChange={(e) => setNote(e.target.value)} />
      {status === 'Cancelled' && <p className="mt-1 text-xs text-gray-500">This frees the slot for other applicants. It cannot be undone.</p>}
      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button className={btnGhost} onClick={onCancel} disabled={busy}>Back</button>
        <button className={btnPrimary} disabled={busy} onClick={() => run(() => patch(appt.id, { action: 'status', status, note }))}>{busy ? 'Saving…' : verb}</button>
      </div>
    </PanelShell>
  );
}
