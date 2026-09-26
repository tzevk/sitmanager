'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { btnGhost, btnPrimary, fmt12, fmtDate, inputCls, labelCls, localNow } from '../_components/shared';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
type Tab = 'general' | 'exceptions' | 'counsellors' | 'calendly';

interface Counsellor {
  user_id: number; emp_id: number | null; display_name: string; email: string | null; phone: string | null;
  is_active: number; modes: string; use_custom_hours: number; working_days: string | null;
  start_time: string | null; end_time: string | null; meeting_link: string | null;
}

async function api(path: string, method: string, body?: unknown) {
  const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.success) throw new Error(d.error || d.message || 'Request failed');
  return d;
}

const csvToDays = (csv: string | null | undefined) => String(csv ?? '').split(',').filter((x) => x !== '').map(Number);

function DayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {DAYS.map((d, i) => {
        const on = value.includes(i);
        return (
          <button key={d} type="button" onClick={() => onChange(on ? value.filter((x) => x !== i) : [...value, i].sort())}
            className={`w-11 rounded-md border py-1.5 text-xs font-semibold ${on ? 'border-[#2E3093] bg-[#2E3093] text-white' : 'border-gray-200 bg-white text-gray-500'}`}>
            {d}
          </button>
        );
      })}
    </div>
  );
}

function Card({ title, subtitle, children, right }: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div><h2 className="text-sm font-bold text-gray-800">{title}</h2>{subtitle && <p className="text-[11px] text-gray-500">{subtitle}</p>}</div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function SchedulingSettingsPage() {
  const [tab, setTab] = useState<Tab>('general');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [previewKey, setPreviewKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/appointments/settings', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || d.message || 'Unable to load settings');
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load settings');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const saved = (msg = 'Saved — appointment slots updated.') => {
    setFlash(msg); setPreviewKey((k) => k + 1); load();
    setTimeout(() => setFlash(''), 3000);
  };

  if (error) return <p className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-gray-400">Loading…</p>;
  const canWrite = Boolean(data.canWrite);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Scheduling Settings</h1>
          <p className="text-sm text-gray-500">Changes apply immediately to available appointment slots.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/appointments/calendar" className={btnGhost}>Calendar</Link>
        </div>
      </div>

      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
        {([['general', 'General availability'], ['exceptions', 'Holidays, blocks & breaks'], ['counsellors', `Counsellors (${data.counsellors.length})`], ['calendly', 'Calendly']] as [Tab, string][]).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${tab === t ? 'bg-[#2E3093] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{l}</button>
        ))}
      </div>

      {flash && <p className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-700">{flash}</p>}
      {!canWrite && <p className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-xs text-amber-800">Read-only — you need “Manage Appointment Settings” to change these.</p>}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 items-start">
        <div className="space-y-4">
          {tab === 'general' && <GeneralTab settings={data.settings} canWrite={canWrite} onSaved={saved} />}
          {tab === 'exceptions' && <ExceptionsTab exceptions={data.exceptions} breaks={data.breaks} canWrite={canWrite} onSaved={saved} />}
          {tab === 'counsellors' && <CounsellorsTab data={data} canWrite={canWrite} onSaved={saved} />}
          {tab === 'calendly' && <CalendlyTab canWrite={canWrite} />}
        </div>
        <SlotPreview refreshKey={previewKey} />
      </div>
    </div>
  );
}

// ── General ───────────────────────────────────────────────────────────

function GeneralTab({ settings, canWrite, onSaved }: { settings: any; canWrite: boolean; onSaved: (m?: string) => void }) {
  const [f, setF] = useState({ ...settings, working_days: csvToDays(settings.working_days), use_holiday_master: Boolean(settings.use_holiday_master) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const s = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setBusy(true); setErr('');
    try {
      await api('/api/appointments/settings', 'PUT', {
        ...f, slot_minutes: Number(f.slot_minutes), booking_window_days: Number(f.booking_window_days), min_notice_minutes: Number(f.min_notice_minutes),
      });
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Unable to save'); } finally { setBusy(false); }
  };

  return (
    <>
      <Card title="Working days & hours" subtitle="Default for all counsellors (individual counsellors can override).">
        <fieldset disabled={!canWrite} className="space-y-3">
          <div><span className={labelCls}>Working days</span><DayPicker value={f.working_days} onChange={(v) => setF({ ...f, working_days: v })} /></div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <label><span className={labelCls}>Start time</span><input type="time" className={inputCls} value={f.start_time} onChange={s('start_time')} /></label>
            <label><span className={labelCls}>End time</span><input type="time" className={inputCls} value={f.end_time} onChange={s('end_time')} /></label>
            <label><span className={labelCls}>Duration (min)</span><input type="number" min={10} max={240} step={5} className={inputCls} value={f.slot_minutes} onChange={s('slot_minutes')} /></label>
            <label><span className={labelCls}>Bookable ahead (days)</span><input type="number" min={1} max={180} className={inputCls} value={f.booking_window_days} onChange={s('booking_window_days')} /></label>
            <label><span className={labelCls}>Min. notice (min)</span><input type="number" min={0} max={2880} step={15} className={inputCls} value={f.min_notice_minutes} onChange={s('min_notice_minutes')} /></label>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={f.use_holiday_master} onChange={(e) => setF({ ...f, use_holiday_master: e.target.checked })} />
            Close on holidays from <Link href="/dashboard/masters/holiday" className="text-[#2E3093] underline">Holiday Master</Link>
          </label>
        </fieldset>
      </Card>
      <Card title="Location & contact" subtitle="Shown on the confirmation page and in emails.">
        <fieldset disabled={!canWrite} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="sm:col-span-2"><span className={labelCls}>Office address (offline appointments)</span><textarea rows={2} className={inputCls} value={f.office_address || ''} onChange={s('office_address')} /></label>
          <label className="sm:col-span-2"><span className={labelCls}>Default online meeting link (used when a counsellor has none)</span><input className={inputCls} value={f.default_meeting_link || ''} onChange={s('default_meeting_link')} placeholder="https://meet.google.com/…" /></label>
          <label><span className={labelCls}>Contact phone</span><input className={inputCls} value={f.contact_phone || ''} onChange={s('contact_phone')} /></label>
          <label><span className={labelCls}>Contact email</span><input className={inputCls} value={f.contact_email || ''} onChange={s('contact_email')} /></label>
        </fieldset>
      </Card>
      {err && <p className="text-sm text-rose-600">{err}</p>}
      {canWrite && <div className="flex justify-end"><button className={btnPrimary} onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></div>}
    </>
  );
}

// ── Exceptions & breaks ─────────────────────────────────────────────────

function ExceptionsTab({ exceptions, breaks, canWrite, onSaved }: { exceptions: any[]; breaks: any[]; canWrite: boolean; onSaved: (m?: string) => void }) {
  const [exc, setExc] = useState({ date: '', end_date: '', exc_type: 'holiday', label: '', start_time: '', end_time: '' });
  const [brk, setBrk] = useState({ label: 'Lunch break', start_time: '13:00', end_time: '13:30', weekdays: [] as number[] });
  const [err, setErr] = useState('');

  const run = async (fn: () => Promise<unknown>, msg?: string) => {
    setErr('');
    try { await fn(); onSaved(msg); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
  };

  return (
    <>
      {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
      <Card title="Holidays & blocked dates" subtitle="Whole day, or a time range for everyone. Holiday Master dates are applied automatically.">
        {canWrite && (
          <div className="mb-4 grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
            <label><span className={labelCls}>From</span><input type="date" className={inputCls} value={exc.date} onChange={(e) => setExc({ ...exc, date: e.target.value })} /></label>
            <label><span className={labelCls}>To (optional)</span><input type="date" className={inputCls} value={exc.end_date} onChange={(e) => setExc({ ...exc, end_date: e.target.value })} /></label>
            <label><span className={labelCls}>Type</span>
              <select className={inputCls} value={exc.exc_type} onChange={(e) => setExc({ ...exc, exc_type: e.target.value })}><option value="holiday">Holiday</option><option value="blocked">Blocked</option></select>
            </label>
            <label><span className={labelCls}>From time</span><input type="time" className={inputCls} value={exc.start_time} onChange={(e) => setExc({ ...exc, start_time: e.target.value })} /></label>
            <label><span className={labelCls}>To time</span><input type="time" className={inputCls} value={exc.end_time} onChange={(e) => setExc({ ...exc, end_time: e.target.value })} /></label>
            <label><span className={labelCls}>Label</span><input className={inputCls} value={exc.label} onChange={(e) => setExc({ ...exc, label: e.target.value })} placeholder="e.g. Diwali" /></label>
            <div className="col-span-2 sm:col-span-6 flex justify-end">
              <button className={btnPrimary} disabled={!exc.date} onClick={() => run(() => api('/api/appointments/settings/exceptions', 'POST', exc))}>Add</button>
            </div>
          </div>
        )}
        {exceptions.length === 0 ? <p className="text-sm text-gray-400">No upcoming holidays or blocked dates.</p> : (
          <ul className="divide-y divide-gray-100 text-sm">
            {exceptions.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2">
                <span className="w-32 font-semibold text-gray-800">{fmtDate(e.exc_date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${e.exc_type === 'holiday' ? 'bg-violet-100 text-violet-700' : 'bg-rose-100 text-rose-700'}`}>{e.exc_type}</span>
                <span className="text-gray-600">{e.start_time ? `${fmt12(e.start_time)} – ${fmt12(e.end_time)}` : 'Whole day'}</span>
                <span className="flex-1 truncate text-gray-500">{e.label}</span>
                {canWrite && <button className="text-xs font-semibold text-rose-600 hover:underline" onClick={() => run(() => api(`/api/appointments/settings/exceptions?id=${e.id}`, 'DELETE'), 'Removed.')}>Remove</button>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Break periods" subtitle="Recurring breaks when no appointments are offered.">
        {canWrite && (
          <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
            <label><span className={labelCls}>Label</span><input className={inputCls} value={brk.label} onChange={(e) => setBrk({ ...brk, label: e.target.value })} /></label>
            <label><span className={labelCls}>From</span><input type="time" className={inputCls} value={brk.start_time} onChange={(e) => setBrk({ ...brk, start_time: e.target.value })} /></label>
            <label><span className={labelCls}>To</span><input type="time" className={inputCls} value={brk.end_time} onChange={(e) => setBrk({ ...brk, end_time: e.target.value })} /></label>
            <div className="flex justify-end"><button className={btnPrimary} onClick={() => run(() => api('/api/appointments/settings/breaks', 'POST', brk))}>Add break</button></div>
            <div className="col-span-2 sm:col-span-4"><span className={labelCls}>Days (none selected = every working day)</span><DayPicker value={brk.weekdays} onChange={(v) => setBrk({ ...brk, weekdays: v })} /></div>
          </div>
        )}
        {breaks.length === 0 ? <p className="text-sm text-gray-400">No breaks configured.</p> : (
          <ul className="divide-y divide-gray-100 text-sm">
            {breaks.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-2">
                <span className="w-40 font-semibold text-gray-800">{fmt12(b.start_time)} – {fmt12(b.end_time)}</span>
                <span className="flex-1 text-gray-600">{b.label} · {b.weekdays ? csvToDays(b.weekdays).map((d) => DAYS[d]).join(', ') : 'Every day'}</span>
                {canWrite && (
                  <>
                    <button className="text-xs font-semibold text-gray-600 hover:underline" onClick={() => run(() => api('/api/appointments/settings/breaks', 'POST', { ...b, weekdays: b.weekdays ? csvToDays(b.weekdays) : [], is_active: !b.is_active }))}>
                      {b.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button className="text-xs font-semibold text-rose-600 hover:underline" onClick={() => run(() => api(`/api/appointments/settings/breaks?id=${b.id}`, 'DELETE'), 'Removed.')}>Remove</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

// ── Counsellors ─────────────────────────────────────────────────────────

const emptyCounsellor = { user_id: '', emp_id: '', display_name: '', email: '', phone: '', is_active: true, modes: 'both', use_custom_hours: false, working_days: [1, 2, 3, 4, 5, 6] as number[], start_time: '09:00', end_time: '16:00', meeting_link: '' };

function CounsellorsTab({ data, canWrite, onSaved }: { data: any; canWrite: boolean; onSaved: (m?: string) => void }) {
  const [editing, setEditing] = useState<typeof emptyCounsellor | null>(null);
  const [blocksFor, setBlocksFor] = useState<Counsellor | null>(null);
  const [err, setErr] = useState('');
  const counsellors: Counsellor[] = data.counsellors;
  const enrolled = new Set(counsellors.map((c) => c.user_id));

  const edit = (c?: Counsellor) => {
    setErr('');
    setEditing(c ? {
      user_id: String(c.user_id), emp_id: c.emp_id ? String(c.emp_id) : '', display_name: c.display_name, email: c.email || '', phone: c.phone || '',
      is_active: Boolean(c.is_active), modes: c.modes, use_custom_hours: Boolean(c.use_custom_hours),
      working_days: c.working_days ? csvToDays(c.working_days) : [1, 2, 3, 4, 5, 6], start_time: c.start_time || '09:00', end_time: c.end_time || '16:00',
      meeting_link: c.meeting_link || '',
    } : { ...emptyCounsellor });
  };

  const save = async () => {
    if (!editing) return;
    setErr('');
    try {
      await api('/api/appointments/settings/counsellors', 'POST', { ...editing, user_id: Number(editing.user_id), emp_id: Number(editing.emp_id) || null });
      setEditing(null); onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Unable to save'); }
  };

  return (
    <>
      <Card
        title="Counsellors"
        subtitle="Only active counsellors contribute to public slots. Appointments are distributed fairly among free counsellors."
        right={canWrite ? <button className={btnPrimary} onClick={() => edit()}>Add counsellor</button> : undefined}
      >
        {counsellors.length === 0 ? (
          <p className="text-sm text-amber-700">No counsellors yet — the public page shows no slots until at least one active counsellor is added.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] font-bold uppercase tracking-wide text-gray-400">
                <tr><th className="py-2">Name</th><th>Status</th><th>Modes</th><th>Hours</th><th>Email</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {counsellors.map((c) => (
                  <tr key={c.user_id}>
                    <td className="py-2 font-semibold text-gray-800">{c.display_name}</td>
                    <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${c.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{c.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td className="capitalize text-gray-600">{c.modes}</td>
                    <td className="text-gray-600">{c.use_custom_hours ? `${csvToDays(c.working_days).map((d) => DAYS[d]).join(', ')} · ${fmt12(c.start_time)}–${fmt12(c.end_time)}` : 'Default'}</td>
                    <td className="text-gray-500">{c.email || <span className="text-amber-600">none</span>}</td>
                    <td className="whitespace-nowrap text-right">
                      <button className="text-xs font-semibold text-[#2E3093] hover:underline" onClick={() => setBlocksFor(c)}>Blocked time</button>
                      {canWrite && <button className="ml-3 text-xs font-semibold text-gray-600 hover:underline" onClick={() => edit(c)}>Edit</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <Card title={enrolled.has(Number(editing.user_id)) ? 'Edit counsellor' : 'Add counsellor'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label><span className={labelCls}>Login user</span>
              <select className={inputCls} value={editing.user_id} disabled={enrolled.has(Number(editing.user_id))}
                onChange={(e) => {
                  const u = data.users.find((x: any) => String(x.id) === e.target.value);
                  setEditing({ ...editing, user_id: e.target.value, display_name: u?.name || '', email: u?.email || '', phone: u?.mobile || '' });
                }}>
                <option value="">Select user</option>
                {data.users.filter((u: any) => !enrolled.has(u.id) || String(u.id) === editing.user_id).map((u: any) => <option key={u.id} value={u.id}>{u.name || u.email} {u.email ? `(${u.email})` : ''}</option>)}
              </select>
            </label>
            <label><span className={labelCls}>Linked employee (weekly off)</span>
              <select className={inputCls} value={editing.emp_id} onChange={(e) => setEditing({ ...editing, emp_id: e.target.value })}>
                <option value="">None</option>
                {data.employees.map((e: any) => <option key={e.emp_id} value={e.emp_id}>{e.name}</option>)}
              </select>
            </label>
            <label><span className={labelCls}>Display name</span><input className={inputCls} value={editing.display_name} onChange={(e) => setEditing({ ...editing, display_name: e.target.value })} /></label>
            <label><span className={labelCls}>Notification email</span><input className={inputCls} value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></label>
            <label><span className={labelCls}>Phone</span><input className={inputCls} value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></label>
            <label><span className={labelCls}>Appointment modes</span>
              <select className={inputCls} value={editing.modes} onChange={(e) => setEditing({ ...editing, modes: e.target.value })}>
                <option value="both">Online & offline</option><option value="online">Online only</option><option value="offline">Offline only</option>
              </select>
            </label>
            <label className="sm:col-span-2"><span className={labelCls}>Personal meeting link (online)</span><input className={inputCls} value={editing.meeting_link} onChange={(e) => setEditing({ ...editing, meeting_link: e.target.value })} placeholder="https://meet.google.com/…" /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Active for appointments</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.use_custom_hours} onChange={(e) => setEditing({ ...editing, use_custom_hours: e.target.checked })} /> Individual working hours</label>
            {editing.use_custom_hours && (
              <div className="sm:col-span-2 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3">
                <div className="col-span-2"><span className={labelCls}>Working days</span><DayPicker value={editing.working_days} onChange={(v) => setEditing({ ...editing, working_days: v })} /></div>
                <label><span className={labelCls}>Start</span><input type="time" className={inputCls} value={editing.start_time} onChange={(e) => setEditing({ ...editing, start_time: e.target.value })} /></label>
                <label><span className={labelCls}>End</span><input type="time" className={inputCls} value={editing.end_time} onChange={(e) => setEditing({ ...editing, end_time: e.target.value })} /></label>
              </div>
            )}
          </div>
          {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button className={btnGhost} onClick={() => setEditing(null)}>Cancel</button>
            <button className={btnPrimary} onClick={save} disabled={!editing.user_id}>Save counsellor</button>
          </div>
        </Card>
      )}

      {blocksFor && <BlocksCard counsellor={blocksFor} onClose={() => setBlocksFor(null)} onSaved={onSaved} />}
    </>
  );
}

function BlocksCard({ counsellor, onClose, onSaved }: { counsellor: Counsellor; onClose: () => void; onSaved: (m?: string) => void }) {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [f, setF] = useState({ start_date: localNow().date, end_date: '', start_time: '', end_time: '', block_type: 'leave', reason: '' });
  const [err, setErr] = useState('');
  const [clashes, setClashes] = useState<any[]>([]);

  const fetchBlocks = useCallback(async () => {
    const r = await fetch(`/api/appointments/settings/blocks?counsellor=${counsellor.user_id}`, { cache: 'no-store' });
    const d = await r.json();
    return (d.blocks || []) as any[];
  }, [counsellor.user_id]);
  const load = useCallback(async () => setBlocks(await fetchBlocks()), [fetchBlocks]);
  useEffect(() => {
    let active = true;
    fetchBlocks().then((b) => { if (active) setBlocks(b); }).catch(() => {});
    return () => { active = false; };
  }, [fetchBlocks]);

  const add = async () => {
    setErr(''); setClashes([]);
    try {
      const d = await api('/api/appointments/settings/blocks', 'POST', { ...f, end_date: f.end_date || f.start_date, counsellor_user_id: counsellor.user_id });
      setClashes(d.clashes || []);
      await load(); onSaved(d.clashes?.length ? 'Saved — but some booked appointments clash (see below).' : undefined);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Unable to save'); }
  };
  const remove = async (id: number) => {
    try { await api(`/api/appointments/settings/blocks?id=${id}`, 'DELETE'); await load(); onSaved('Removed.'); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
  };

  return (
    <Card title={`Blocked time & leave — ${counsellor.display_name}`} subtitle="Blocked periods remove this counsellor from public availability." right={<button className={btnGhost} onClick={onClose}>Close</button>}>
      <div className="mb-4 grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
        <label><span className={labelCls}>From date</span><input type="date" className={inputCls} value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></label>
        <label><span className={labelCls}>To date</span><input type="date" className={inputCls} value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></label>
        <label><span className={labelCls}>From time</span><input type="time" className={inputCls} value={f.start_time} onChange={(e) => setF({ ...f, start_time: e.target.value })} /></label>
        <label><span className={labelCls}>To time</span><input type="time" className={inputCls} value={f.end_time} onChange={(e) => setF({ ...f, end_time: e.target.value })} /></label>
        <label><span className={labelCls}>Type</span>
          <select className={inputCls} value={f.block_type} onChange={(e) => setF({ ...f, block_type: e.target.value })}>
            <option value="leave">Leave</option><option value="blocked">Blocked</option><option value="task">Internal task / meeting</option><option value="unavailable">Unavailable</option>
          </select>
        </label>
        <label><span className={labelCls}>Reason</span><input className={inputCls} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></label>
        <div className="col-span-2 sm:col-span-6 flex justify-end"><button className={btnPrimary} onClick={add}>Add block</button></div>
      </div>
      {err && <p className="mb-2 text-sm text-rose-600">{err}</p>}
      {clashes.length > 0 && (
        <div className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-bold">These booked appointments fall inside the block — reschedule or reassign them from Appointments:</p>
          <ul className="mt-1 list-disc pl-4">{clashes.map((c) => <li key={c.id}>{c.appointment_code} · {c.first_name} {c.last_name} · {c.appt_date} {fmt12(c.start_time)}</li>)}</ul>
        </div>
      )}
      {blocks.length === 0 ? <p className="text-sm text-gray-400">No upcoming blocked time.</p> : (
        <ul className="divide-y divide-gray-100 text-sm">
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center gap-3 py-2">
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold capitalize text-rose-700">{b.block_type}</span>
              <span className="text-gray-700">{String(b.start_at).slice(0, 16)} → {String(b.end_at).slice(0, 16)}</span>
              <span className="flex-1 truncate text-gray-500">{b.reason}</span>
              <button className="text-xs font-semibold text-rose-600 hover:underline" onClick={() => remove(b.id)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── Calendly integration ──────────────────────────────────────────────

function CalendlyTab({ canWrite }: { canWrite: boolean }) {
  const [status, setStatus] = useState<any>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState<'' | 'connect' | 'sync'>('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/appointments/calendly', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (active) setStatus(d); })
      .catch(() => { if (active) setStatus({ success: false, error: 'Unable to reach the server' }); });
    return () => { active = false; };
  }, [reloadKey]);

  const act = async (action: 'connect' | 'sync') => {
    setBusy(action); setMsg(null);
    try {
      const d = await api('/api/appointments/calendly', 'POST', { action });
      if (action === 'sync') {
        const c = d.summary.counts;
        setMsg({ ok: true, text: `Synced ${c.events} Calendly events — ${c.created} new, ${c.rescheduled} rescheduled, ${c.cancelled} cancelled${c.errors ? `, ${c.errors} errors` : ''}.` });
      } else {
        setMsg({ ok: true, text: `Webhook connected (${d.webhook.state}). New Calendly bookings will appear instantly.` });
      }
      setReloadKey((k) => k + 1);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Request failed' });
    } finally {
      setBusy('');
    }
  };

  if (!status) return <Card title="Calendly"><p className="text-sm text-gray-400">Checking Calendly…</p></Card>;
  if (!status.success) return <Card title="Calendly"><p className="text-sm text-rose-600">{status.error}</p></Card>;
  if (!status.configured) {
    return (
      <Card title="Calendly">
        <p className="text-sm text-amber-700">Not connected — set <code className="rounded bg-gray-100 px-1">CALENDLY_API_TOKEN</code> in the environment and redeploy.</p>
      </Card>
    );
  }

  const last = status.lastSync;
  return (
    <>
      <Card title="Calendly booking sync" subtitle="Calendly bookings are copied into Appointments, assigned to a counsellor, and get tasks + reminders.">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div><dt className={labelCls}>Account</dt><dd className="font-semibold text-gray-800">{status.account?.name} <span className="font-normal text-gray-500">({status.account?.email})</span></dd></div>
          <div><dt className={labelCls}>Booking page</dt><dd><a className="text-[#2E3093] underline" href={status.account?.scheduling_url} target="_blank" rel="noreferrer">{status.account?.scheduling_url}</a></dd></div>
          <div>
            <dt className={labelCls}>Instant webhook</dt>
            <dd>
              {status.webhook
                ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${status.webhook.state === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{status.webhook.state}</span>
                : <span className="text-gray-500">Not connected{status.webhookError ? ` — ${status.webhookError}` : ''}</span>}
              {status.webhook && !status.hasSigningKey && <p className="text-xs text-amber-700">Signing key missing — reconnect.</p>}
            </dd>
          </div>
          <div>
            <dt className={labelCls}>Last sync</dt>
            <dd className="text-gray-700">
              {last ? <>{new Date(last.at).toLocaleString('en-IN')} · {last.counts.events} events, {last.counts.created} new{last.counts.errors ? <span className="text-rose-600"> · {last.counts.errors} errors</span> : ''}</> : 'Never'}
            </dd>
          </div>
        </dl>
        {last?.errors?.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-rose-600">{last.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>}
        {msg && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{msg.text}</p>}
        {canWrite && (
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button className={btnGhost} disabled={!!busy} onClick={() => act('sync')}>{busy === 'sync' ? 'Syncing…' : 'Sync now'}</button>
            <button className={btnPrimary} disabled={!!busy} onClick={() => act('connect')}>{busy === 'connect' ? 'Connecting…' : status.webhook ? 'Reconnect webhook' : 'Connect webhook'}</button>
          </div>
        )}
      </Card>
      <Card title="How bookings are mapped">
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>Calendly questions <b>Mobile Number</b>, <b>Qualification</b> and <b>Training Program</b> fill the appointment (“Do not know” = Need guidance). Add a question containing “experience” to capture work experience.</li>
          <li>Google Meet / Zoom bookings are <b>Online</b> with the meeting link; an in-person location makes them <b>Offline</b>.</li>
          <li>A counsellor is assigned fairly among those free at that time (leave, blocks and other appointments respected). If nobody is free it stays unassigned — reassign it from Appointments.</li>
          <li>Cancellations, reschedules and no-shows in Calendly update the appointment. The webhook is instant; a background sync every 10 minutes catches anything missed.</li>
          <li>Calendly sends the applicant’s confirmation email; the assigned counsellor gets an email from this system.</li>
        </ul>
        <p className="mt-2 text-xs text-gray-400">Webhook URL: {status.callbackUrl}</p>
      </Card>
    </>
  );
}

// ── Live preview of what the public sees ────────────────────────────────

function SlotPreview({ refreshKey }: { refreshKey: number }) {
  const [date, setDate] = useState(localNow().date);
  const [mode, setMode] = useState<'offline' | 'online'>('offline');
  const [result, setResult] = useState<{ key: string; slots: any[]; closed: string | null } | null>(null);
  const key = `${date}|${mode}|${refreshKey}`;
  const slots = result?.key === key ? result.slots : null;
  const closed = result?.key === key ? result.closed : null;

  useEffect(() => {
    let active = true;
    const k = `${date}|${mode}|${refreshKey}`;
    fetch(`/api/public/appointments/availability?mode=${mode}&date=${date}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (active) setResult({ key: k, slots: d.slots || [], closed: d.closedReason || null }); })
      .catch(() => { if (active) setResult({ key: k, slots: [], closed: null }); });
    return () => { active = false; };
  }, [date, mode, refreshKey]);

  return (
    <aside className="xl:sticky xl:top-2">
      <Card title="Slot preview" subtitle="Bookable slots generated from the current settings.">
        <div className="flex gap-2">
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          <select className={`${inputCls} w-auto`} value={mode} onChange={(e) => setMode(e.target.value as 'offline' | 'online')}>
            <option value="offline">Offline</option><option value="online">Online</option>
          </select>
        </div>
        <div className="mt-3">
          {slots === null ? <p className="text-xs text-gray-400">Loading…</p>
            : closed ? <p className="text-xs text-rose-600">Closed — {closed}</p>
            : slots.length === 0 ? <p className="text-xs text-gray-500">No bookable slots.</p>
            : (
              <div className="flex flex-wrap gap-1.5">
                {slots.map((s) => <span key={s.time} className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700">{fmt12(s.time)}</span>)}
              </div>
            )}
        </div>
      </Card>
    </aside>
  );
}
