'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AppointmentDetailModal, STATUSES, btnGhost, btnPrimary, fmt12, inputCls, labelCls, localNow, programOf, isPending,
  type Appointment,
} from '../_components/shared';

type View = 'month' | 'week' | 'day';
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOUR_PX = 56;

// ── Date helpers (pure YYYY-MM-DD strings, timezone-safe) ──────────────
const toD = (s: string) => new Date(`${s}T00:00:00Z`);
const toS = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => { const d = toD(s); d.setUTCDate(d.getUTCDate() + n); return toS(d); };
const mondayOf = (s: string) => addDays(s, -((toD(s).getUTCDay() + 6) % 7));
const monthStart = (s: string) => `${s.slice(0, 7)}-01`;
const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };

function rangeFor(view: View, anchor: string) {
  if (view === 'day') return { from: anchor, to: anchor };
  if (view === 'week') { const from = mondayOf(anchor); return { from, to: addDays(from, 6) }; }
  const first = monthStart(anchor);
  const from = mondayOf(first);
  return { from, to: addDays(from, 41) };
}

function chipCls(a: Appointment) {
  const now = localNow();
  if (a.status === 'Cancelled') return 'bg-rose-50 text-rose-400 line-through border-rose-200';
  if (a.status === 'Completed') return 'bg-emerald-50 text-emerald-800 border-emerald-300';
  if (a.status === 'No Show') return 'bg-orange-50 text-orange-800 border-orange-300';
  if (isPending(a, now.date, now.time)) return 'bg-amber-50 text-amber-900 border-amber-300';
  return a.mode === 'online' ? 'bg-sky-50 text-sky-900 border-sky-300' : 'bg-indigo-50 text-indigo-900 border-indigo-300';
}

export default function AppointmentCalendarPage() {
  const today = localNow().date;
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState(today);
  const [filters, setFilters] = useState({ counsellor: '', course: '', mode: '', status: '' });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availability, setAvailability] = useState<Record<string, any[]> | null>(null);
  const [counsellors, setCounsellors] = useState<{ user_id: number; name: string; is_active: number }[]>([]);
  const [programs, setPrograms] = useState<{ id: number; name: string }[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [blockFor, setBlockFor] = useState<{ user_id: number; name: string; date: string } | null>(null);

  const { from, to } = rangeFor(view, anchor);

  useEffect(() => {
    fetch('/api/public/appointments/config').then((r) => r.json()).then((d) => setPrograms(d.programs || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const qs = new URLSearchParams({ from, to });
    Object.entries(filters).forEach(([k, v]) => { if (v) qs.set(k, v); });
    if (view !== 'month') qs.set('availability', '1');
    try {
      const r = await fetch(`/api/appointments/calendar?${qs}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || d.message || 'Unable to load calendar');
      setAppointments(d.appointments); setAvailability(d.availability); setCounsellors(d.counsellors); setCanManage(Boolean(d.canManage));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load calendar');
    } finally {
      setLoading(false);
    }
  }, [from, to, filters, view]);

  useEffect(() => { load(); }, [load]);

  const byDate = useMemo(() => {
    const m = new Map<string, Appointment[]>();
    for (const a of appointments) { const l = m.get(a.appt_date) ?? []; l.push(a); m.set(a.appt_date, l); }
    return m;
  }, [appointments]);

  const step = (dir: number) => {
    if (view === 'day') setAnchor(addDays(anchor, dir));
    else if (view === 'week') setAnchor(addDays(anchor, 7 * dir));
    else { const d = toD(monthStart(anchor)); d.setUTCMonth(d.getUTCMonth() + dir); setAnchor(toS(d)); }
  };

  const title = view === 'month'
    ? toD(anchor).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    : view === 'week'
      ? `${toD(from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })} – ${toD(to).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`
      : toD(anchor).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

  // Visible hour range from working hours (fallback 8–19).
  const hourRange = useMemo(() => {
    let lo = 9 * 60, hi = 16 * 60;
    for (const list of Object.values(availability ?? {})) for (const c of list) if (c.working) { lo = Math.min(lo, mins(c.working.start)); hi = Math.max(hi, mins(c.working.end)); }
    for (const a of appointments) { lo = Math.min(lo, mins(a.start_time)); hi = Math.max(hi, mins(a.end_time)); }
    return { start: Math.max(0, Math.floor(lo / 60) - 1), end: Math.min(24, Math.ceil(hi / 60) + 1) };
  }, [availability, appointments]);

  const setF = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLSelectElement>) => setFilters({ ...filters, [k]: e.target.value });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Appointment Calendar</h1>
          <p className="text-sm text-gray-500">Counsellor availability here drives the public booking slots.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/appointments" className={btnGhost}>Manage appointments</Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-1">
          <button className={btnGhost} onClick={() => step(-1)} aria-label="Previous">‹</button>
          <button className={btnGhost} onClick={() => setAnchor(today)}>Today</button>
          <button className={btnGhost} onClick={() => step(1)} aria-label="Next">›</button>
        </div>
        <p className="min-w-[180px] text-sm font-bold text-gray-800">{title}</p>
        <div className="ml-auto inline-flex rounded-lg border border-gray-200 p-0.5">
          {(['month', 'week', 'day'] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${view === v ? 'bg-[#2E3093] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{v}</button>
          ))}
        </div>
        <div className="flex w-full flex-wrap gap-2">
          {canManage && (
            <select className={`${inputCls} w-auto`} value={filters.counsellor} onChange={setF('counsellor')}>
              <option value="">All counsellors</option>
              {counsellors.map((c) => <option key={c.user_id} value={c.user_id}>{c.name}{c.is_active ? '' : ' (inactive)'}</option>)}
            </select>
          )}
          <select className={`${inputCls} w-auto`} value={filters.course} onChange={setF('course')}>
            <option value="">All programs</option><option value="guidance">Need guidance</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className={`${inputCls} w-auto`} value={filters.mode} onChange={setF('mode')}>
            <option value="">All modes</option><option value="online">Online</option><option value="offline">Offline</option>
          </select>
          <select className={`${inputCls} w-auto`} value={filters.status} onChange={setF('status')}>
            <option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <Legend />
        </div>
      </div>

      {error && <p className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <div className={`rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden ${loading ? 'opacity-60' : ''}`}>
        {view === 'month' && (
          <MonthView anchor={anchor} from={from} today={today} byDate={byDate} onOpen={setOpenId} onDay={(d) => { setAnchor(d); setView('day'); }} />
        )}
        {view === 'week' && (
          <TimeGrid
            columns={Array.from({ length: 7 }, (_, i) => {
              const d = addDays(from, i);
              const avail = availability?.[d] ?? [];
              return {
                key: d,
                title: `${WEEKDAYS[i]} ${toD(d).getUTCDate()}`,
                highlight: d === today,
                appointments: byDate.get(d) ?? [],
                // One counsellor visible → shade their exact availability; several → shade the union of working hours.
                timelines: avail,
                onTitle: () => { setAnchor(d); setView('day'); },
              };
            })}
            hourRange={hourRange}
            onOpen={setOpenId}
          />
        )}
        {view === 'day' && (
          (availability?.[anchor] ?? []).length === 0 ? (
            <div className="p-6">
              <p className="text-sm text-gray-500">No counsellors configured.{canManage && <> Add them in <Link className="text-[#2E3093] underline" href="/dashboard/appointments/settings">Scheduling Settings</Link>.</>}</p>
              <DayList list={byDate.get(anchor) ?? []} onOpen={setOpenId} />
            </div>
          ) : (
            <TimeGrid
              columns={(availability?.[anchor] ?? []).map((t: any) => ({
                key: String(t.user_id),
                title: t.name,
                subtitle: t.offReason ?? (t.working ? `${fmt12(t.working.start)} – ${fmt12(t.working.end)}` : ''),
                appointments: (byDate.get(anchor) ?? []).filter((a) => a.counsellor_user_id === t.user_id),
                timelines: [t],
                onTitle: () => setBlockFor({ user_id: t.user_id, name: t.name, date: anchor }),
                titleHint: 'Block time / add leave',
              }))}
              hourRange={hourRange}
              onOpen={setOpenId}
            />
          )
        )}
      </div>

      {openId && <AppointmentDetailModal id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
      {blockFor && <BlockTimeModal target={blockFor} onClose={() => setBlockFor(null)} onSaved={() => { setBlockFor(null); load(); }} />}
    </div>
  );
}

function Legend() {
  const items = [
    ['bg-indigo-50 border-indigo-300', 'Offline'], ['bg-sky-50 border-sky-300', 'Online'], ['bg-amber-50 border-amber-300', 'Pending'],
    ['bg-emerald-50 border-emerald-300', 'Completed'], ['bg-orange-50 border-orange-300', 'No show'],
    ['bg-gray-100 border-gray-200', 'Unavailable'], ['bg-rose-100/70 border-rose-200', 'Blocked / leave'], ['stripe', 'Break'],
  ];
  return (
    <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
      {items.map(([c, l]) => (
        <span key={l} className="inline-flex items-center gap-1">
          <span className={`inline-block h-3 w-3 rounded-sm border ${c === 'stripe' ? 'border-gray-200' : c}`}
            style={c === 'stripe' ? { background: 'repeating-linear-gradient(45deg,#e5e7eb 0 3px,#fff 3px 6px)' } : undefined} />
          {l}
        </span>
      ))}
    </div>
  );
}

function MonthView({ anchor, from, today, byDate, onOpen, onDay }: {
  anchor: string; from: string; today: string; byDate: Map<string, Appointment[]>; onOpen: (id: number) => void; onDay: (d: string) => void;
}) {
  const month = anchor.slice(0, 7);
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-center text-[11px] font-bold uppercase text-gray-500">
        {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: 42 }, (_, i) => {
          const d = addDays(from, i);
          const list = byDate.get(d) ?? [];
          return (
            <div key={d} className={`min-h-[104px] border-b border-r border-gray-100 p-1.5 ${d.slice(0, 7) !== month ? 'bg-gray-50/60' : ''}`}>
              <button onClick={() => onDay(d)} className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${d === today ? 'bg-[#2E3093] text-white' : d.slice(0, 7) === month ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300'}`}>
                {toD(d).getUTCDate()}
              </button>
              <div className="space-y-0.5">
                {list.slice(0, 3).map((a) => (
                  <button key={a.id} onClick={() => onOpen(a.id)} className={`block w-full truncate rounded border px-1 py-0.5 text-left text-[10px] font-semibold ${chipCls(a)}`}
                    title={`${fmt12(a.start_time)} ${a.first_name} ${a.last_name} · ${programOf(a)} · ${a.counsellor_name ?? ''} · ${a.mode} · ${a.status}`}>
                    {fmt12(a.start_time)} {a.first_name} {a.last_name}
                  </button>
                ))}
                {list.length > 3 && <button onClick={() => onDay(d)} className="text-[10px] font-semibold text-[#2E3093]">+{list.length - 3} more</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface Column {
  key: string;
  title: string;
  subtitle?: string;
  highlight?: boolean;
  appointments: Appointment[];
  timelines: any[];
  onTitle?: () => void;
  titleHint?: string;
}

/**
 * Time grid used by week (columns = days) and day (columns = counsellors) views.
 * Background layers show availability: grey = outside working hours / off,
 * red = blocked / leave, striped = break. Appointment cards sit on top.
 */
function TimeGrid({ columns, hourRange, onOpen }: { columns: Column[]; hourRange: { start: number; end: number }; onOpen: (id: number) => void }) {
  const hours = Array.from({ length: hourRange.end - hourRange.start }, (_, i) => hourRange.start + i);
  const top = (m: number) => ((m - hourRange.start * 60) / 60) * HOUR_PX;
  const height = (hours.length) * HOUR_PX;

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[720px]">
        <div className="w-14 shrink-0 border-r border-gray-100">
          <div className="h-12 border-b border-gray-200" />
          <div className="relative" style={{ height }}>
            {hours.map((h) => (
              <div key={h} className="absolute right-1 -translate-y-1/2 text-[10px] text-gray-400" style={{ top: top(h * 60) }}>
                {h === 0 ? '' : fmt12(`${h}:00`)}
              </div>
            ))}
          </div>
        </div>
        {columns.map((col) => {
          // Merge working windows across timelines (union) for shading.
          const windows = col.timelines.filter((t) => t.working).map((t) => ({ s: mins(t.working.start), e: mins(t.working.end) }));
          const single = col.timelines.length === 1 ? col.timelines[0] : null;
          return (
            <div key={col.key} className="min-w-[110px] flex-1 border-r border-gray-100 last:border-r-0">
              <button
                onClick={col.onTitle}
                title={col.titleHint}
                className={`flex h-12 w-full flex-col items-center justify-center border-b border-gray-200 px-1 text-center ${col.highlight ? 'bg-[#2E3093]/5' : ''} hover:bg-gray-50`}
              >
                <span className={`truncate text-xs font-bold ${col.highlight ? 'text-[#2E3093]' : 'text-gray-700'}`}>{col.title}</span>
                {col.subtitle && <span className="truncate text-[10px] text-gray-400">{col.subtitle}</span>}
              </button>
              <div className="relative" style={{ height, background: '#f3f4f6' }}>
                {windows.map((w, i) => (
                  <div key={i} className="absolute inset-x-0 bg-white" style={{ top: top(w.s), height: top(w.e) - top(w.s) }} />
                ))}
                {hours.map((h) => <div key={h} className="absolute inset-x-0 border-t border-gray-100" style={{ top: top(h * 60) }} />)}
                {single && single.working && single.breaks.map((b: any, i: number) => (
                  <div key={`b${i}`} className="absolute inset-x-0" title={b.label}
                    style={{ top: top(mins(b.start)), height: top(mins(b.end)) - top(mins(b.start)), background: 'repeating-linear-gradient(45deg,#e5e7eb 0 4px,transparent 4px 8px)' }} />
                ))}
                {single && single.blocks.map((b: any) => (
                  <div key={`k${b.id}`} className="absolute inset-x-0.5 rounded bg-rose-100/70 px-1 text-[10px] font-semibold capitalize text-rose-700" title={b.label}
                    style={{ top: top(Math.max(mins(b.start), hourRange.start * 60)), height: Math.max(12, top(Math.min(mins(b.end), hourRange.end * 60)) - top(Math.max(mins(b.start), hourRange.start * 60))) }}>
                    {b.kind}{b.label && b.label !== b.kind ? ` · ${b.label}` : ''}
                  </div>
                ))}
                {col.appointments.map((a) => (
                  <button key={a.id} onClick={() => onOpen(a.id)}
                    className={`absolute inset-x-1 overflow-hidden rounded-md border px-1.5 py-0.5 text-left shadow-sm ${chipCls(a)}`}
                    style={{ top: top(mins(a.start_time)) + 1, height: Math.max(22, top(mins(a.end_time)) - top(mins(a.start_time)) - 2) }}
                    title={`${fmt12(a.start_time)} · ${a.first_name} ${a.last_name} · ${programOf(a)} · ${a.counsellor_name ?? ''} · ${a.mode} · ${a.status}`}>
                    <p className="truncate text-[10px] font-bold">{fmt12(a.start_time)} · {a.first_name} {a.last_name}</p>
                    <p className="truncate text-[10px] opacity-80">{programOf(a)}</p>
                    <p className="truncate text-[10px] opacity-70">{a.counsellor_name} · {a.mode === 'online' ? 'Online' : 'Offline'} · {a.status}</p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayList({ list, onOpen }: { list: Appointment[]; onOpen: (id: number) => void }) {
  if (!list.length) return null;
  return (
    <ul className="mt-3 space-y-1">
      {list.map((a) => (
        <li key={a.id}>
          <button onClick={() => onOpen(a.id)} className={`w-full rounded border px-2 py-1 text-left text-xs ${chipCls(a)}`}>
            {fmt12(a.start_time)} · {a.first_name} {a.last_name} · {programOf(a)}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Quick block/leave entry from the day view — feeds the availability engine immediately. */
function BlockTimeModal({ target, onClose, onSaved }: { target: { user_id: number; name: string; date: string }; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ start_date: target.date, end_date: target.date, start_time: '', end_time: '', block_type: 'blocked', reason: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [clashes, setClashes] = useState<any[]>([]);
  const s = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/appointments/settings/blocks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, counsellor_user_id: target.user_id }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || 'Unable to save');
      if (d.clashes?.length) { setClashes(d.clashes); return; }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Unable to save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-base font-bold text-gray-900">Block time — {target.name}</h3>
        <p className="text-xs text-gray-500">Blocked time stops appearing as bookable on the public page. Leave times empty to block whole days.</p>
        {clashes.length > 0 ? (
          <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-bold">Saved. These booked appointments fall inside the block — reschedule or reassign them:</p>
            <ul className="mt-1 list-disc pl-4">{clashes.map((c) => <li key={c.id}>{c.appointment_code} · {c.first_name} {c.last_name} · {c.appt_date} {fmt12(c.start_time)}</li>)}</ul>
            <div className="mt-2 flex justify-end"><button className={btnPrimary} onClick={onSaved}>OK</button></div>
          </div>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label><span className={labelCls}>From date</span><input type="date" className={inputCls} value={f.start_date} onChange={s('start_date')} /></label>
              <label><span className={labelCls}>To date</span><input type="date" className={inputCls} value={f.end_date} onChange={s('end_date')} /></label>
              <label><span className={labelCls}>From time</span><input type="time" className={inputCls} value={f.start_time} onChange={s('start_time')} /></label>
              <label><span className={labelCls}>To time</span><input type="time" className={inputCls} value={f.end_time} onChange={s('end_time')} /></label>
              <label><span className={labelCls}>Type</span>
                <select className={inputCls} value={f.block_type} onChange={s('block_type')}>
                  <option value="blocked">Blocked</option><option value="leave">Leave</option><option value="task">Internal task / meeting</option><option value="unavailable">Unavailable</option>
                </select>
              </label>
              <label><span className={labelCls}>Reason</span><input className={inputCls} value={f.reason} onChange={s('reason')} /></label>
            </div>
            {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button className={btnGhost} onClick={onClose}>Cancel</button>
              <button className={btnPrimary} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save block'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
