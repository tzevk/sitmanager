'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { toBatchNumber } from '@/lib/batch-display';

interface BatchRow {
  Batch_Id: number;
  Course_Name: string | null;
  Batch_code: string | null;
  SDate: string | null;
  EDate: string | null;
  Training_Coordinator: string | null;
}

interface PlannedInterview {
  id: string;
  batchId: number;
  date: string;
  time: string;
  mode: 'Online' | 'Offline';
  interviewer: string;
  remarks: string;
}

const STORAGE_KEY = 'sit-mock-interview-plans-v1';

const toDateKey = (v: string | null | undefined) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const monthEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

const formatDate = (v: string) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString('en-GB');
};

export default function MockInterviewsPage() {
  const router = useRouter();
  const { canView, loading: permLoading } = useResourcePermissions('mock_interview');

  const [monthCursor, setMonthCursor] = useState(() => monthStart(new Date()));
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [plans, setPlans] = useState<PlannedInterview[]>([]);
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date().toISOString()));
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [planTime, setPlanTime] = useState('10:00');
  const [planMode, setPlanMode] = useState<'Online' | 'Offline'>('Offline');
  const [planInterviewer, setPlanInterviewer] = useState('');
  const [planRemarks, setPlanRemarks] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setPlans(parsed as PlannedInterview[]);
      }
    } catch {
      // ignore local parse errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
    } catch {
      // ignore local storage errors
    }
  }, [plans]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const allRows: BatchRow[] = [];
        let page = 1;
        const limit = 200;

        while (true) {
          const res = await fetch(`/api/masters/annual-batch?page=${page}&limit=${limit}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || 'Failed to load annual batch plan');

          const rows = (data?.data || []) as BatchRow[];
          allRows.push(...rows);
          if (rows.length < limit) break;
          page += 1;
          if (page > 20) break;
        }

        const withDates = allRows.filter((r) => toDateKey(r.SDate) && toDateKey(r.EDate));
        if (active) {
          setBatches(withDates);
          if (!selectedBatchId && withDates.length > 0) setSelectedBatchId(String(withDates[0].Batch_Id));
        }
      } catch (e: unknown) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load annual batch plan');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedBatchId]);

  const batchById = useMemo(() => {
    const m = new Map<number, BatchRow>();
    batches.forEach((b) => m.set(b.Batch_Id, b));
    return m;
  }, [batches]);

  const days = useMemo(() => {
    const start = monthStart(monthCursor);
    const end = monthEnd(monthCursor);
    const firstWeekday = start.getDay();
    const total = end.getDate();
    const arr: Array<{ key: string; day: number; inMonth: boolean }> = [];

    for (let i = 0; i < firstWeekday; i += 1) {
      arr.push({ key: `empty-${i}`, day: 0, inMonth: false });
    }

    for (let d = 1; d <= total; d += 1) {
      const key = toDateKey(new Date(start.getFullYear(), start.getMonth(), d).toISOString());
      arr.push({ key, day: d, inMonth: true });
    }

    while (arr.length % 7 !== 0) {
      arr.push({ key: `tail-${arr.length}`, day: 0, inMonth: false });
    }

    return arr;
  }, [monthCursor]);

  const plansByDate = useMemo(() => {
    const m = new Map<string, PlannedInterview[]>();
    plans.forEach((p) => {
      const list = m.get(p.date) || [];
      list.push(p);
      m.set(p.date, list);
    });
    return m;
  }, [plans]);

  const rangeStats = useMemo(() => {
    const m = new Map<string, { start: number; end: number }>();
    days.forEach((d) => {
      if (!d.inMonth) return;
      let startCount = 0;
      let endCount = 0;
      batches.forEach((b) => {
        const s = toDateKey(b.SDate);
        const e = toDateKey(b.EDate);
        if (!s || !e) return;
        if (d.key === s) startCount += 1;
        if (d.key === e) endCount += 1;
      });
      m.set(d.key, { start: startCount, end: endCount });
    });
    return m;
  }, [days, batches]);

  const dayBatches = useMemo(() => {
    const m = new Map<string, Array<{ batch: BatchRow; isStart: boolean; isEnd: boolean }>>();
    days.forEach((d) => {
      if (!d.inMonth) return;
      const list: Array<{ batch: BatchRow; isStart: boolean; isEnd: boolean }> = [];
      batches.forEach((b) => {
        const s = toDateKey(b.SDate);
        const e = toDateKey(b.EDate);
        if (!s || !e) return;
        const isStart = d.key === s;
        const isEnd = d.key === e;
        if (isStart || isEnd) list.push({ batch: b, isStart, isEnd });
      });
      list.sort((a, b) => String(a.batch.Course_Name || '').localeCompare(String(b.batch.Course_Name || '')));
      m.set(d.key, list);
    });
    return m;
  }, [days, batches]);

  const selectedDatePlans = useMemo(
    () => (selectedDate ? (plansByDate.get(selectedDate) || []).sort((a, b) => a.time.localeCompare(b.time)) : []),
    [plansByDate, selectedDate]
  );

  const handleCreatePlan = () => {
    if (!selectedDate) {
      setError('Please select a date from calendar');
      return;
    }
    if (!selectedBatchId) {
      setError('Please select a batch');
      return;
    }
    setError('');

    const next: PlannedInterview = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      batchId: Number(selectedBatchId),
      date: selectedDate,
      time: planTime || '10:00',
      mode: planMode,
      interviewer: planInterviewer.trim(),
      remarks: planRemarks.trim(),
    };
    setPlans((prev) => [...prev, next]);
    setPlanInterviewer('');
    setPlanRemarks('');
  };

  const handleDeletePlan = (id: string) => {
    if (!confirm('Delete this mock interview plan?')) return;
    setPlans((prev) => prev.filter((p) => p.id !== id));
  };

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view mock interviews." />;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">Placement - Mock Interviews Planner</h2>
            <p className="text-xs text-white/70">Calendar planning by batch with annual batch start/end preloaded</p>
          </div>
          <button
            onClick={() => router.push('/dashboard/placement')}
            className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Back To Placement
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <button
              onClick={() => setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="px-2.5 py-1 text-xs font-semibold rounded border border-gray-300 hover:bg-gray-50"
            >
              Prev
            </button>
            <h3 className="text-sm font-bold text-gray-800">
              {monthCursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={() => setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="px-2.5 py-1 text-xs font-semibold rounded border border-gray-300 hover:bg-gray-50"
            >
              Next
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-gray-200 text-[11px] font-bold text-gray-500 bg-gray-50">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="px-2 py-2 text-center">{d}</div>
            ))}
          </div>

          {loading ? (
            <div className="py-12 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {days.map((d) => {
                if (!d.inMonth) return <div key={d.key} className="h-44 border-r border-b border-gray-100 bg-gray-50/40" />;
                const stats = rangeStats.get(d.key) || { start: 0, end: 0 };
                const dayPlans = plansByDate.get(d.key) || [];
                const dayBatchRows = dayBatches.get(d.key) || [];
                const selected = selectedDate === d.key;

                return (
                  <button
                    type="button"
                    key={d.key}
                    onClick={() => setSelectedDate(d.key)}
                    className={`h-44 border-r border-b border-gray-100 p-1.5 text-left transition-colors ${
                      selected ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-300' : (stats.start > 0 || stats.end > 0) ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${selected ? 'text-indigo-700' : 'text-gray-700'}`}>{d.day}</span>
                      {dayPlans.length > 0 && (
                        <span className="text-[10px] font-bold rounded-full bg-[#2E3093] text-white px-1.5 py-0.5">{dayPlans.length}</span>
                      )}
                    </div>
                    <div className="mt-1 space-y-1">
                      {stats.start > 0 && <div className="text-[10px] text-green-700 font-semibold">Start: {stats.start}</div>}
                      {stats.end > 0 && <div className="text-[10px] text-blue-700 font-semibold">End: {stats.end}</div>}
                      {dayBatchRows.length > 0 && (
                        <div className="max-h-20 overflow-y-auto space-y-1 pr-0.5">
                          {dayBatchRows.map((entry) => (
                            <div key={`${d.key}-${entry.batch.Batch_Id}`} className="rounded border border-gray-200 bg-white/80 px-1 py-1">
                              <div className="text-[10px] font-semibold text-gray-800 truncate">{entry.batch.Course_Name || 'Training'}</div>
                              <div className="text-[9px] text-gray-600 truncate">Batch: {toBatchNumber(entry.batch.Batch_code || entry.batch.Batch_Id)}</div>
                              {entry.isStart && <div className="text-[9px] text-green-700">Start: {formatDate(toDateKey(entry.batch.SDate))}</div>}
                              {entry.isEnd && <div className="text-[9px] text-blue-700">End: {formatDate(toDateKey(entry.batch.EDate))}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Plan Mock Interview</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Selected Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Batch</label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                >
                  <option value="">Select Batch</option>
                  {batches.map((b) => (
                    <option key={b.Batch_Id} value={b.Batch_Id}>
                      {(b.Course_Name || 'Training')} - {toBatchNumber(b.Batch_code || b.Batch_Id)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">Time</label>
                  <input
                    type="time"
                    value={planTime}
                    onChange={(e) => setPlanTime(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">Mode</label>
                  <select
                    value={planMode}
                    onChange={(e) => setPlanMode(e.target.value as 'Online' | 'Offline')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                  >
                    <option value="Offline">Offline</option>
                    <option value="Online">Online</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Interviewer</label>
                <input
                  type="text"
                  value={planInterviewer}
                  onChange={(e) => setPlanInterviewer(e.target.value)}
                  placeholder="Trainer / HR Name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={planRemarks}
                  onChange={(e) => setPlanRemarks(e.target.value)}
                  placeholder="Panel, venue, focus area"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                />
              </div>

              <button
                onClick={handleCreatePlan}
                className="w-full px-3 py-2 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-xs font-semibold rounded-lg shadow hover:shadow-md transition-all"
              >
                Add Mock Interview Plan
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-bold text-gray-800 mb-2">Planned On {selectedDate ? formatDate(selectedDate) : '-'}</h3>
            {selectedDatePlans.length === 0 ? (
              <p className="text-xs text-gray-500">No mock interviews planned for this date.</p>
            ) : (
              <div className="space-y-2">
                {selectedDatePlans.map((p) => {
                  const batch = batchById.get(p.batchId);
                  return (
                    <div key={p.id} className="rounded-lg border border-gray-200 p-2.5 bg-gray-50">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-gray-800">{batch?.Course_Name || 'Training'} - {toBatchNumber(batch?.Batch_code || p.batchId)}</div>
                          <div className="text-[11px] text-gray-600 mt-0.5">{p.time} | {p.mode}</div>
                          <div className="text-[11px] text-gray-600">Interviewer: {p.interviewer || '-'}</div>
                          {p.remarks && <div className="text-[11px] text-gray-700 mt-1">{p.remarks}</div>}
                        </div>
                        <button
                          onClick={() => handleDeletePlan(p.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-bold text-gray-800 mb-2">Annual Batch Plan Windows</h3>
            <div className="max-h-52 overflow-auto space-y-1.5 pr-1">
              {batches.length === 0 ? (
                <p className="text-xs text-gray-500">No annual batch rows with start and end dates found.</p>
              ) : (
                batches.slice(0, 80).map((b) => (
                  <div key={b.Batch_Id} className="text-[11px] text-gray-700 rounded border border-gray-200 bg-gray-50 px-2 py-1.5">
                    <span className="font-semibold">{b.Course_Name || 'Training'} - {toBatchNumber(b.Batch_code || b.Batch_Id)}</span>
                    <div className="text-gray-600">{formatDate(toDateKey(b.SDate))} to {formatDate(toDateKey(b.EDate))}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
