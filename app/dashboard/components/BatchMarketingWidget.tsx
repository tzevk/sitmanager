'use client';

import { useCallback, useState, useEffect } from 'react';

type BMStatus   = 'Pending' | 'In Progress' | 'Done';
type StatusField = 'flyer_status' | 'announcement_status' | 'meta_ads_status';

interface MarketingRecord {
  id: number;
  batch_name: string;
  training_name: string;
  batch_start_date: string | null;
  flyer_status: BMStatus;
  announcement_status: BMStatus;
  meta_ads_status: BMStatus;
  is_locked: number;
}

interface BatchOption {
  Batch_Id: number;
  Batch_code: string;
  Course_Name: string | null;
  SDate: string | null;
}

interface AnnualBatchApiRow {
  Batch_Id: number;
  Batch_code: string;
  Course_Name: string | null;
  SDate: string | null;
}

function batchIdentity(batch: BatchOption): string {
  return `${batch.Batch_code}::${batch.Batch_Id}`;
}

interface LocalStatus {
  id?: number;
  flyer_status: BMStatus;
  announcement_status: BMStatus;
  meta_ads_status: BMStatus;
  is_locked: boolean;
}

const DEFAULT_STATUS: Omit<LocalStatus, 'id'> = {
  flyer_status: 'Pending',
  announcement_status: 'Pending',
  meta_ads_status: 'Pending',
  is_locked: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function subtractMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function toDateStr(val: string | null | undefined): string {
  if (!val) return '';
  const s = typeof val === 'string' ? val : new Date(val).toISOString();
  return s.slice(0, 10);
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const due   = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / 864e5);
}

type Urgency = 'red' | 'orange' | 'yellow' | null;

function taskUrgency(dueDate: string | null | undefined, status: BMStatus): Urgency {
  if (status === 'Done') return null;
  const days = daysUntil(dueDate);
  if (days === null) return null;
  if (days <= 3)  return 'red';
  if (days <= 7)  return 'orange';
  if (days <= 14) return 'yellow';
  return null;
}

const URG_CELL: Record<NonNullable<Urgency>, string> = {
  red:    'bg-red-50/80',
  orange: 'bg-orange-50/80',
  yellow: 'bg-yellow-50/60',
};

const URG_DOT: Record<NonNullable<Urgency>, string> = {
  red:    'bg-red-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-500',
};

function statusCls(status: BMStatus) {
  if (status === 'Done')        return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
  if (status === 'In Progress') return 'bg-blue-100 text-blue-700 ring-blue-200';
  return 'bg-amber-100 text-amber-700 ring-amber-200';
}

// ── Task cells: split due date and status into separate columns ───────────────
function TaskCells({
  status,
  field,
  batch,
  dueDate,
  onUpdate,
  disabled,
}: {
  status: BMStatus;
  field: StatusField;
  batch: BatchOption;
  dueDate: string | null;
  onUpdate: (batch: BatchOption, field: StatusField, val: BMStatus) => void;
  disabled: boolean;
}) {
  const urg = taskUrgency(dueDate, status);

  return (
    <>
      <td className={`px-3 py-2 text-center ${urg ? URG_CELL[urg] : ''}`}>
        <div className="inline-flex items-center gap-1.5">
          <span className="text-[10px] font-medium tabular-nums text-gray-600 whitespace-nowrap">
            {fmtDate(dueDate)}
          </span>
          {urg && <span className={`w-2 h-2 rounded-full ${URG_DOT[urg]}`} title="Urgency indicator" />}
        </div>
      </td>
      <td className="px-3 py-2 text-center">
        <select
          value={status}
          disabled={disabled}
          onChange={e => onUpdate(batch, field, e.target.value as BMStatus)}
          className={`text-[10px] font-bold rounded-full px-2 py-0.5 border-0 ring-1 outline-none transition-colors ${statusCls(status)} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <option value="Pending">○ Pending</option>
          <option value="In Progress">◑ In Progress</option>
          <option value="Done">✓ Done</option>
        </select>
      </td>
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function BatchMarketingWidget() {
  const [batches, setBatches]   = useState<BatchOption[]>([]);
  const [statuses, setStatuses] = useState<Map<string, LocalStatus>>(new Map());
  const [saving, setSaving]     = useState<Set<string>>(new Set());
  const [loading, setLoading]   = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const toDate = endOfMonth(addMonths(startOfCurrentMonth, 5));
      const fromDateStr = toDateStr(startOfCurrentMonth.toISOString());
      const toDateStrVal = toDateStr(toDate.toISOString());

      const [batchRes, marketingRes] = await Promise.all([
        // Use Annual Batch master source and constrain to upcoming 6 months.
        fetch(`/api/masters/annual-batch?page=1&limit=500&fromDate=${fromDateStr}&toDate=${toDateStrVal}`),
        fetch('/api/cbd-batch-marketing', { cache: 'no-store' }),
      ]);
      const batchData = batchRes.ok ? await batchRes.json() : { data: [] };
      const marketingData = marketingRes.ok ? await marketingRes.json() : { rows: [] };

      const annualRows = (batchData.data ?? []) as AnnualBatchApiRow[];
      const allBatches: BatchOption[] = [];
      for (const b of annualRows) {
        const sDate = toDateStr(b.SDate);
        if (!sDate) continue;
        allBatches.push({
          Batch_Id: b.Batch_Id,
          Batch_code: b.Batch_code,
          Course_Name: b.Course_Name,
          SDate: b.SDate,
        });
      }
      setBatches(
        allBatches.sort((a, b) => {
          const c = (a.Course_Name ?? '').localeCompare(b.Course_Name ?? '');
          if (c !== 0) return c;
          return toDateStr(a.SDate).localeCompare(toDateStr(b.SDate));
        })
      );

      const map = new Map<string, LocalStatus>();
      for (const r of (marketingData.rows ?? []) as MarketingRecord[]) {
        map.set(r.batch_name, {
          id:                  r.id,
          flyer_status:        r.flyer_status,
          announcement_status: r.announcement_status,
          meta_ads_status:     r.meta_ads_status,
          is_locked:           r.is_locked === 1,
        });
      }
      setStatuses(map);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const upsert = useCallback(async (
    batch: BatchOption,
    next: Omit<LocalStatus, 'id'>,
    currentId?: number,
  ): Promise<number | undefined> => {
    const batchCode = batchIdentity(batch);
    const startDate = toDateStr(batch.SDate);
    const payload = {
      batch_name:          batchCode,
      training_name:       batch.Course_Name ?? '',
      batch_start_date:    startDate || null,
      flyer_status:        next.flyer_status,
      announcement_status: next.announcement_status,
      meta_ads_status:     next.meta_ads_status,
      is_locked:           next.is_locked ? 1 : 0,
    };
    if (currentId) {
      await fetch(`/api/cbd-batch-marketing/${currentId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      return currentId;
    }
    const res = await fetch('/api/cbd-batch-marketing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) return (await res.json()).row?.id;
  }, []);

  const handleStatusChange = useCallback(async (batch: BatchOption, field: StatusField, value: BMStatus) => {
    const key = batchIdentity(batch);
    const current = statuses.get(key) ?? statuses.get(batch.Batch_code);
    if (current?.is_locked) return;
    const next: Omit<LocalStatus, 'id'> = { ...(current ?? DEFAULT_STATUS), [field]: value };
    setStatuses(prev => {
      const m = new Map(prev);
      m.set(key, { ...next, id: current?.id });
      return m;
    });
    setSaving(prev => new Set([...prev, key]));
    try {
      const newId = await upsert(batch, next, current?.id);
      if (newId && !current?.id) {
        setStatuses(prev => {
          const m = new Map(prev);
          const s = m.get(key);
          if (s) m.set(key, { ...s, id: newId });
          return m;
        });
      }
    } catch {
      setStatuses(prev => {
        const m = new Map(prev);
        if (current) m.set(key, current);
        else m.delete(key);
        return m;
      });
    } finally {
      setSaving(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  }, [statuses, upsert]);

  const handleLockToggle = useCallback(async (batch: BatchOption, lock: boolean) => {
    const key = batchIdentity(batch);
    const current = statuses.get(key) ?? statuses.get(batch.Batch_code);
    const next: Omit<LocalStatus, 'id'> = { ...(current ?? DEFAULT_STATUS), is_locked: lock };
    setStatuses(prev => {
      const m = new Map(prev);
      m.set(key, { ...next, id: current?.id });
      return m;
    });
    setSaving(prev => new Set([...prev, key]));
    try {
      const newId = await upsert(batch, next, current?.id);
      if (newId && !current?.id) {
        setStatuses(prev => {
          const m = new Map(prev);
          const s = m.get(key);
          if (s) m.set(key, { ...s, id: newId });
          return m;
        });
      }
    } catch {
      setStatuses(prev => {
        const m = new Map(prev);
        if (current) m.set(key, current);
        else m.delete(key);
        return m;
      });
    } finally {
      setSaving(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  }, [statuses, upsert]);

  const handleDelete = useCallback(async (batch: BatchOption) => {
    const key = batchIdentity(batch);
    const record = statuses.get(key) ?? statuses.get(batch.Batch_code);
    if (!record?.id) return;
    if (!confirm('Delete marketing record? Statuses will reset to Pending.')) return;
    setSaving(prev => new Set([...prev, key]));
    try {
      await fetch(`/api/cbd-batch-marketing/${record.id}`, { method: 'DELETE' });
      setStatuses(prev => {
        const m = new Map(prev);
        m.delete(key);
        return m;
      });
    } finally {
      setSaving(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  }, [statuses]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100" style={{ borderLeft: '3px solid #2A6BB5' }}>
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, #2A6BB5 10%, transparent)' }}>
          <svg className="w-3.5 h-3.5" style={{ color: '#2A6BB5' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
        </span>
        <span className="font-bold text-gray-800 text-sm flex-1">Batch Marketing Tracker</span>
        {!loading && (
          <span className="text-[11px] font-semibold text-gray-400 tabular-nums">
            {batches.length} {batches.length === 1 ? 'batch' : 'batches'} · next 6 months
          </span>
        )}
      </div>

      {/* Legends */}
      <div className="px-5 py-2.5 border-b border-gray-100 bg-gray-50/60 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px]">
        <div className="flex items-center gap-2">
          <span className="font-semibold uppercase tracking-wide text-gray-500">Urgency</span>
          <span className="inline-flex items-center gap-1 text-gray-600"><span className="w-2 h-2 rounded-full bg-red-500" /> 0-3d</span>
          <span className="inline-flex items-center gap-1 text-gray-600"><span className="w-2 h-2 rounded-full bg-orange-500" /> 4-7d</span>
          <span className="inline-flex items-center gap-1 text-gray-600"><span className="w-2 h-2 rounded-full bg-yellow-500" /> 8-14d</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold uppercase tracking-wide text-gray-500">Status</span>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 bg-amber-100 text-amber-700 ring-amber-200">Pending</span>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 bg-blue-100 text-blue-700 ring-blue-200">In Progress</span>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 bg-emerald-100 text-emerald-700 ring-emerald-200">Done</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <div className="max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-4 text-[10px] font-semibold uppercase tracking-wide text-gray-500 text-left">Training Program</th>
                <th className="py-2.5 px-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 text-left whitespace-nowrap">Batch</th>
                <th className="py-2.5 px-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 text-center whitespace-nowrap">Start Date</th>
                <th className="py-2.5 px-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 text-center whitespace-nowrap">Ann Date</th>
                <th className="py-2.5 px-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 text-center whitespace-nowrap">Ann Status</th>
                <th className="py-2.5 px-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 text-center whitespace-nowrap">Meta Date</th>
                <th className="py-2.5 px-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 text-center whitespace-nowrap">Meta Status</th>
                <th className="py-2.5 px-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 text-center whitespace-nowrap">Flyer Date</th>
                <th className="py-2.5 px-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 text-center whitespace-nowrap">Flyer Status</th>
                <th className="py-2.5 px-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 text-center w-20 sticky right-0 z-20 bg-gray-50 whitespace-nowrap shadow-[-1px_0_0_rgba(229,231,235,1)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length: 5}).map((_, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    {Array.from({length: 10}).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: j === 0 ? '70%' : '50%' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-sm text-gray-400">
                    No upcoming batches in the next 6 months
                  </td>
                </tr>
              ) : (
                batches.map((b, i) => {
                  const key = batchIdentity(b);
                  const startStr        = toDateStr(b.SDate);
                  const annDate  = startStr ? subtractMonths(startStr, 3) : null;
                  const metaDate = startStr ? subtractMonths(startStr, 1) : null;
                  const flyDate  = startStr ? subtractDays(startStr, 42)  : null;
                  const status    = statuses.get(key) ?? statuses.get(b.Batch_code);
                  const locked    = status?.is_locked ?? false;
                  const hasRecord = !!status?.id;
                  const isSaving  = saving.has(key);

                  return (
                    <tr
                      key={`${b.Batch_Id}-${b.Batch_code}-${toDateStr(b.SDate)}-${i}`}
                      className={`border-t border-gray-100 transition-colors ${
                        locked ? 'bg-gray-50/80' : i % 2 === 1 ? 'bg-gray-50/20' : 'hover:bg-gray-50/40'
                      }`}
                    >
                      {/* Training name */}
                      <td className="px-4 py-2.5 text-gray-700 text-sm">
                        {locked && (
                          <svg className="w-3 h-3 text-amber-400 inline mr-1.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2v-9a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm0 2a3 3 0 013 3v3H9V7a3 3 0 013-3z" />
                          </svg>
                        )}
                        {b.Course_Name || '—'}
                      </td>

                      {/* Batch code */}
                      <td className="px-3 py-2.5 font-mono font-semibold text-gray-700 text-xs whitespace-nowrap">
                        {b.Batch_code}
                      </td>

                      {/* Start date */}
                      <td className="px-3 py-2.5 text-center text-xs tabular-nums text-gray-600 whitespace-nowrap font-medium">
                        {fmtDate(startStr)}
                      </td>

                      {/* Announcement */}
                      <TaskCells status={status?.announcement_status ?? 'Pending'} field="announcement_status" batch={b} dueDate={annDate} onUpdate={handleStatusChange} disabled={locked || isSaving} />

                      {/* Meta Ads */}
                      <TaskCells status={status?.meta_ads_status ?? 'Pending'} field="meta_ads_status" batch={b} dueDate={metaDate} onUpdate={handleStatusChange} disabled={locked || isSaving} />

                      {/* Flyer */}
                      <TaskCells status={status?.flyer_status ?? 'Pending'} field="flyer_status" batch={b} dueDate={flyDate} onUpdate={handleStatusChange} disabled={locked || isSaving} />

                      {/* Actions */}
                      <td className="px-3 py-2.5 sticky right-0 z-10 bg-white shadow-[-1px_0_0_rgba(229,231,235,1)]">
                        <div className="flex items-center justify-center gap-0.5">
                          {/* Lock */}
                          <button
                            onClick={() => handleLockToggle(b, true)}
                            disabled={locked || isSaving}
                            title="Lock row"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                            </svg>
                          </button>
                          {/* Unlock */}
                          <button
                            onClick={() => handleLockToggle(b, false)}
                            disabled={!hasRecord || !locked || isSaving}
                            title="Unlock row"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 014-4 4 4 0 014 4M6 11h12a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a2 2 0 012-2z" />
                            </svg>
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(b)}
                            disabled={!hasRecord || isSaving}
                            title="Reset record"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
