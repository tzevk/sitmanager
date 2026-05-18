'use client';

import { useCallback, useState, useEffect } from 'react';

type BMStatus = 'Pending' | 'In Progress' | 'Done';
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

function subtractMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function toDateStr(val: string | null | undefined): string {
  if (!val) return '';
  const s = typeof val === 'string' ? val : new Date(val).toISOString();
  return s.slice(0, 10);
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function isNext6Months(sdate: string | null): boolean {
  if (!sdate) return false;
  const start = new Date(toDateStr(sdate) + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const cap = new Date();
  cap.setMonth(cap.getMonth() + 6);
  cap.setHours(0, 0, 0, 0);
  return start >= now && start <= cap;
}

function statusCls(status: BMStatus) {
  if (status === 'Done')        return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
  if (status === 'In Progress') return 'bg-blue-100 text-blue-700 ring-blue-200';
  return 'bg-amber-100 text-amber-700 ring-amber-200';
}

function StatusSelect({ status, field, batchCode, onUpdate, disabled }: {
  status: BMStatus;
  field: StatusField;
  batchCode: string;
  onUpdate: (batchCode: string, field: StatusField, val: BMStatus) => void;
  disabled: boolean;
}) {
  return (
    <select
      value={status}
      disabled={disabled}
      onChange={e => onUpdate(batchCode, field, e.target.value as BMStatus)}
      className={`text-[10px] font-bold rounded-full px-2 py-0.5 border-0 ring-1 outline-none transition-colors ${statusCls(status)} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <option value="Pending">○ Pending</option>
      <option value="In Progress">◑ In Progress</option>
      <option value="Done">✓ Done</option>
    </select>
  );
}

function ActionBtn({ onClick, disabled, title, className, children }: {
  onClick: () => void;
  disabled: boolean;
  title: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

export default function BatchMarketingWidget() {
  const [batches, setBatches]   = useState<BatchOption[]>([]);
  const [statuses, setStatuses] = useState<Map<string, LocalStatus>>(new Map());
  const [saving, setSaving]     = useState<Set<string>>(new Set());
  const [loading, setLoading]   = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [batchRes, marketingRes] = await Promise.all([
        fetch('/api/inquiry/batches'),
        fetch('/api/cbd-batch-marketing', { cache: 'no-store' }),
      ]);
      const batchData     = batchRes.ok     ? await batchRes.json()     : { batches: [] };
      const marketingData = marketingRes.ok ? await marketingRes.json() : { rows: [] };

      const upcoming: BatchOption[] = (batchData.batches ?? []).filter((b: BatchOption) =>
        isNext6Months(b.SDate)
      );
      upcoming.sort((a, b) => (toDateStr(a.SDate) < toDateStr(b.SDate) ? -1 : 1));
      setBatches(upcoming);

      const statusMap = new Map<string, LocalStatus>();
      for (const r of (marketingData.rows ?? []) as MarketingRecord[]) {
        statusMap.set(r.batch_name, {
          id: r.id,
          flyer_status: r.flyer_status,
          announcement_status: r.announcement_status,
          meta_ads_status: r.meta_ads_status,
          is_locked: r.is_locked === 1,
        });
      }
      setStatuses(statusMap);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* shared upsert helper used by status change + lock toggle */
  const upsert = useCallback(async (
    batchCode: string,
    batch: BatchOption,
    next: Omit<LocalStatus, 'id'>,
    currentId?: number,
  ): Promise<number | undefined> => {
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
      await fetch(`/api/cbd-batch-marketing/${currentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return currentId;
    } else {
      const res = await fetch('/api/cbd-batch-marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) return (await res.json()).row?.id;
    }
  }, []);

  const handleStatusChange = useCallback(async (batchCode: string, field: StatusField, value: BMStatus) => {
    const batch   = batches.find(b => b.Batch_code === batchCode);
    if (!batch) return;
    const current = statuses.get(batchCode);
    if (current?.is_locked) return;

    const next: Omit<LocalStatus, 'id'> = { ...(current ?? DEFAULT_STATUS), [field]: value };
    setStatuses(prev => new Map(prev).set(batchCode, { ...next, id: current?.id }));
    setSaving(prev => new Set([...prev, batchCode]));

    try {
      const newId = await upsert(batchCode, batch, next, current?.id);
      if (newId && !current?.id) {
        setStatuses(prev => {
          const m = new Map(prev);
          const s = m.get(batchCode);
          if (s) m.set(batchCode, { ...s, id: newId });
          return m;
        });
      }
    } catch {
      setStatuses(prev => {
        const m = new Map(prev);
        if (current) m.set(batchCode, current); else m.delete(batchCode);
        return m;
      });
    } finally {
      setSaving(prev => { const s = new Set(prev); s.delete(batchCode); return s; });
    }
  }, [batches, statuses, upsert]);

  const handleLockToggle = useCallback(async (batchCode: string, lock: boolean) => {
    const batch   = batches.find(b => b.Batch_code === batchCode);
    if (!batch) return;
    const current = statuses.get(batchCode);
    if (!current?.id) return;

    const next: Omit<LocalStatus, 'id'> = { ...(current ?? DEFAULT_STATUS), is_locked: lock };
    setStatuses(prev => new Map(prev).set(batchCode, { ...next, id: current.id }));
    setSaving(prev => new Set([...prev, batchCode]));

    try {
      await upsert(batchCode, batch, next, current.id);
    } catch {
      setStatuses(prev => {
        const m = new Map(prev);
        m.set(batchCode, current);
        return m;
      });
    } finally {
      setSaving(prev => { const s = new Set(prev); s.delete(batchCode); return s; });
    }
  }, [batches, statuses, upsert]);

  const handleDelete = useCallback(async (batchCode: string) => {
    const record = statuses.get(batchCode);
    if (!record?.id) return;
    if (!confirm('Delete marketing record for this batch? Statuses will reset to Pending.')) return;

    setSaving(prev => new Set([...prev, batchCode]));
    try {
      await fetch(`/api/cbd-batch-marketing/${record.id}`, { method: 'DELETE' });
      setStatuses(prev => { const m = new Map(prev); m.delete(batchCode); return m; });
    } finally {
      setSaving(prev => { const s = new Set(prev); s.delete(batchCode); return s; });
    }
  }, [statuses]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100" style={{ borderLeft: '3px solid #2A6BB5' }}>
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, #2A6BB5 10%, transparent)' }}>
          <span style={{ color: '#2A6BB5' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </span>
        </span>
        <span className="font-bold text-gray-800 text-sm flex-1">Batch Marketing Tracker</span>
        {!loading && (
          <span className="text-[11px] font-semibold text-gray-400 tabular-nums">
            {batches.length} {batches.length === 1 ? 'batch' : 'batches'} (next 6 months)
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-left">Training Name</th>
              <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-left">Batch</th>
              <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-center">Start Date</th>
              <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-center">Announcement Date</th>
              <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-center">Announcement</th>
              <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-center">Meta Ads Date</th>
              <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-center">Meta Ads</th>
              <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-center">Flyer</th>
              <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-t border-gray-100">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: j <= 1 ? '70%' : '50%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : batches.length === 0 ? (
              <tr><td colSpan={9} className="px-5 py-10 text-center text-sm text-gray-400">No batches found in the next 6 months</td></tr>
            ) : (
              batches.map((b, i) => {
                const startStr         = toDateStr(b.SDate);
                const announcementDate = startStr ? subtractMonths(startStr, 3) : null;
                const metaAdsDate      = startStr ? subtractMonths(startStr, 1) : null;
                const status   = statuses.get(b.Batch_code);
                const locked   = status?.is_locked ?? false;
                const hasRecord = !!status?.id;
                const isSaving  = saving.has(b.Batch_code);

                return (
                  <tr key={b.Batch_Id} className={`border-t border-gray-100 transition-colors ${locked ? 'bg-gray-50/80' : i % 2 === 1 ? 'bg-gray-50/30' : 'hover:bg-gray-50/50'}`}>
                    <td className="px-4 py-3 text-gray-700">{b.Course_Name || '—'}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-gray-800 text-xs">{b.Batch_code}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-gray-600 text-xs">{fmtDate(startStr)}</td>
                    <td className="px-4 py-3 text-center tabular-nums font-medium text-[#2A6BB5] text-xs">{fmtDate(announcementDate)}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusSelect status={status?.announcement_status ?? 'Pending'} field="announcement_status" batchCode={b.Batch_code} onUpdate={handleStatusChange} disabled={locked || isSaving} />
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-gray-500 text-xs">{fmtDate(metaAdsDate)}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusSelect status={status?.meta_ads_status ?? 'Pending'} field="meta_ads_status" batchCode={b.Batch_code} onUpdate={handleStatusChange} disabled={locked || isSaving} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusSelect status={status?.flyer_status ?? 'Pending'} field="flyer_status" batchCode={b.Batch_code} onUpdate={handleStatusChange} disabled={locked || isSaving} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {/* Lock */}
                        <ActionBtn onClick={() => handleLockToggle(b.Batch_code, true)} disabled={!hasRecord || locked || isSaving} title="Lock row" className="text-gray-400 hover:text-amber-600 hover:bg-amber-50">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                          </svg>
                        </ActionBtn>
                        {/* Unlock */}
                        <ActionBtn onClick={() => handleLockToggle(b.Batch_code, false)} disabled={!hasRecord || !locked || isSaving} title="Unlock row" className="text-gray-400 hover:text-emerald-600 hover:bg-emerald-50">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 014-4 4 4 0 014 4M6 11h12a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a2 2 0 012-2z" />
                          </svg>
                        </ActionBtn>
                        {/* Delete */}
                        <ActionBtn onClick={() => handleDelete(b.Batch_code)} disabled={!hasRecord || isSaving} title="Delete record" className="text-gray-400 hover:text-red-600 hover:bg-red-50">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </ActionBtn>
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
  );
}
