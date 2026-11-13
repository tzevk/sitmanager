'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AppointmentDetailModal, fmt12 } from '@/app/dashboard/appointments/_components/shared';
import { useResourcePermissions } from '@/lib/permissions-context';
import DailyActivityWidget from './DailyActivityWidget';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface Lead {
  Inquiry_Id: number;
  Student_Name: string | null;
  Present_Mobile: string | null;
  Email: string | null;
  CourseName: string | null;
  Course_Id: number | null;
  Batch_Code: string | null;
  Inquiry_From: string | null;
  StatusLabel: string | null;
  Temperature: string | null;
  NextFollowUpDate: string | null;
  InquiryDate: string | null;
  OwnerId: number | null;
  OwnerName: string | null;
  InitiatedByName?: string | null;
  IsMeta?: boolean;
  MetaCampaign?: string | null;
  Reason: 'Overdue' | 'Reminder' | 'Not contacted' | 'Follow-up due' | 'No next step' | 'Upcoming' | 'New lead' | 'Lead';
}
interface Appt {
  id: number; appointment_code: string; name: string; mobile: string; program_name: string | null;
  start_time: string; end_time: string; mode: string; status: string; counsellor_name: string | null;
}
interface Staff { id: number; name: string }

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const shiftDay = (date: string, by: number) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + by);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtLong = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

const REASON_STYLE: Record<Lead['Reason'], string> = {
  'Follow-up due': 'bg-sky-100 text-sky-800',
  'Overdue': 'bg-rose-100 text-rose-700',
  'Reminder': 'bg-amber-100 text-amber-800',
  'Not contacted': 'bg-orange-100 text-orange-700',
  'No next step': 'bg-fuchsia-100 text-fuchsia-700',
  'Upcoming': 'bg-violet-100 text-violet-700',
  'New lead': 'bg-emerald-100 text-emerald-700',
  'Lead': 'bg-slate-100 text-slate-600',
};
const TEMP_STYLE: Record<string, string> = { hot: 'bg-red-500 text-white', warm: 'bg-amber-400 text-amber-900', cold: 'bg-blue-400 text-white' };

const APPT_STATUS_STYLE: Record<string, string> = {
  Scheduled: 'bg-sky-100 text-sky-800', Completed: 'bg-emerald-100 text-emerald-700',
  'No Show': 'bg-orange-100 text-orange-700', Cancelled: 'bg-rose-100 text-rose-700',
};

const ctrl = 'h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/30';

function MultiSelect({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} className={`${ctrl} flex items-center gap-1 ${value.length ? 'border-[#2E3093] text-[#2E3093] font-semibold' : ''}`}>
        {label}{value.length > 0 && ` (${value.length})`}
        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
          {options.length === 0 && <p className="px-2 py-1.5 text-xs text-slate-400">No options</p>}
          {options.map(o => (
            <label key={o} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-50">
              <input type="checkbox" checked={value.includes(o)} onChange={() => onChange(value.includes(o) ? value.filter(x => x !== o) : [...value, o])} />
              <span className="truncate">{o}</span>
            </label>
          ))}
          {value.length > 0 && <button type="button" onClick={() => onChange([])} className="mt-1 w-full rounded px-2 py-1 text-left text-[10px] font-bold text-slate-500 hover:bg-slate-50">Clear</button>}
        </div>
      )}
    </div>
  );
}

export default function MyTasksPage() {
  const { canView, loading: permLoading } = useResourcePermissions('inquiry');
  const [date, setDate] = useState(localToday());
  const [owner, setOwner] = useState('me');
  // Always the allocated view — the old "allocated / initiated" toggle was removed.
  const taskScope = 'allocated' as 'allocated' | 'initiated';
  const [source, setSource] = useState<'all' | 'meta' | 'other'>('all');
  const [days, setDays] = useState(30);
  const [live, setLive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [freshIds, setFreshIds] = useState<Set<number>>(new Set());
  const knownIds = useRef<Set<number> | null>(null);
  const loadKey = useRef('');
  // Super Admin and the sales manager can look at anyone's leads and allocate them; everyone else sees only their own.
  const [canSeeAll, setCanSeeAll] = useState(false);
  const [view, setView] = useState<'day' | 'all' | 'month'>('day');
  const [monthData, setMonthData] = useState<Record<string, { followUps: number; newLeads: number; appointments: number }>>({});
  const [leads, setLeads] = useState<Lead[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [me, setMe] = useState<number | null>(null);
  const [canAssign, setCanAssign] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState<string[]>([]);
  const [fCourse, setFCourse] = useState<string[]>([]);
  const [fMode, setFMode] = useState<string[]>([]);
  const [fTemp, setFTemp] = useState<string[]>([]);
  const [fBatch, setFBatch] = useState<string[]>([]);
  const [fReason, setFReason] = useState<string[]>([]);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [assignTo, setAssignTo] = useState('');
  const [assigning, setAssigning] = useState(false);
  const dragging = useRef(false);
  const [notice, setNotice] = useState('');
  const [openAppt, setOpenAppt] = useState<number | null>(null);

  // silent = background live refresh: no spinner, selection kept, new arrivals highlighted.
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      if (view === 'month') {
        const res = await fetch(`/api/inquiry/my-tasks?date=${date}&owner=${encodeURIComponent(owner)}&scope=${taskScope}&view=month`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        setMonthData(data.days || {}); setMe(data.me ?? null); setCanSeeAll(Boolean(data.canSeeAll));
        setLoading(false);
        return;
      }
      const key = `${date}|${owner}|${view}|${days}`;
      const res = await fetch(`/api/inquiry/my-tasks?date=${date}&owner=${encodeURIComponent(owner)}&scope=${taskScope}&view=${view}&days=${days}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const next: Lead[] = data.leads || [];
      const ids = new Set(next.map(l => l.Inquiry_Id));
      // Highlight leads that arrived since the last load of this same list.
      if (silent && knownIds.current && loadKey.current === key) {
        const arrived = next.filter(l => !knownIds.current!.has(l.Inquiry_Id)).map(l => l.Inquiry_Id);
        if (arrived.length) setFreshIds(prev => new Set([...prev, ...arrived]));
      } else setFreshIds(new Set());
      knownIds.current = ids; loadKey.current = key;
      setLeads(next); setAppts(data.appointments || []); setStaff(data.staff || []); setMe(data.me ?? null);
      setCanAssign(Boolean(data.canAssign)); setCanSeeAll(Boolean(data.canSeeAll));
      setSelected(prev => silent ? new Set([...prev].filter(id => ids.has(id))) : new Set());
      setUpdatedAt(Date.now());
    } catch (e) { if (!silent) setError(e instanceof Error ? e.message : 'Failed to load'); }
    if (!silent) setLoading(false);
  }, [date.slice(0, 7), view === 'month' ? 'm' : date, owner, view, taskScope, days]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(t); }, [notice]);

  // Live: re-pull every 30s while the tab is visible (pauses during an assignment or a drag).
  useEffect(() => {
    if (!live || view === 'month') return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible' && !dragging.current) load(true);
      setTick(n => n + 1);
    }, 30000);
    const onVis = () => { if (document.visibilityState === 'visible') load(true); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [live, view, load]);

  // Filter options come from the day's own leads.
  const uniq = (f: (l: Lead) => string | null | undefined) => [...new Set(leads.map(f).filter((v): v is string => Boolean(v)))].sort();
  const statusOpts = useMemo(() => uniq(l => l.StatusLabel), [leads]); // eslint-disable-line react-hooks/exhaustive-deps
  const courseOpts = useMemo(() => uniq(l => l.CourseName), [leads]); // eslint-disable-line react-hooks/exhaustive-deps
  const modeOpts = useMemo(() => uniq(l => l.Inquiry_From), [leads]); // eslint-disable-line react-hooks/exhaustive-deps
  const batchOpts = useMemo(() => uniq(l => l.Batch_Code), [leads]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return leads.filter(l =>
      (source === 'all' || (source === 'meta') === Boolean(l.IsMeta)) &&
      (!fStatus.length || fStatus.includes(l.StatusLabel || '')) &&
      (!fCourse.length || fCourse.includes(l.CourseName || '')) &&
      (!fMode.length || fMode.includes(l.Inquiry_From || '')) &&
      (!fTemp.length || fTemp.includes(l.Temperature || 'none')) &&
      (!fBatch.length || fBatch.includes(l.Batch_Code || '')) &&
      (!fReason.length || fReason.includes(l.Reason)) &&
      (!needle || `${l.Student_Name} ${l.Present_Mobile} ${l.Email} ${l.MetaCampaign ?? ''}`.toLowerCase().includes(needle))
    );
  }, [leads, source, q, fStatus, fCourse, fMode, fTemp, fBatch, fReason]);
  const metaCount = useMemo(() => leads.filter(l => l.IsMeta).length, [leads]);
  const unassignedCount = useMemo(() => leads.filter(l => l.OwnerId == null).length, [leads]);

  const activeFilters = [source === 'all' ? '' : source, q.trim(), ...fStatus, ...fCourse, ...fMode, ...fTemp, ...fBatch, ...fReason].filter(Boolean).length;
  const clearFilters = () => { setSource('all'); setQ(''); setFStatus([]); setFCourse([]); setFMode([]); setFTemp([]); setFBatch([]); setFReason([]); };

  const visibleIds = useMemo(() => filtered.map(l => l.Inquiry_Id), [filtered]);
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));
  const toggle = (id: number) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(visibleIds));

  // ── Drag-to-select (marquee) ─────────────────────────────────────────
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const dragBase = useRef<Set<number>>(new Set());

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('input,button,a,select,label')) return;
    const wrap = wrapRef.current; if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    dragging.current = true;
    dragBase.current = e.shiftKey || e.metaKey || e.ctrlKey ? new Set(selected) : new Set();
    setBox({ x1: e.clientX - r.left + wrap.scrollLeft, y1: e.clientY - r.top + wrap.scrollTop, x2: e.clientX - r.left + wrap.scrollLeft, y2: e.clientY - r.top + wrap.scrollTop });
    e.preventDefault();
  };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      const wrap = wrapRef.current; if (!wrap) return;
      const r = wrap.getBoundingClientRect();
      const x2 = e.clientX - r.left + wrap.scrollLeft;
      const y2 = e.clientY - r.top + wrap.scrollTop;
      setBox(b => {
        if (!b) return b;
        const nb = { ...b, x2, y2 };
        const left = Math.min(nb.x1, nb.x2), right = Math.max(nb.x1, nb.x2), top = Math.min(nb.y1, nb.y2), bottom = Math.max(nb.y1, nb.y2);
        const next = new Set(dragBase.current);
        wrap.querySelectorAll<HTMLElement>('[data-lead-id]').forEach(row => {
          const rr = row.getBoundingClientRect();
          const rt = rr.top - r.top + wrap.scrollTop, rb = rr.bottom - r.top + wrap.scrollTop;
          if (rb >= top && rt <= bottom && right >= 0 && left <= wrap.scrollWidth) next.add(Number(row.dataset.leadId));
        });
        setSelected(next);
        return nb;
      });
    };
    const up = () => { dragging.current = false; setBox(null); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

  const assign = async () => {
    if (!assignTo || !selected.size) return;
    setAssigning(true); setNotice('');
    try {
      const res = await fetch('/api/inquiry/my-tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryIds: [...selected], userId: Number(assignTo) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Assign failed');
      setNotice(`Assigned ${data.assigned} lead${data.assigned === 1 ? '' : 's'} to ${staff.find(s => String(s.id) === assignTo)?.name}`);
      setAssignTo('');
      await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Assign failed'); }
    setAssigning(false);
  };

  const unassign = async () => {
    if (!selected.size || !window.confirm(`Remove the assignment from ${selected.size} lead${selected.size === 1 ? '' : 's'}?`)) return;
    setAssigning(true); setNotice('');
    try {
      const res = await fetch('/api/inquiry/my-tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryIds: [...selected], action: 'unassign' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unassign failed');
      setNotice(`Unassigned ${data.unassigned} lead${data.unassigned === 1 ? '' : 's'}`);
      await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Unassign failed'); }
    setAssigning(false);
  };

  // ── Overview ─────────────────────────────────────────────────────────
  const scope = selected.size ? leads.filter(l => selected.has(l.Inquiry_Id)) : filtered;
  const tally = (f: (l: Lead) => string | null | undefined, top = 5) => {
    const m = new Map<string, number>();
    scope.forEach(l => { const k = f(l) || '—'; m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
  };
  const monthSum = (k: 'followUps' | 'newLeads' | 'appointments') => Object.values(monthData).reduce((n, d) => n + d[k], 0);
  const reasonCount = (r: Lead['Reason']) => scope.filter(l => l.Reason === r).length;

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view tasks." />;

  const initiatedScope = taskScope === 'initiated';
  const ownerLabel = owner === 'me' ? 'My'
    : owner === 'all' ? 'All'
    : owner === 'unowned' ? (initiatedScope ? 'Not yet started' : 'Unassigned')
    : `${staff.find(s => String(s.id) === owner)?.name ?? ''}'s`;
  const monthStart = new Date(`${date.slice(0, 7)}-01T00:00:00`);
  const monthDays = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const shiftMonth = (by: number) => { const d = new Date(monthStart.getFullYear(), monthStart.getMonth() + by, 1); setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`); };

  const ago = updatedAt ? Math.max(0, Math.round((Date.now() - updatedAt) / 1000)) : null;
  const kpis: [string, number, string, Lead['Reason'] | null][] = view === 'all'
    ? [['Overdue', reasonCount('Overdue'), 'text-rose-600', 'Overdue'], ['Upcoming', reasonCount('Upcoming'), 'text-violet-600', 'Upcoming'], ['Other leads', reasonCount('Lead'), 'text-slate-700', 'Lead']]
    : [['Overdue', reasonCount('Overdue'), 'text-rose-600', 'Overdue'], ['Due today', reasonCount('Follow-up due'), 'text-sky-700', 'Follow-up due'], ['Not contacted', reasonCount('Not contacted'), 'text-orange-600', 'Not contacted'], ['New leads', reasonCount('New lead'), 'text-emerald-600', 'New lead']];

  return (
    <div className="space-y-3 p-4 pb-24">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <div className="mr-auto">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900">My Tasks</h1>
              {view !== 'month' && (
                <button type="button" onClick={() => setLive(v => !v)} title={live ? 'Auto-refreshes every 30 seconds — click to pause' : 'Paused — click to resume live updates'}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${live ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'}`} />
                  {live ? 'Live' : 'Paused'}{ago != null && ` · ${ago < 60 ? `${ago}s` : `${Math.floor(ago / 60)}m`} ago`}
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500">{view === 'all' ? `All leads · last ${days >= 3650 ? 'all time' : `${days} days`}` : fmtLong(date)}{view === 'day' && date === localToday() && ' · Today'}</p>
          </div>
          <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs font-semibold" role="group" aria-label="Lead view">
            {([['day', 'Day'], ['month', 'Month'], ['all', 'All leads']] as const).map(([v, label]) => (
              <button key={v} type="button" onClick={() => { setView(v); if (v === 'all' && canSeeAll) setOwner('all'); }} className={`h-8 px-3 ${view === v ? 'bg-[#2E3093] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{label}</button>
            ))}
          </div>
          {view === 'all' ? (
            <select value={days} onChange={e => setDays(Number(e.target.value))} className={ctrl} aria-label="How far back">
              {[[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days'], [180, 'Last 6 months'], [365, 'Last 1 year'], [3650, 'All time']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ) : view === 'day' && (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setDate(shiftDay(date, -1))} className={`${ctrl} px-2`} aria-label="Previous day">‹</button>
              <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} className={ctrl} />
              <button type="button" onClick={() => setDate(shiftDay(date, 1))} className={`${ctrl} px-2`} aria-label="Next day">›</button>
              {date !== localToday() && <button type="button" onClick={() => setDate(localToday())} className={`${ctrl} font-semibold text-[#2E3093]`}>Today</button>}
            </div>
          )}
          {canSeeAll && <select value={owner} onChange={e => setOwner(e.target.value)} className={ctrl} aria-label="Counsellor">
            <option value="me">Me{me ? ` (${staff.find(s => s.id === me)?.name ?? ''})` : ''}</option>
            <option value="all">All counsellors</option>
            <option value="unowned">Unassigned leads</option>
            {staff.filter(s => s.id !== me).map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
          </select>}
          <button type="button" onClick={() => load()} className={`${ctrl} font-semibold`} aria-label="Refresh now">↻ Refresh</button>
        </div>

        {/* KPI tiles — click to filter */}
        {view !== 'month' && (
          <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3 lg:grid-cols-6">
            {kpis.map(([label, n, c, reason]) => {
              const on = reason != null && fReason.length === 1 && fReason[0] === reason;
              return (
                <button key={label} type="button" onClick={() => reason && setFReason(on ? [] : [reason])}
                  className={`bg-white px-4 py-2.5 text-left transition-colors hover:bg-slate-50 ${on ? 'ring-2 ring-inset ring-[#2E3093]' : ''}`}>
                  <div className={`text-xl font-black ${c}`}>{loading ? '…' : n}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
                </button>
              );
            })}
            <button type="button" onClick={() => setSource(source === 'meta' ? 'all' : 'meta')}
              className={`bg-white px-4 py-2.5 text-left transition-colors hover:bg-slate-50 ${source === 'meta' ? 'ring-2 ring-inset ring-[#2E3093]' : ''}`}>
              <div className="text-xl font-black text-blue-600">{loading ? '…' : metaCount}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Meta leads</div>
            </button>
            {canSeeAll && owner !== 'me' && (
              <div className="bg-white px-4 py-2.5">
                <div className="text-xl font-black text-amber-600">{loading ? '…' : unassignedCount}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Unassigned</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      {view !== 'month' && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
        <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs font-semibold" role="group" aria-label="Lead source">
          {([['all', 'All sources', leads.length], ['meta', 'Meta', metaCount], ['other', 'Other', leads.length - metaCount]] as const).map(([v, label, n]) => (
            <button key={v} type="button" aria-pressed={source === v} onClick={() => setSource(v)} className={`h-8 px-3 ${source === v ? 'bg-[#2E3093] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              {label} <span className={source === v ? 'text-white/70' : 'text-slate-400'}>{n}</span>
            </button>
          ))}
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, mobile, email…" className={`${ctrl} w-52`} />
        <MultiSelect label="Type" options={['Overdue', 'Reminder', 'Not contacted', 'Follow-up due', 'No next step', 'Upcoming', 'New lead', 'Lead']} value={fReason} onChange={setFReason} />
        <MultiSelect label="Status" options={statusOpts} value={fStatus} onChange={setFStatus} />
        <MultiSelect label="Course" options={courseOpts} value={fCourse} onChange={setFCourse} />
        <MultiSelect label="Batches" options={batchOpts} value={fBatch} onChange={setFBatch} />
        <MultiSelect label="Mode" options={modeOpts} value={fMode} onChange={setFMode} />
        <MultiSelect label="Temperature" options={['hot', 'warm', 'cold', 'none']} value={fTemp} onChange={setFTemp} />
        {activeFilters > 0 && <button type="button" onClick={clearFilters} className="text-[11px] font-bold text-rose-600 hover:underline">Clear filters ({activeFilters})</button>}
      </div>}

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-3">
          {view === 'month' ? (
            <section className="rounded-xl border border-slate-200 bg-white">
              <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => shiftMonth(-1)} className={`${ctrl} px-2`} aria-label="Previous month">‹</button>
                  <h2 className="min-w-[130px] text-center text-sm font-black text-slate-800">{monthStart.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2>
                  <button type="button" onClick={() => shiftMonth(1)} className={`${ctrl} px-2`} aria-label="Next month">›</button>
                </div>
                <div className="flex gap-3 text-[10px] font-semibold text-slate-500">
                  <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-500" />Follow-ups</span>
                  <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />New leads</span>
                  <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#2E3093]" />Appointments</span>
                </div>
              </header>
              <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="py-1.5">{d}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({ length: monthStart.getDay() }).map((_, i) => <div key={`pad${i}`} className="min-h-[84px] border-b border-r border-slate-100 bg-slate-50/50" />)}
                {Array.from({ length: monthDays }).map((_, i) => {
                  const key = `${date.slice(0, 7)}-${String(i + 1).padStart(2, '0')}`;
                  const d = monthData[key];
                  const isToday = key === localToday();
                  return (
                    <button
                      key={key} type="button" onClick={() => { setDate(key); setView('day'); }}
                      className={`min-h-[84px] border-b border-r border-slate-100 p-1.5 text-left hover:bg-[#2E3093]/5 ${key === date ? 'bg-[#2E3093]/10' : ''}`}
                    >
                      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${isToday ? 'bg-[#2E3093] text-white' : 'text-slate-600'}`}>{i + 1}</span>
                      {d && (
                        <div className="mt-1 space-y-0.5 text-[10px] font-semibold">
                          {d.followUps > 0 && <div className="rounded bg-sky-100 px-1 text-sky-800">{d.followUps} follow-up{d.followUps > 1 ? 's' : ''}</div>}
                          {d.newLeads > 0 && <div className="rounded bg-emerald-100 px-1 text-emerald-700">{d.newLeads} new</div>}
                          {d.appointments > 0 && <div className="rounded bg-[#2E3093]/10 px-1 text-[#2E3093]">{d.appointments} appt{d.appointments > 1 ? 's' : ''}</div>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {loading && <p className="py-3 text-center text-xs text-slate-400">Loading…</p>}
            </section>
          ) : (<>
          {/* Table 1 — leads */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-700">
                {view === 'all' ? 'All leads' : 'Leads & follow-ups'} <span className="ml-1 text-slate-400">({filtered.length}{filtered.length !== leads.length && ` of ${leads.length}`})</span>
              </h2>
              <span className="text-[10px] text-slate-400">Drag over rows to select · Shift/Ctrl adds</span>
            </header>
            <div ref={wrapRef} onMouseDown={onMouseDown} className="relative max-h-[70vh] overflow-auto select-none">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="w-8 px-3 py-2"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" /></th>
                    <th className="px-2 py-2 text-left">Lead</th>
                    <th className="px-2 py-2 text-left">Type</th>
                    <th className="px-2 py-2 text-left">Inquiry date</th>
                    <th className="px-2 py-2 text-left">Course</th>
                    <th className="px-2 py-2 text-left">Batch</th>
                    <th className="px-2 py-2 text-left">Source</th>
                    <th className="px-2 py-2 text-left">Status</th>
                    <th className="px-2 py-2 text-left">{initiatedScope ? 'Initiated by' : 'Assigned to'}</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={10} className="py-8 text-center text-slate-400">Loading…</td></tr>}
                  {!loading && filtered.length === 0 && <tr><td colSpan={10} className="py-8 text-center text-slate-400">{activeFilters ? 'No leads match these filters.' : view === 'all' ? 'No leads found.' : 'No leads for this day.'}</td></tr>}
                  {!loading && filtered.map(l => {
                    const on = selected.has(l.Inquiry_Id);
                    return (
                      <tr key={l.Inquiry_Id} data-lead-id={l.Inquiry_Id} className={`border-t border-slate-100 ${on ? 'bg-[#2E3093]/10' : freshIds.has(l.Inquiry_Id) ? 'bg-emerald-50/70' : 'hover:bg-slate-50'}`}>
                        <td className="px-3 py-1.5"><input type="checkbox" checked={on} onChange={() => toggle(l.Inquiry_Id)} aria-label={`Select ${l.Student_Name}`} /></td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-800">{l.Student_Name || '—'}</span>
                            {l.Temperature && <span className={`rounded px-1 text-[9px] font-bold uppercase ${TEMP_STYLE[l.Temperature] || ''}`}>{l.Temperature}</span>}
                            {l.IsMeta && <span title={l.MetaCampaign ?? 'Meta lead ad'} className="rounded bg-blue-600 px-1 text-[9px] font-bold uppercase text-white">Meta</span>}
                            {freshIds.has(l.Inquiry_Id) && <span className="rounded bg-emerald-500 px-1 text-[9px] font-bold uppercase text-white">New</span>}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400">{l.Present_Mobile || '—'}</div>
                        </td>
                        <td className="px-2 py-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${REASON_STYLE[l.Reason]}`}>{l.Reason}</span>
                          {l.NextFollowUpDate && l.Reason !== 'New lead' && <div className="mt-0.5 text-[10px] text-slate-400">{l.NextFollowUpDate}</div>}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-slate-500">{l.InquiryDate || '—'}</td>
                        <td className="max-w-[160px] truncate px-2 py-1.5 text-slate-600">{l.CourseName || '—'}</td>
                        <td className="px-2 py-1.5 text-slate-600">{l.Batch_Code || '—'}</td>
                        <td className="max-w-[140px] truncate px-2 py-1.5 text-slate-500" title={l.MetaCampaign ?? l.Inquiry_From ?? ''}>{l.IsMeta ? (l.MetaCampaign || 'Meta') : (l.Inquiry_From || '—')}</td>
                        <td className="px-2 py-1.5 text-slate-600">{l.StatusLabel || '—'}</td>
                        <td className="px-2 py-1.5 text-slate-500">
                          {initiatedScope ? (
                            <>
                              <div>{l.InitiatedByName || <span className="text-slate-300">—</span>}</div>
                              <div className="text-[10px] text-slate-400">{l.OwnerName ? `Allocated: ${l.OwnerName}` : 'Not allocated'}</div>
                            </>
                          ) : (l.OwnerName || <span className="text-slate-300">Unassigned</span>)}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <Link href={`/dashboard/inquiry/add?editId=${l.Inquiry_Id}&returnTo=${encodeURIComponent('/dashboard/my-tasks')}`} className="text-[10px] font-bold text-[#2E3093] hover:underline">Open</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {box && (
                <div
                  className="pointer-events-none absolute rounded border border-[#2E3093] bg-[#2E3093]/15"
                  style={{ left: Math.min(box.x1, box.x2), top: Math.min(box.y1, box.y2), width: Math.abs(box.x2 - box.x1), height: Math.abs(box.y2 - box.y1) }}
                />
              )}
            </div>
          </section>

          {/* Table 2 — appointments */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <header className="border-b border-slate-100 px-3 py-2">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-700">Appointments <span className="ml-1 text-slate-400">({appts.length})</span></h2>
            </header>
            <div className="max-h-[40vh] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Time</th>
                    <th className="px-2 py-2 text-left">Person</th>
                    <th className="px-2 py-2 text-left">Program</th>
                    <th className="px-2 py-2 text-left">Counsellor</th>
                    <th className="px-2 py-2 text-left">Status</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {!loading && appts.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-400">No appointments for this day.</td></tr>}
                  {appts.map(a => (
                    <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="whitespace-nowrap px-3 py-1.5 font-semibold text-slate-700">{fmt12(a.start_time)}</td>
                      <td className="px-2 py-1.5"><div className="font-semibold text-slate-800">{a.name}</div><div className="font-mono text-[10px] text-slate-400">{a.mobile}</div></td>
                      <td className="max-w-[180px] truncate px-2 py-1.5 text-slate-600">{a.program_name || 'Guidance'}</td>
                      <td className="px-2 py-1.5 text-slate-500">{a.counsellor_name || 'Unassigned'}</td>
                      <td className="px-2 py-1.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${APPT_STATUS_STYLE[a.status] || 'bg-slate-100 text-slate-600'}`}>{a.status}</span></td>
                      <td className="px-2 py-1.5 text-right"><button type="button" onClick={() => setOpenAppt(a.id)} className="text-[10px] font-bold text-[#2E3093] hover:underline">Details</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          </>)}
        </div>

        {/* Overview panel */}
        <aside className="xl:sticky xl:top-3 h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Overview</p>
            <p className="text-sm font-bold text-slate-800">{ownerLabel} {initiatedScope ? 'initiated leads' : 'allocated tasks'}</p>
            <p className="text-[11px] text-slate-500">{selected.size ? `${selected.size} selected` : activeFilters ? 'Filtered leads' : view === 'all' ? `All leads (last 90 days + follow-ups)` : 'All leads for the day'}</p>
          </div>
          {view === 'month' && <div className="grid grid-cols-2 gap-2">
            {([['Follow-ups', monthSum('followUps'), 'text-sky-700'], ['New leads', monthSum('newLeads'), 'text-emerald-600'], ['Appointments', monthSum('appointments'), 'text-[#2E3093]']] as [string, number, string][]).map(([label, n, c]) => (
              <div key={label} className="rounded-lg bg-slate-50 p-2">
                <div className={`text-xl font-black ${c}`}>{n}</div>
                <div className="text-[10px] font-semibold text-slate-500">{label}</div>
              </div>
            ))}
          </div>}
          {view !== 'month' && ([['By status', tally(l => l.StatusLabel)], ['By owner', tally(l => l.OwnerName ?? 'Unassigned')], ['By course', tally(l => l.CourseName)], ['By batch', tally(l => l.Batch_Code)]] as const).map(([title, rows]) => (
            <div key={title}>
              <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">{title}</p>
              {rows.length === 0 ? <p className="text-[11px] text-slate-300">—</p> : (
                <ul className="space-y-0.5">
                  {rows.map(([k, n]) => (
                    <li key={k} className="flex justify-between gap-2 text-[11px]"><span className="truncate text-slate-600">{k}</span><span className="font-bold text-slate-800">{n}</span></li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </aside>
      </div>

      <DailyActivityWidget date={date} owner={owner} />

      {/* Sticky allocation bar */}
      {canSeeAll && view !== 'month' && (selected.size > 0 || notice) && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="flex w-full max-w-3xl flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-4 py-2.5 shadow-2xl backdrop-blur">
            {selected.size > 0 ? (<>
              <span className="text-xs font-black text-slate-800">{selected.size} selected</span>
              {(() => { const m = leads.filter(l => selected.has(l.Inquiry_Id) && l.IsMeta).length; return m ? <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">{m} Meta</span> : null; })()}
              <select value={assignTo} onChange={e => setAssignTo(e.target.value)} disabled={!canAssign} className={`${ctrl} ml-auto min-w-[180px]`} aria-label="Assign to">
                <option value="">Assign to counsellor…</option>
                {staff.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
              </select>
              <button type="button" onClick={assign} disabled={!canAssign || !assignTo || assigning} className="h-8 rounded-lg bg-[#2E3093] px-4 text-xs font-bold text-white hover:bg-[#252780] disabled:opacity-40">
                {assigning ? 'Assigning…' : 'Assign'}
              </button>
              <button type="button" onClick={unassign} disabled={!canAssign || assigning} className="h-8 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 disabled:opacity-40">Unassign</button>
              <button type="button" onClick={() => setSelected(new Set())} className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600">Clear</button>
              {!canAssign && <p className="w-full text-[10px] text-slate-400">Only the Mayur account can assign leads to counsellors.</p>}
            </>) : <span className="text-xs font-semibold text-emerald-700">{notice}</span>}
            {selected.size > 0 && notice && <p className="w-full text-[11px] font-semibold text-emerald-700">{notice}</p>}
          </div>
        </div>
      )}

      {openAppt && <AppointmentDetailModal id={openAppt} onClose={() => setOpenAppt(null)} onChanged={() => load()} />}
    </div>
  );
}
