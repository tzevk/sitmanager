'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useRef } from 'react';
import BatchMarketingWidget from './BatchMarketingWidget';
import AnnualTargetsWidget from './AnnualTargetsWidget';
import ContentCalendarWidget from './ContentCalendarWidget';
import { toBatchNumber } from '@/lib/batch-display';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function buildYearOptions(currentYear: number): number[] {
  const years: number[] = [];
  for (let y = currentYear + 1; y >= currentYear - 5; y--) years.push(y);
  return years;
}

/* ── Utilities ────────────────────────────────────────────────────── */
function fmtPct(v: number) {
  return `${Number.isFinite(v) ? v.toFixed(1) : '0.0'}%`;
}

function clamp(v: number) {
  return Math.min(100, Math.max(0, Number.isFinite(v) ? v : 0));
}

function tone(v: number) {
  if (v >= 80) return { text: 'text-emerald-600', bar: 'bg-emerald-500' };
  if (v >= 50) return { text: 'text-amber-600',   bar: 'bg-amber-400'   };
  return         { text: 'text-rose-600',   bar: 'bg-rose-500'   };
}

const TABLE_CLS = 'w-full text-sm [&_th]:border-r [&_th]:border-gray-300 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-gray-200 [&_td:last-child]:border-r-0';

type SeminarStatus = 'Not Started' | 'Confirmed' | 'Completed' | 'Cancelled' | 'Under Discussion';
type ExhibitionStatus = 'Not Started' | 'Confirmed' | 'Completed' | 'Cancelled' | 'Under Discussion';

interface SeminarPlannerRow {
  id: string;
  month: string;
  date: string;
  college: string;
  topic: string;
  speaker: string;
  platforms: string[];
  content_type: string;
  ct_planned: number;
  ct_target: number;
  ct_completed: number;
  status: SeminarStatus;
}

interface ExhibitionPlannerRow {
  id: string;
  title: string;
  date: string;
  location: string;
  status: ExhibitionStatus;
}

const SEMINAR_STATUSES: SeminarStatus[] = ['Not Started', 'Confirmed', 'Completed', 'Cancelled', 'Under Discussion'];
const EXHIBITION_STATUSES: ExhibitionStatus[] = ['Not Started', 'Confirmed', 'Completed', 'Cancelled', 'Under Discussion'];
const SEMINAR_PLATFORMS = ['Instagram', 'Facebook', 'WhatsApp', 'Email', 'Phone Call', 'LinkedIn', 'YouTube', 'Website', 'Google Ads'];

function seminarStatusCls(status: SeminarStatus) {
  if (status === 'Completed')        return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
  if (status === 'Confirmed')        return 'bg-blue-100 text-blue-700 ring-blue-200';
  if (status === 'Cancelled')        return 'bg-rose-100 text-rose-700 ring-rose-200';
  if (status === 'Under Discussion') return 'bg-violet-100 text-violet-700 ring-violet-200';
  return 'bg-gray-100 text-gray-600 ring-gray-200';
}

function exhibitionStatusCls(status: ExhibitionStatus) {
  if (status === 'Completed')        return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
  if (status === 'Confirmed')        return 'bg-blue-100 text-blue-700 ring-blue-200';
  if (status === 'Cancelled')        return 'bg-rose-100 text-rose-700 ring-rose-200';
  if (status === 'Under Discussion') return 'bg-violet-100 text-violet-700 ring-violet-200';
  return 'bg-gray-100 text-gray-600 ring-gray-200';
}

function PlatformMultiSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (p: string) =>
    onChange(value.includes(p) ? value.filter(x => x !== p) : [...value, p]);

  const label = value.length === 0 ? 'Select…' : value.length === 1 ? value[0] : `${value.length} platforms`;

  return (
    <div className="relative min-w-[120px]" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-left text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white flex items-center justify-between gap-1 hover:border-gray-300"
      >
        <span className="truncate text-gray-700">{label}</span>
        <svg className={`w-3 h-3 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
          {SEMINAR_PLATFORMS.map(p => (
            <label key={p} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-xs text-gray-700">
              <input type="checkbox" checked={value.includes(p)} onChange={() => toggle(p)} className="rounded accent-[#2E3093]" />
              {p}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Shared primitives ────────────────────────────────────────────── */
function Bar({ value, className = '' }: { value: number; className?: string }) {
  const t = tone(value);
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${clamp(value)}%` }} />
      </div>
      <span className={`text-[11px] font-bold tabular-nums w-10 text-right ${t.text}`}>
        {fmtPct(value)}
      </span>
    </div>
  );
}

function CardHeader({
  title,
  accent = '#2E3093',
  count,
  icon,
}: {
  title: string;
  accent?: string;
  count?: number;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b"
      style={{
        borderBottomColor: `color-mix(in srgb, ${accent} 15%, #e5e7eb)`,
        background: `linear-gradient(to right, color-mix(in srgb, ${accent} 8%, white), color-mix(in srgb, ${accent} 3%, white) 60%, white)`,
      }}
    >
      <span
        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 20%, white), color-mix(in srgb, ${accent} 10%, white))`,
          boxShadow: `0 1px 4px color-mix(in srgb, ${accent} 25%, transparent)`,
        }}
      >
        <span style={{ color: accent }} className="[&_svg]:w-4 [&_svg]:h-4">{icon}</span>
      </span>
      <span className="font-bold text-gray-800 text-sm flex-1 tracking-tight">{title}</span>
      {count !== undefined && (
        <span
          className="text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-full border"
          style={{
            background: `color-mix(in srgb, ${accent} 10%, white)`,
            color: accent,
            borderColor: `color-mix(in srgb, ${accent} 20%, transparent)`,
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function Empty({ text = 'No data available' }: { text?: string }) {
  return <p className="px-5 py-6 text-center text-sm text-gray-400">{text}</p>;
}

function PulseRows({ cols, rows = 4 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-2">
              <div
                className="h-3 bg-gray-100 rounded animate-pulse"
                style={{ width: j === 0 ? '70%' : '40%' }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function Th({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <th className={`py-2 px-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap ${center ? 'text-center' : 'text-left'}`}>
      {children}
    </th>
  );
}

/* ── Icon set ─────────────────────────────────────────────────────── */
const Icons = {
  funnel:    <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>,
  target:    <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
  calendar:  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 9h18M8 4V2m8 2V2" /></svg>,
  star:      <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
  batch:     <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
  bell:      <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  activity:  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  pie:       <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>,
  wallet:    <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18M7 14h.01M11 14h.01M3 6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" /></svg>,
  grad:      <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>,
};

/* ── Component ────────────────────────────────────────────────────── */
export default function CbdDashboard({ data, loading }: { data: any; loading: boolean }) {
  const seminarTargets  = data?.seminarTargets ?? [];
  const pendingFollowups = data?.pendingFollowups ?? [];
  const dailyActivity   = data?.dailyActivity ?? [];
  const pendingFees     = data?.pendingFees ?? [];
  const alumniProgress  = data?.alumniRegistration ?? [];
  const sourceRows      = data?.sourcePerformance ?? [];

  // ── Lead funnel filter state ────────────────────────────────────
  const nowYear  = new Date().getFullYear();
  const nowMonth = new Date().getMonth() + 1; // 1-12
  const [filterMode,  setFilterMode]  = React.useState<'year' | 'month'>('month');
  const [filterYear,  setFilterYear]  = React.useState(nowYear);
  const [filterMonth, setFilterMonth] = React.useState(nowMonth);
  const [localFunnel, setLocalFunnel] = React.useState<{ total: number; contacted: number; interested: number; converted: number } | null>(null);
  const [funnelLoading, setFunnelLoading] = React.useState(false);
  const fetchAbortRef = useRef<AbortController | null>(null);

  const fetchFunnel = useCallback(async (mode: 'year' | 'month', year: number, month: number) => {
    if (fetchAbortRef.current) fetchAbortRef.current.abort();
    const ctrl = new AbortController();
    fetchAbortRef.current = ctrl;
    setFunnelLoading(true);
    try {
      const params = new URLSearchParams({ year: String(year) });
      if (mode === 'month') params.set('month', String(month));
      const res = await fetch(`/api/dashboard/cbd-lead-funnel?${params}`, { signal: ctrl.signal });
      if (!res.ok) return;
      const json = await res.json();
      setLocalFunnel(json);
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error('funnel fetch error', e);
    } finally {
      setFunnelLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFunnel(filterMode, filterYear, filterMonth);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMode, filterYear, filterMonth]);

  const initialSeminarPlan = React.useMemo<SeminarPlannerRow[]>(() => {
    return (seminarTargets as any[]).map((row: any, i: number) => ({
      id: String(row.id ?? `seminar-${i}`),
      month: String(row.month ?? ''),
      date: String(row.date ?? ''),
      college: String(row.college_name ?? ''),
      topic: String(row.topic ?? ''),
      speaker: String(row.speaker ?? ''),
      platforms: [],
      content_type: '',
      ct_planned: 0,
      ct_target: 0,
      ct_completed: 0,
      status: 'Not Started' as SeminarStatus,
    }));
  }, [seminarTargets]);

  const initialExhibitionPlan = React.useMemo<ExhibitionPlannerRow[]>(() => {
    const seededRows = Array.isArray(data?.exhibitionTargets?.rows)
      ? data.exhibitionTargets.rows
      : [];

    if (seededRows.length > 0) {
      return seededRows.map((row: any, i: number) => ({
        id: String(row.id ?? `exhibition-${i}`),
        title: String(row.title ?? row.exhibition_name ?? ''),
        date: String(row.date ?? row.exhibition_date ?? ''),
        location: String(row.location ?? row.city ?? ''),
        status: EXHIBITION_STATUSES.includes(String(row.status) as ExhibitionStatus)
          ? (String(row.status) as ExhibitionStatus)
          : 'Not Started',
      }));
    }

    const plannedCount = Math.max(0, Number(data?.exhibitionTargets?.planned || 0));
    const placeholderCount = Math.min(plannedCount, 3);
    return Array.from({ length: placeholderCount }).map((_, i) => ({
      id: `exhibition-plan-${i}`,
      title: '',
      date: '',
      location: '',
      status: 'Not Started' as ExhibitionStatus,
    }));
  }, [data?.exhibitionTargets]);

  const seminarSeedSignature = React.useMemo(
    () => initialSeminarPlan
      .map(r => `${r.id}|${r.month}|${r.date}|${r.college}|${r.topic}|${r.speaker}|${r.status}`)
      .join('||'),
    [initialSeminarPlan]
  );

  const [seminarPlan, setSeminarPlan] = React.useState<SeminarPlannerRow[]>([]);
  const [exhibitionPlan, setExhibitionPlan] = React.useState<ExhibitionPlannerRow[]>([]);
  const lastSeminarSeedRef = React.useRef('');
  const lastExhibitionSeedRef = React.useRef('');

  React.useEffect(() => {
    if (!seminarSeedSignature) return;
    if (seminarSeedSignature === lastSeminarSeedRef.current) return;
    setSeminarPlan(initialSeminarPlan);
    lastSeminarSeedRef.current = seminarSeedSignature;
  }, [initialSeminarPlan, seminarSeedSignature]);

  const exhibitionSeedSignature = React.useMemo(
    () => initialExhibitionPlan
      .map(r => `${r.id}|${r.title}|${r.date}|${r.location}|${r.status}`)
      .join('||'),
    [initialExhibitionPlan]
  );

  React.useEffect(() => {
    if (exhibitionSeedSignature === lastExhibitionSeedRef.current) return;
    setExhibitionPlan(initialExhibitionPlan);
    lastExhibitionSeedRef.current = exhibitionSeedSignature;
  }, [initialExhibitionPlan, exhibitionSeedSignature]);

  const updateSeminarRow = (id: string, update: Partial<SeminarPlannerRow>) => {
    setSeminarPlan(prev => prev.map(r => (r.id === id ? { ...r, ...update } : r)));
  };

  const addSeminarRow = () => {
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSeminarPlan(prev => ([
      ...prev,
      { id: uid, month: '', date: '', college: '', topic: '', speaker: '', platforms: [], content_type: '', ct_planned: 0, ct_target: 0, ct_completed: 0, status: 'Not Started' as SeminarStatus },
    ]));
  };

  const removeSeminarRow = (id: string) => {
    setSeminarPlan(prev => prev.filter(r => r.id !== id));
  };

  const setExhibitionField = (id: string, key: keyof ExhibitionPlannerRow, value: string) => {
    setExhibitionPlan(prev => prev.map(r => (r.id === id ? { ...r, [key]: value } : r)));
  };

  const addExhibitionRow = () => {
    const uid = `exhibition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setExhibitionPlan(prev => ([
      ...prev,
      { id: uid, title: '', date: '', location: '', status: 'Not Started' as ExhibitionStatus },
    ]));
  };

  const removeExhibitionRow = (id: string) => {
    setExhibitionPlan(prev => prev.filter(r => r.id !== id));
  };

  // Keep rows that have a batch code; SDate can be null for inquiry-only batch codes.
  const upcomingBatches = (data?.upcomingBatches ?? []).filter(
    (b: any) => !!(b?.Batch_code || b?.batchCode)
  );

  // Use locally filtered funnel data; fall back to prop data only on initial load
  const activeFunnel = localFunnel ?? {
    total:     Number(data?.leadFunnel?.total     || 0),
    contacted: Number(data?.leadFunnel?.contacted || 0),
    interested:Number(data?.leadFunnel?.interested|| 0),
    converted: Number(data?.leadFunnel?.converted || 0),
  };

  const funnelSteps = [
    { label: 'Total Enquiries', value: activeFunnel.total,      pct: null,                                                                            color: '#2E3093', bg: 'bg-indigo-50/70' },
    { label: 'Contacted',       value: activeFunnel.contacted,  pct: activeFunnel.total ? activeFunnel.contacted  / activeFunnel.total * 100 : null,  color: '#2A6BB5', bg: 'bg-blue-50/70'   },
    { label: 'Interested',      value: activeFunnel.interested, pct: activeFunnel.total ? activeFunnel.interested / activeFunnel.total * 100 : null,  color: '#059669', bg: 'bg-emerald-50/70' },
    { label: 'Converted',       value: activeFunnel.converted,  pct: activeFunnel.total ? activeFunnel.converted  / activeFunnel.total * 100 : null,  color: '#D97706', bg: 'bg-amber-50/70'   },
  ];

  return (
    <div className="space-y-3 pb-4 rounded-2xl bg-gradient-to-br from-indigo-50/60 via-blue-50/40 to-purple-50/30 p-2">

      {/* ①  Total Lead Funnel Summary */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <CardHeader title="Total Lead Funnel Summary" accent="#2E3093" icon={Icons.funnel} />

        {/* Filter bar */}
        <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/60 flex flex-wrap items-center gap-3">
          {/* Mode toggle */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200 text-[11px] font-bold">
            <button
              onClick={() => setFilterMode('month')}
              className={`px-3 py-1.5 transition-colors ${filterMode === 'month' ? 'bg-[#2E3093] text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              By Month
            </button>
            <button
              onClick={() => setFilterMode('year')}
              className={`px-3 py-1.5 transition-colors ${filterMode === 'year' ? 'bg-[#2E3093] text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              By Year
            </button>
          </div>

          {/* Year selector */}
          <select
            value={filterYear}
            onChange={e => setFilterYear(Number(e.target.value))}
            className="text-[11px] font-semibold border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20"
          >
            {buildYearOptions(nowYear).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Month selector (only in month mode) */}
          {filterMode === 'month' && (
            <select
              value={filterMonth}
              onChange={e => setFilterMonth(Number(e.target.value))}
              className="text-[11px] font-semibold border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>{name}</option>
              ))}
            </select>
          )}

          <span className="ml-auto text-[10px] font-semibold text-gray-400">
            {filterMode === 'month'
              ? `${MONTH_NAMES[filterMonth - 1]} ${filterYear}`
              : `Full Year ${filterYear}`}
          </span>
          {funnelLoading && (
            <div className="w-3.5 h-3.5 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {loading ? (
          <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className={`grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100 transition-opacity ${funnelLoading ? 'opacity-50' : ''}`}>
            {funnelSteps.map((step, i) => (
              <div key={step.label} className={`flex flex-col items-center justify-center py-4 px-4 text-center relative ${step.bg}`}>
                {i > 0 && i < 4 && (
                  <div className="hidden sm:block absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10">
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{step.label}</p>
                <p className="text-2xl font-black tabular-nums leading-none" style={{ color: step.color }}>
                  {step.value.toLocaleString('en-IN')}
                </p>
                {step.pct !== null && (
                  <p className="text-[11px] text-gray-400 mt-1">{fmtPct(step.pct)} of total</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ②  Upcoming Batches (next 3 months) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <CardHeader
          title="Upcoming Batches (next 3 months)"
          accent="#2A6BB5"
          icon={Icons.batch}
          count={loading ? undefined : upcomingBatches.length}
        />
        <div className="overflow-x-auto">
          <div className="max-h-72 overflow-y-auto">
            <table className={TABLE_CLS}>
              <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                <tr>
                  <Th>Batch number</Th>
                  <Th>Training Program Name</Th>
                  <Th center>Start Date</Th>
                  <Th center>Enquiries Received</Th>
                  <Th center>Enquiries Contacted</Th>
                  <Th center>Interested Students</Th>
                  <Th center>Confirmed Admissions</Th>
                  <Th>% Filled</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <PulseRows cols={8} rows={5} />
                ) : upcomingBatches.length === 0 ? (
                  <tr><td colSpan={8}><Empty text="No upcoming batches for the next 3 months" /></td></tr>
                ) : (
                  upcomingBatches.map((b: any, i: number) => {
                    const enrolled  = Number(b.Enrolled ?? b.NoStudent ?? 0);
                    const max       = Number(b.Max_Students || 0);
                    const fillPct   = max > 0 ? (enrolled / max) * 100 : 0;
                    const sDate     = b.SDate ? String(b.SDate).slice(0, 10) : null;
                    const fmtStart  = sDate ? `${sDate.slice(8)}/${sDate.slice(5,7)}/${sDate.slice(0,4)}` : '—';
                    return (
                      <tr key={`${b.Batch_Id || i}`} className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className="font-mono font-semibold text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">{toBatchNumber(b.Batch_code)}</span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700 font-medium">{b.CourseName || '—'}</td>
                        <td className="px-4 py-2.5 text-center tabular-nums text-[11px] font-medium text-gray-600 whitespace-nowrap">{fmtStart}</td>
                        <td className="px-4 py-2.5 text-center tabular-nums text-gray-600">{b.Enquiries_Received ?? 0}</td>
                        <td className="px-4 py-2.5 text-center tabular-nums text-gray-600">{b.Enquiries_Contacted ?? 0}</td>
                        <td className="px-4 py-2.5 text-center tabular-nums text-gray-600">{b.Interested_Students ?? 0}</td>
                        <td className="px-4 py-2.5 text-center tabular-nums font-semibold text-gray-800">{Number(b.Confirmed_Admissions ?? 0)}</td>
                        <td className="px-4 py-2.5 w-40"><Bar value={fillPct} /></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ②½  Batch Marketing Tracker */}
      <BatchMarketingWidget />

      {/* ①¾  Content Calendar */}
      <ContentCalendarWidget />

      {/* ②  Annual Targets — data loaded from uploaded Excel */}
      <AnnualTargetsWidget />

      {/* ③  Seminar Schedule Planner */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <CardHeader
          title="Seminar Schedule Planner"
          accent="#2A6BB5"
          icon={Icons.calendar}
          count={loading ? undefined : seminarPlan.length}
        />
        <div className="px-4 py-2 border-b border-gray-200 bg-sky-50/40 flex items-center justify-between">
          <p className="text-[11px] text-slate-600 font-medium">Manage upcoming seminar slots in one planner.</p>
          <button
            onClick={addSeminarRow}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-white bg-[#2A6BB5] hover:bg-[#235894] transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Slot
          </button>
        </div>
        <div className="overflow-x-auto">
          <div className="max-h-72 overflow-y-auto">
            <table className={TABLE_CLS}>
              <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                <tr>
                  <Th center>Date</Th>
                  <Th>Month</Th>
                  <Th>College</Th>
                  <Th>Topic</Th>
                  <Th>Speaker</Th>
                  <Th>Status</Th>
                  <Th center>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <PulseRows cols={7} />
                ) : seminarPlan.length === 0 ? (
                  <tr><td colSpan={7}><Empty text="No seminar schedule rows available" /></td></tr>
                ) : (
                  seminarPlan.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                      <td className="px-3 py-2.5">
                        <input type="date" value={row.date} onChange={e => updateSeminarRow(row.id, { date: e.target.value })} className="w-full min-w-[125px] text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white" />
                      </td>
                      <td className="px-3 py-2.5">
                        <input type="text" value={row.month} onChange={e => updateSeminarRow(row.id, { month: e.target.value })} placeholder="Month" className="w-full min-w-[80px] text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white" />
                      </td>
                      <td className="px-3 py-2.5">
                        <input type="text" value={row.college} onChange={e => updateSeminarRow(row.id, { college: e.target.value })} placeholder="College" className="w-full min-w-[150px] text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white" />
                      </td>
                      <td className="px-3 py-2.5">
                        <input type="text" value={row.topic} onChange={e => updateSeminarRow(row.id, { topic: e.target.value })} placeholder="Topic" className="w-full min-w-[130px] text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white" />
                      </td>
                      <td className="px-3 py-2.5">
                        <input type="text" value={row.speaker} onChange={e => updateSeminarRow(row.id, { speaker: e.target.value })} placeholder="Speaker" className="w-full min-w-[110px] text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white" />
                      </td>
                      <td className="px-3 py-2.5">
                        <select value={row.status} onChange={e => updateSeminarRow(row.id, { status: e.target.value as SeminarStatus })} className={`w-full min-w-[140px] text-[11px] font-semibold rounded-full px-2 py-1 border-0 ring-1 ${seminarStatusCls(row.status)}`}>
                          {SEMINAR_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => removeSeminarRow(row.id)} className="inline-flex items-center justify-center p-1.5 rounded-md text-rose-500 hover:bg-rose-50 transition-colors" title="Remove row">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Exhibition Planner */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <CardHeader
          title="Exhibition Planner"
          accent="#2E3093"
          icon={Icons.star}
          count={loading ? undefined : exhibitionPlan.length}
        />
        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />)}
          </div>
        ) : (
          <div>
            <div className="px-4 py-2 border-b border-gray-200 bg-indigo-50/50 flex items-center justify-between">
              <p className="text-[11px] text-slate-600 font-medium">Manage upcoming exhibition slots.</p>
              <button
                onClick={addExhibitionRow}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-white bg-[#2E3093] hover:bg-[#25267d] transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Slot
              </button>
            </div>
            <div className="overflow-x-auto">
              <div className="max-h-64 overflow-y-auto">
                <table className={TABLE_CLS}>
                  <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                    <tr>
                      <Th>Exhibition</Th>
                      <Th center>Date</Th>
                      <Th>Location</Th>
                      <Th>Status</Th>
                      <Th center>Action</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {exhibitionPlan.length === 0 ? (
                      <tr><td colSpan={5}><Empty text="No exhibition slots planned" /></td></tr>
                    ) : (
                      exhibitionPlan.map((row) => (
                        <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                          <td className="px-3 py-2">
                            <input type="text" value={row.title} onChange={e => setExhibitionField(row.id, 'title', e.target.value)} placeholder="Exhibition name" className="w-full min-w-[180px] text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="date" value={row.date} onChange={e => setExhibitionField(row.id, 'date', e.target.value)} className="w-full min-w-[125px] text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" value={row.location} onChange={e => setExhibitionField(row.id, 'location', e.target.value)} placeholder="Location" className="w-full min-w-[140px] text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white" />
                          </td>
                          <td className="px-3 py-2">
                            <select value={row.status} onChange={e => setExhibitionField(row.id, 'status', e.target.value as ExhibitionStatus)} className={`w-full min-w-[140px] text-[11px] font-semibold rounded-full px-2 py-1 border-0 ring-1 ${exhibitionStatusCls(row.status)}`}>
                              {EXHIBITION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => removeExhibitionRow(row.id)} className="inline-flex items-center justify-center p-1.5 rounded-md text-rose-500 hover:bg-rose-50 transition-colors" title="Remove row">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ⑤  Pending Followups · Daily Activity Tracker · Source Wise Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Pending Followups */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <CardHeader
            title="Pending Followups"
            accent="#DC2626"
            icon={Icons.bell}
            count={loading ? undefined : pendingFollowups.length}
          />
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />)}
              </div>
            ) : pendingFollowups.length === 0 ? (
              <Empty text="No pending followups" />
            ) : (
              <div className="divide-y divide-gray-100">
                {pendingFollowups.map((f: any, i: number) => (
                  <div key={`${f.id || i}`} className={`flex items-center gap-3 px-4 py-2 hover:bg-rose-50/30 ${i % 2 === 0 ? 'bg-white' : 'bg-rose-50/20'}`}>
                    <div className="w-7 h-7 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {(f.name || f.student_name || 'F')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 truncate">{f.name || f.student_name || 'Followup'}</p>
                      <p className="text-[11px] text-gray-400">{f.next_followup_date || '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Daily Activity Tracker */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <CardHeader title="Daily Activity Tracker" accent="#2E3093" icon={Icons.activity} />
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />)}
              </div>
            ) : dailyActivity.length === 0 ? (
              <Empty text="No daily activity data" />
            ) : (
              <div className="divide-y divide-gray-100">
                {dailyActivity.map((a: any, i: number) => (
                  <div key={`${a.id || i}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50/50">
                    <span className="text-sm text-gray-600">{a.label || a.activity || '—'}</span>
                    <span className={`text-sm font-black tabular-nums px-2.5 py-0.5 rounded-full ${
                      i === 0 ? 'bg-blue-100 text-blue-700' :
                      i === 1 ? 'bg-emerald-100 text-emerald-700' :
                               'bg-amber-100 text-amber-700'
                    }`}>{a.value ?? 0}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Source Wise Performance */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <CardHeader
            title="Source Wise Performance"
            accent="#2A6BB5"
            icon={Icons.pie}
            count={loading ? undefined : sourceRows.length}
          />
          <div className="max-h-64 overflow-auto">
            {loading ? (
              <div className="p-4 space-y-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />)}
              </div>
            ) : sourceRows.length === 0 ? (
              <Empty text="No source data available" />
            ) : (
              <table className={TABLE_CLS}>
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <tr>
                    <Th>Source</Th>
                    <Th center>Leads</Th>
                    <Th center>Admissions</Th>
                    <Th>Conversion %</Th>
                  </tr>
                </thead>
                <tbody>
                  {sourceRows.map((r: any, i: number) => {
                    const conv = Number(r.conversion_pct || 0);
                    const t = tone(conv);
                    return (
                      <tr key={`${r.source || i}`} className={`border-t border-gray-100 transition-colors ${i === 0 ? 'bg-blue-50/40 hover:bg-blue-50/60' : 'hover:bg-gray-50/50'}`}>
                        <td className="px-5 py-2.5 font-medium text-gray-700 truncate max-w-[8rem]">
                          {i === 0 && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 mb-0.5" />}
                          {r.source || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center tabular-nums">
                          <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{r.leads ?? 0}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center tabular-nums">
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{r.admissions ?? 0}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs font-bold tabular-nums ${t.text}`}>{fmtPct(conv)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ⑥  Pending Fees · Alumni Registration Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* Pending Fees */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <CardHeader
            title="Pending Fees"
            accent="#DC2626"
            icon={Icons.wallet}
            count={loading ? undefined : pendingFees.length}
          />
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />)}
              </div>
            ) : pendingFees.length === 0 ? (
              <Empty text="No pending fees" />
            ) : (
              <div className="divide-y divide-gray-100">
                {pendingFees.map((f: any, i: number) => (
                  <div key={`${f.id || i}`} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50/50">
                    <span className="text-sm text-gray-700 truncate max-w-[55%]">
                      {f.student_name || f.name || 'Student'}
                    </span>
                    <span className={`text-sm font-bold tabular-nums px-2 py-0.5 rounded-md ${
                      Number(f.amount) >= 20000 ? 'bg-red-100 text-red-700' :
                      Number(f.amount) >= 10000 ? 'bg-orange-100 text-orange-700' :
                                                  'bg-rose-50 text-rose-600'
                    }`}>
                      {f.amount ? `₹ ${Number(f.amount).toLocaleString('en-IN')}` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Alumni Registration Progress */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <CardHeader
            title="Alumni Registration Progress"
            accent="#2E3093"
            icon={Icons.grad}
            count={loading ? undefined : alumniProgress.length}
          />
          <div className="max-h-64 overflow-auto">
            {loading ? (
              <div className="p-4 space-y-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />)}
              </div>
            ) : alumniProgress.length === 0 ? (
              <Empty text="No alumni registration data" />
            ) : (
              <table className={TABLE_CLS}>
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <tr>
                    <Th>Batch No.</Th>
                    <Th>Training Program Name</Th>
                    <Th>% Registered</Th>
                  </tr>
                </thead>
                <tbody>
                  {alumniProgress.map((r: any, i: number) => (
                    <tr key={`${r.batch_no || i}`} className="border-t border-gray-100 hover:bg-gray-50/50">
                      <td className="px-4 py-2 font-mono text-gray-700">{toBatchNumber(r.batch_no)}</td>
                      <td className="px-3 py-2 text-gray-700">{r.training_program || '—'}</td>
                      <td className="px-3 py-2 w-40"><Bar value={Number(r.registered_pct || 0)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
