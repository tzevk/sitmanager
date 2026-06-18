'use client';

import { useEffect, useState } from 'react';
import { TableSkeleton } from './Skeletons';
import { toBatchNumber } from '@/lib/batch-display';

interface PlacementTodoItem {
  id: string;
  taskName: string;
  dueDate: string;
  status: 'Pending' | 'In Progress' | 'Done';
  createdAt: string;
}

interface PlacementJobOpeningItem {
  id?: number;
  company_name?: string;
  role?: string;
  no_of_positions?: number;
  deadline?: string | null;
  status?: string;
}

interface PlacementCompanyVisitItem {
  id?: number;
  visit_date?: string;
  company_name?: string;
  person_to_meet?: string;
  place?: string;
}

type PlacementData = {
  placementDepartment?: {
    placementSummary?: Array<{ metric?: string; value?: number }>;
    placementSummaryDetails?: Array<{
      batch_id?: number;
      course_name?: string;
      batch_code?: string;
      convocation_date?: string;
      passed_students?: number;
      placed_students?: number;
      placement_pct?: number;
      interviews_count?: number;
    }>;
    upcomingInterviews?: Array<{ interview_date?: string; company_name?: string; training_name?: string; batch_code?: string }>;
    completedInterviews?: Array<{ interview_date?: string; company_name?: string; training_name?: string; batch_code?: string; students_interested?: number; students_attended?: number; students_placed?: number }>;
    jobOpeningTracker?: PlacementJobOpeningItem[];
    companyVisitsPlanned?: PlacementCompanyVisitItem[];
    campusInterviewsPlanned?: Array<{ id?: number; interview_code?: string; interview_date?: string; company_name?: string; role?: string; interview_type?: string }>;
    upcomingMockInterviews?: Array<{ interview_date?: string; company_name?: string; training_name?: string; batch_code?: string }>;
    completedMockInterviews?: Array<{ interview_date?: string; company_name?: string; training_name?: string; batch_code?: string }>;
  };
  placementReport?: {
    rows?: Array<{
      passed: number;
      cvReceived: number;
      interviewed: number;
      placed: number;
      batchCode?: string;
      courseName?: string;
      convocationDate?: string;
      passedStudent?: number;
      totalCvReceived?: number;
      selfPlacement?: number;
      resumesNotReceived?: number;
      others?: number;
      totalInterviewed?: number;
      totalPlaced?: number;
      avgSalary?: number;
      salaryCount?: number;
      placedPct?: number;
    }>;
  };
};

function formatSalary(value?: number): string {
  const amount = Number(value || 0);
  if (!amount) return '—';
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(amount >= 1000000 ? 1 : 2)}L`;
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function convocationTime(value?: string): number {
  if (!value) return 0;
  const text = String(value).trim();
  const dmy = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T00:00:00`).getTime();
  const time = new Date(text).getTime();
  return Number.isFinite(time) ? time : 0;
}

function formatConvocationDate(value?: string): string {
  const time = convocationTime(value);
  if (!time) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(time));
}

function dateInputTime(value: string): number {
  if (!value) return 0;
  const time = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(time) ? time : 0;
}

function WidgetCard({
  title,
  count,
  headerRight,
  className = '',
  contentClassName = '',
  children,
}: {
  title: string;
  count?: number;
  headerRight?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`bg-white rounded-3xl border border-[#2E3093]/10 overflow-hidden ${className}`}>
      <div className="px-5 py-4 bg-gradient-to-r from-[#2E3093] via-[#2E3093] to-[#2A6BB5] text-white font-bold flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm tracking-wide">{title}</h3>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {headerRight}
          {typeof count === 'number' && (
            <span className="text-[11px] bg-white/20 px-2 py-1 rounded-md font-semibold whitespace-nowrap">
              {count.toLocaleString()}
            </span>
          )}
        </div>
      </div>
      <div className={`p-0 overflow-auto max-h-[360px] ${contentClassName}`}>{children}</div>
    </div>
  );
}

function EmptyState({ text = 'No data available' }: { text?: string }) {
  return <div className="p-6 text-sm text-center text-gray-500">{text}</div>;
}

function Table({
  columns,
  rows,
}: {
  columns: string[];
  rows: React.ReactNode;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
        <tr>
          {columns.map((col) => (
            <th key={col} className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-gray-500 font-semibold whitespace-nowrap">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">{rows}</tbody>
    </table>
  );
}

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('open')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s.includes('completed')) return 'bg-sky-50 text-sky-700 border-sky-200';
  if (s.includes('closed')) return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

export default function PlacementDepartmentDashboard({ data, loading }: { data: PlacementData; loading: boolean }) {
  const placementData = data?.placementDepartment ?? {};
  const [todos, setTodos] = useState<PlacementTodoItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('sit-placement-dashboard-todos');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [newTaskName, setNewTaskName] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [convocationFromDate, setConvocationFromDate] = useState('');
  const [convocationToDate, setConvocationToDate] = useState('');
  const [manualJobOpenings, setManualJobOpenings] = useState<PlacementJobOpeningItem[]>([]);
  const [openingCompanyName, setOpeningCompanyName] = useState('');
  const [openingRole, setOpeningRole] = useState('');
  const [openingPositions, setOpeningPositions] = useState('1');
  const [openingDeadline, setOpeningDeadline] = useState('');
  const [openingStatus, setOpeningStatus] = useState('Open');
  const [openingSaving, setOpeningSaving] = useState(false);
  const [openingError, setOpeningError] = useState('');
  const [manualCompanyVisits, setManualCompanyVisits] = useState<PlacementCompanyVisitItem[]>([]);
  const [visitDate, setVisitDate] = useState('');
  const [visitCompanyName, setVisitCompanyName] = useState('');
  const [visitPersonToMeet, setVisitPersonToMeet] = useState('');
  const [visitPlace, setVisitPlace] = useState('');
  const [visitSaving, setVisitSaving] = useState(false);
  const [visitError, setVisitError] = useState('');

  useEffect(() => {
    setManualJobOpenings(placementData.jobOpeningTracker ?? []);
  }, [placementData.jobOpeningTracker]);

  useEffect(() => {
    setManualCompanyVisits(placementData.companyVisitsPlanned ?? []);
  }, [placementData.companyVisitsPlanned]);

  const saveTodos = (items: PlacementTodoItem[]) => {
    setTodos(items);
    try {
      localStorage.setItem('sit-placement-dashboard-todos', JSON.stringify(items));
    } catch {
      // ignore storage errors
    }
  };

  const addTodo = () => {
    if (!newTaskName.trim()) return;
    saveTodos([
      {
        id: Date.now().toString(),
        taskName: newTaskName.trim(),
        dueDate: newDueDate,
        status: 'Pending',
        createdAt: new Date().toISOString(),
      },
      ...todos,
    ]);
    setNewTaskName('');
    setNewDueDate('');
  };

  const updateTodo = (id: string, patch: Partial<PlacementTodoItem>) => {
    saveTodos(todos.map((todo) => (todo.id === id ? { ...todo, ...patch } : todo)));
  };

  const removeTodo = (id: string) => {
    saveTodos(todos.filter((todo) => todo.id !== id));
  };

  const addJobOpening = async () => {
    if (!openingCompanyName.trim() || !openingRole.trim()) return;
    setOpeningSaving(true);
    setOpeningError('');
    try {
      const response = await fetch('/api/dashboard/placement-deputation-openings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: openingCompanyName,
          role: openingRole,
          noOfPositions: openingPositions,
          deadline: openingDeadline || null,
          status: openingStatus,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || 'Failed to add opening');
      setManualJobOpenings((items) => [result.row, ...items]);
      setOpeningCompanyName('');
      setOpeningRole('');
      setOpeningPositions('1');
      setOpeningDeadline('');
      setOpeningStatus('Open');
    } catch (error: unknown) {
      setOpeningError(error instanceof Error ? error.message : 'Failed to add opening');
    } finally {
      setOpeningSaving(false);
    }
  };

  const deleteJobOpening = async (id?: number) => {
    if (!id) return;
    setOpeningError('');
    setManualJobOpenings((items) => items.filter((item) => item.id !== id));
    try {
      const response = await fetch(`/api/dashboard/placement-deputation-openings?id=${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result?.error || 'Failed to delete opening');
      }
    } catch (error: unknown) {
      setOpeningError(error instanceof Error ? error.message : 'Failed to delete opening');
    }
  };

  const addCompanyVisit = async () => {
    if (!visitDate || !visitCompanyName.trim() || !visitPersonToMeet.trim() || !visitPlace.trim()) return;
    setVisitSaving(true);
    setVisitError('');
    try {
      const response = await fetch('/api/dashboard/placement-company-visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitDate,
          companyName: visitCompanyName,
          personToMeet: visitPersonToMeet,
          place: visitPlace,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || 'Failed to add company visit');
      setManualCompanyVisits((items) => [result.row, ...items]);
      setVisitDate('');
      setVisitCompanyName('');
      setVisitPersonToMeet('');
      setVisitPlace('');
    } catch (error: unknown) {
      setVisitError(error instanceof Error ? error.message : 'Failed to add company visit');
    } finally {
      setVisitSaving(false);
    }
  };

  const deleteCompanyVisit = async (id?: number) => {
    if (!id) return;
    setVisitError('');
    setManualCompanyVisits((items) => items.filter((item) => item.id !== id));
    try {
      const response = await fetch(`/api/dashboard/placement-company-visits?id=${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result?.error || 'Failed to delete company visit');
      }
    } catch (error: unknown) {
      setVisitError(error instanceof Error ? error.message : 'Failed to delete company visit');
    }
  };

  const placementRows = [...(data?.placementReport?.rows ?? [])].sort((a, b) => convocationTime(b.convocationDate) - convocationTime(a.convocationDate));
  const fromTime = dateInputTime(convocationFromDate);
  const toTime = dateInputTime(convocationToDate);
  const filteredPlacementRows = placementRows.filter((row) => {
    const time = convocationTime(row.convocationDate);
    if (!time) return !fromTime && !toTime;
    if (fromTime && time < fromTime) return false;
    if (toTime && time > toTime) return false;
    return true;
  });
  const recentConvocationDate = filteredPlacementRows.find((row) => convocationTime(row.convocationDate) > 0)?.convocationDate;

  if (loading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <TableSkeleton key={i} rows={5} cols={4} />
        ))}
      </div>
    );
  }

  const upcomingInterviews = placementData.upcomingInterviews ?? [];
  const completedInterviews = placementData.completedInterviews ?? [];
  const jobOpeningTracker = manualJobOpenings;
  const companyVisitsPlanned = manualCompanyVisits;
  const campusInterviewsPlanned = placementData.campusInterviewsPlanned ?? [];
  const upcomingMockInterviews = placementData.upcomingMockInterviews ?? [];
  const completedMockInterviews = placementData.completedMockInterviews ?? [];
  const pendingTodos = todos.filter((todo) => todo.status !== 'Done').length;

  return (
    <div className="space-y-6 pb-8">
      <WidgetCard
        title="Placement Status Report"
        count={filteredPlacementRows.length}
        headerRight={(
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <label className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-white/80">From</span>
              <input
                type="date"
                value={convocationFromDate}
                onChange={(event) => setConvocationFromDate(event.target.value)}
                className="h-8 rounded-lg border border-white/25 bg-white/95 px-2 text-xs font-bold text-slate-800 shadow-sm outline-none focus:border-white focus:ring-2 focus:ring-white/30"
                aria-label="Filter convocation date from"
              />
            </label>
            <label className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-white/80">To</span>
              <input
                type="date"
                value={convocationToDate}
                onChange={(event) => setConvocationToDate(event.target.value)}
                className="h-8 rounded-lg border border-white/25 bg-white/95 px-2 text-xs font-bold text-slate-800 shadow-sm outline-none focus:border-white focus:ring-2 focus:ring-white/30"
                aria-label="Filter convocation date to"
              />
            </label>
            {(convocationFromDate || convocationToDate) && (
              <button
                type="button"
                onClick={() => {
                  setConvocationFromDate('');
                  setConvocationToDate('');
                }}
                className="h-8 rounded-lg border border-white/25 bg-white/10 px-2.5 text-[11px] font-bold text-white transition hover:bg-white/20"
              >
                Clear
              </button>
            )}
          </div>
        )}
      >
        <div className="overflow-auto max-h-[560px]">
          {placementRows.length === 0 ? (
            <EmptyState text="No placement status data available" />
          ) : filteredPlacementRows.length === 0 ? (
            <EmptyState text="No placement status data found for selected convocation dates" />
          ) : (() => {
            const rows = filteredPlacementRows;
            const totals = rows.reduce<{
              passed: number;
              cvReceived: number;
              selfPlacement: number;
              resumesNotReceived: number;
              others: number;
              interviewed: number;
              placed: number;
              salaryTotal: number;
              salaryCount: number;
            }>(
              (acc, row) => ({
                passed: acc.passed + (Number(row.passedStudent || 0)),
                cvReceived: acc.cvReceived + (Number(row.totalCvReceived || 0)),
                selfPlacement: acc.selfPlacement + (Number(row.selfPlacement || 0)),
                resumesNotReceived: acc.resumesNotReceived + (Number(row.resumesNotReceived || 0)),
                others: acc.others + (Number(row.others || 0)),
                interviewed: acc.interviewed + (Number(row.totalInterviewed || 0)),
                placed: acc.placed + (Number(row.totalPlaced || 0)),
                salaryTotal: acc.salaryTotal + ((Number(row.avgSalary || 0)) * (Number(row.salaryCount || 0))),
                salaryCount: acc.salaryCount + (Number(row.salaryCount || 0)),
              }),
              { passed: 0, cvReceived: 0, selfPlacement: 0, resumesNotReceived: 0, others: 0, interviewed: 0, placed: 0, salaryTotal: 0, salaryCount: 0 }
            );
            const totalPct = totals.passed > 0 ? Math.round((totals.placed / totals.passed) * 1000) / 10 : 0;
            const totalAvgSalary = totals.salaryCount > 0 ? Math.round(totals.salaryTotal / totals.salaryCount) : 0;

            return (
              <>
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <div className="grid min-w-[1080px] grid-cols-[minmax(180px,1.4fr)_repeat(10,minmax(86px,1fr))] items-center gap-0 overflow-hidden rounded-xl border border-slate-200 bg-white text-xs shadow-sm">
                    <div className="bg-slate-100 px-4 py-3 font-black uppercase tracking-wide text-slate-600">
                      Total Summary
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Recent Date</p>
                      <p className="font-black text-[#2E3093]">{formatConvocationDate(recentConvocationDate)}</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Passed</p>
                      <p className="font-black text-slate-900">{totals.passed.toLocaleString()}</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-[10px] font-bold uppercase text-slate-400">CV Received</p>
                      <p className="font-black text-[#2A6BB5]">{totals.cvReceived.toLocaleString()}</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Self Placement</p>
                      <p className="font-black text-[#2E3093]">{totals.selfPlacement.toLocaleString()}</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-[10px] font-bold uppercase text-slate-400">No Resume</p>
                      <p className="font-black text-[#2E3093]">{totals.resumesNotReceived.toLocaleString()}</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Others</p>
                      <p className="font-black text-slate-600">{totals.others.toLocaleString()}</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Interviewed</p>
                      <p className="font-black text-[#2E3093]">{totals.interviewed.toLocaleString()}</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Placed</p>
                      <p className="font-black text-[#2A6BB5]">{totals.placed.toLocaleString()}</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Avg Salary</p>
                      <p className="font-black text-slate-700">{formatSalary(totalAvgSalary)}</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Placed %</p>
                      <p className="font-black text-[#2E3093]">{totalPct}%</p>
                    </div>
                  </div>
                </div>

                <table className="w-full min-w-[1120px] text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-gradient-to-r from-slate-50/95 to-white/95 backdrop-blur-xl shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
                  <tr className="text-[11px] font-bold uppercase tracking-widest text-slate-600">
                    <th className="py-3 px-5 text-left border-b border-slate-200/50" rowSpan={2}>Training Program Name</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap border-b border-slate-200/50" rowSpan={2}>Batch No</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap border-b border-slate-200/50" rowSpan={2}>Convocation Date</th>
                    <th className="py-3 px-4 text-center border-b border-r border-slate-200/60" rowSpan={2}>Passed Student</th>
                    <th className="py-2 px-4 text-center text-[#2E3093] border-b border-slate-200/50" colSpan={4}>Candidate Status</th>
                    <th className="py-3 px-4 text-center border-b border-l border-slate-200/60" rowSpan={2}>Total Interviewed</th>
                    <th className="py-3 px-4 text-center border-b border-slate-200/50" rowSpan={2}>Total Placed</th>
                    <th className="py-3 px-4 text-center border-b border-slate-200/50 whitespace-nowrap" rowSpan={2}>Avg Salary</th>
                    <th className="py-3 px-5 text-center border-b border-slate-200/50" rowSpan={2}>Placed(%)</th>
                  </tr>
                  <tr className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-white/60">
                    <th className="py-2.5 px-4 text-center border-l border-b border-slate-200/50">Total CV Received</th>
                    <th className="py-2.5 px-4 text-center border-b border-slate-200/50">Self Placement</th>
                    <th className="py-2.5 px-4 text-center whitespace-nowrap border-b border-slate-200/50">Resumes not received</th>
                    <th className="py-2.5 px-4 text-center border-b border-slate-200/50">Others</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, index) => {
                    const placedPct = Number(row.placedPct || 0);
                    const pctColor = placedPct >= 70
                      ? 'text-[#2E3093] bg-[#2E3093]/10 ring-[#2E3093]/20'
                      : placedPct >= 40
                        ? 'text-[#2A6BB5] bg-[#2A6BB5]/10 ring-[#2A6BB5]/20'
                        : 'text-[#2E3093] bg-[#2E3093]/8 ring-[#2E3093]/15';

                    return (
                      <tr key={`${row.batchCode || 'batch'}-${index}`} className="group hover:bg-gradient-to-r hover:from-[#2A6BB5]/5 hover:to-white transition-all duration-300">
                        <td className="py-3.5 px-5 font-bold text-slate-800 max-w-[240px] relative">
                          <span className="absolute inset-y-0 left-0 w-1 bg-[#2E3093] opacity-0 group-hover:opacity-100 transition-opacity"></span>
                          <span className="truncate block group-hover:text-[#2A6BB5] transition-colors drop-shadow-sm pl-1">{row.courseName || 'N/A'}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center"><span className="font-mono bg-slate-50 border border-slate-200 text-slate-600 shadow-sm rounded-lg px-2.5 py-1 text-[11px] font-semibold">{toBatchNumber(row.batchCode)}</span></td>
                        <td className="py-3.5 px-4 text-center text-slate-500 whitespace-nowrap text-xs font-medium">{formatConvocationDate(row.convocationDate)}</td>
                        <td className="py-3.5 px-4 text-center font-black text-slate-800 border-r border-slate-100 group-hover:border-transparent drop-shadow-sm">{row.passedStudent ?? 0}</td>
                        <td className="py-3.5 px-4 text-center text-[#2A6BB5] font-extrabold">{row.totalCvReceived ?? 0}</td>
                        <td className="py-3.5 px-4 text-center text-[#2E3093] font-extrabold">{row.selfPlacement ?? 0}</td>
                        <td className="py-3.5 px-4 text-center text-[#2E3093] font-extrabold">{row.resumesNotReceived ?? 0}</td>
                        <td className="py-3.5 px-4 text-center text-slate-400 font-semibold">{row.others ?? 0}</td>
                        <td className="py-3.5 px-4 text-center text-[#2E3093] font-black border-l border-slate-100 group-hover:border-transparent drop-shadow-sm">{row.totalInterviewed ?? 0}</td>
                        <td className="py-3.5 px-4 text-center font-black text-[#2A6BB5] drop-shadow-sm">{row.totalPlaced ?? 0}</td>
                        <td className="py-3.5 px-4 text-center font-mono text-xs font-bold text-slate-600">{formatSalary(row.avgSalary)}</td>
                        <td className="py-3.5 px-5 text-center"><span className={`inline-flex items-center justify-center min-w-[48px] px-2.5 py-1.5 rounded-xl text-[12px] font-black shadow-sm ring-1 ring-inset ${pctColor}`}>{placedPct}%</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </>
            );
          })()}
        </div>
      </WidgetCard>

      <div className="grid grid-cols-1 xl:grid-cols-[500px_minmax(0,1fr)] gap-5 items-start">
        <WidgetCard
          title="To Do List"
          count={pendingTodos}
          className="xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)] xl:self-start"
          contentClassName="max-h-none h-[calc(100%-56px)]"
        >
          <div className="p-5 space-y-4 h-[calc(100%-56px)] flex flex-col">
            <div className="rounded-2xl border border-[#2E3093]/10 bg-white p-4">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#2E3093] font-bold">Task Manager</p>
                  <p className="text-xs text-slate-500 mt-1">Capture placement follow-ups quickly and keep them visible.</p>
                </div>
                <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-[#2E3093]/8 text-[#2E3093] border border-[#2E3093]/12">
                  {pendingTodos} open
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Task Name</label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-[#2A6BB5] focus:ring-4 focus:ring-[#2A6BB5]/10"
                    placeholder="Add a placement task..."
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTodo()}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Due Date</label>
                    <input
                      type="date"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-[#2A6BB5] focus:ring-4 focus:ring-[#2A6BB5]/10"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(46,48,147,0.22)] transition hover:shadow-[0_14px_26px_rgba(46,48,147,0.28)] hover:-translate-y-0.5 active:translate-y-0"
                      onClick={addTodo}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Add Task
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-auto flex-1 pr-1">
              <div className="space-y-3">
                {todos.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 py-12 text-center text-slate-400">
                    No tasks available
                  </div>
                ) : todos.map((todo) => (
                  <div key={todo.id} className="group rounded-2xl border border-[#2E3093]/10 bg-white p-4 transition hover:-translate-y-0.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 leading-6 break-words">{todo.taskName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Due {todo.dueDate ? new Date(todo.dueDate).toLocaleDateString('en-IN') : '—'}
                        </p>
                      </div>
                      <button className="text-rose-500 opacity-0 transition group-hover:opacity-100 hover:text-rose-600" onClick={() => removeTodo(todo.id)} aria-label="Delete task">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-6 0h6m-8 0l1 14h6l1-14" />
                        </svg>
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-500 border border-slate-200">
                        <span className={`h-2 w-2 rounded-full ${todo.status === 'Done' ? 'bg-emerald-500' : todo.status === 'In Progress' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                        {todo.status}
                      </div>
                      <select
                        value={todo.status}
                        onChange={(e) => updateTodo(todo.id, { status: e.target.value as PlacementTodoItem['status'] })}
                        className="min-w-[138px] rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm outline-none transition focus:border-[#2A6BB5] focus:ring-4 focus:ring-[#2A6BB5]/10"
                      >
                        <option>Pending</option>
                        <option>In Progress</option>
                        <option>Done</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </WidgetCard>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <WidgetCard title="Upcoming Interviews" count={upcomingInterviews.length} contentClassName="max-h-none h-full">
            {upcomingInterviews.length === 0 ? (
              <EmptyState />
            ) : (
              <Table
                columns={['Date', 'Company', 'Training Name', 'Batch']}
                rows={upcomingInterviews.map((r, idx) => (
                  <tr key={`${r.company_name}-${r.batch_code}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{r.interview_date || '-'}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{r.company_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{r.training_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{toBatchNumber(r.batch_code)}</td>
                  </tr>
                ))}
              />
            )}
          </WidgetCard>

          <WidgetCard title="Completed Interviews" count={completedInterviews.length} contentClassName="max-h-none h-full">
            {completedInterviews.length === 0 ? (
              <EmptyState />
            ) : (
              <Table
                columns={['Batch No.', 'Training Program Name', 'Company Name', 'Date', 'Students Interested', 'Students Attended', 'Students Placed']}
                rows={completedInterviews.map((r, idx) => (
                  <tr key={`${r.company_name}-${r.batch_code}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs font-semibold text-gray-700">{toBatchNumber(r.batch_code)}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{r.training_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{r.company_name || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{r.interview_date || '-'}</td>
                    <td className="px-4 py-3 text-center font-semibold text-[#2E3093]">{Number(r.students_interested || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center font-semibold text-[#2A6BB5]">{Number(r.students_attended || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center font-semibold text-emerald-700">{Number(r.students_placed || 0).toLocaleString()}</td>
                  </tr>
                ))}
              />
            )}
          </WidgetCard>

          <WidgetCard title="Job Opening Tracker (Deputation)" count={jobOpeningTracker.length} contentClassName="max-h-none h-full">
            <div className="border-b border-slate-200 bg-slate-50/80 p-3">
              <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_96px_140px_112px_80px] gap-2">
                <input
                  value={openingCompanyName}
                  onChange={(event) => setOpeningCompanyName(event.target.value)}
                  placeholder="Company name"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#2A6BB5] focus:ring-2 focus:ring-[#2A6BB5]/10"
                />
                <input
                  value={openingRole}
                  onChange={(event) => setOpeningRole(event.target.value)}
                  placeholder="Role"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#2A6BB5] focus:ring-2 focus:ring-[#2A6BB5]/10"
                />
                <input
                  type="number"
                  min={1}
                  value={openingPositions}
                  onChange={(event) => setOpeningPositions(event.target.value)}
                  aria-label="No. of positions"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#2A6BB5] focus:ring-2 focus:ring-[#2A6BB5]/10"
                />
                <input
                  type="date"
                  value={openingDeadline}
                  onChange={(event) => setOpeningDeadline(event.target.value)}
                  aria-label="Deadline"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#2A6BB5] focus:ring-2 focus:ring-[#2A6BB5]/10"
                />
                <select
                  value={openingStatus}
                  onChange={(event) => setOpeningStatus(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-[#2A6BB5] focus:ring-2 focus:ring-[#2A6BB5]/10"
                >
                  <option>Open</option>
                  <option>On Hold</option>
                  <option>Closed</option>
                </select>
                <button
                  type="button"
                  onClick={addJobOpening}
                  disabled={openingSaving || !openingCompanyName.trim() || !openingRole.trim()}
                  className="rounded-lg bg-[#2E3093] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#252780] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {openingSaving ? 'Saving' : 'Add'}
                </button>
              </div>
              {openingError && <p className="mt-2 text-xs font-semibold text-rose-600">{openingError}</p>}
            </div>
            {jobOpeningTracker.length === 0 ? (
              <EmptyState />
            ) : (
              <Table
                columns={['Company Name', 'Role', 'No. of Positions', 'Deadline', 'Status']}
                rows={jobOpeningTracker.map((r, idx) => (
                  <tr key={`${r.id || r.company_name}-${r.role}-${idx}`} className="group hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{r.company_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{r.role || '-'}</td>
                    <td className="px-4 py-3 text-center font-semibold text-[#2E3093]">{Number(r.no_of_positions || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{r.deadline || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusTone(r.status || '-')}`}>
                          {r.status || '-'}
                        </span>
                        {r.id && (
                          <button
                            type="button"
                            onClick={() => deleteJobOpening(r.id)}
                            className="text-[11px] font-bold text-rose-500 opacity-0 transition hover:text-rose-700 group-hover:opacity-100"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              />
            )}
          </WidgetCard>

          <WidgetCard title="Company Visits Planned" count={companyVisitsPlanned.length} contentClassName="max-h-none h-full">
            <div className="border-b border-slate-200 bg-slate-50/80 p-3">
              <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_1fr_1fr_80px] gap-2">
                <input
                  type="date"
                  value={visitDate}
                  onChange={(event) => setVisitDate(event.target.value)}
                  aria-label="Visit date"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#2A6BB5] focus:ring-2 focus:ring-[#2A6BB5]/10"
                />
                <input
                  value={visitCompanyName}
                  onChange={(event) => setVisitCompanyName(event.target.value)}
                  placeholder="Company name"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#2A6BB5] focus:ring-2 focus:ring-[#2A6BB5]/10"
                />
                <input
                  value={visitPersonToMeet}
                  onChange={(event) => setVisitPersonToMeet(event.target.value)}
                  placeholder="Person to meet"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#2A6BB5] focus:ring-2 focus:ring-[#2A6BB5]/10"
                />
                <input
                  value={visitPlace}
                  onChange={(event) => setVisitPlace(event.target.value)}
                  placeholder="Place"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#2A6BB5] focus:ring-2 focus:ring-[#2A6BB5]/10"
                />
                <button
                  type="button"
                  onClick={addCompanyVisit}
                  disabled={visitSaving || !visitDate || !visitCompanyName.trim() || !visitPersonToMeet.trim() || !visitPlace.trim()}
                  className="rounded-lg bg-[#2E3093] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#252780] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {visitSaving ? 'Saving' : 'Add'}
                </button>
              </div>
              {visitError && <p className="mt-2 text-xs font-semibold text-rose-600">{visitError}</p>}
            </div>
            {companyVisitsPlanned.length === 0 ? (
              <EmptyState />
            ) : (
              <Table
                columns={['Date', 'Company Name', 'Person to meet', 'Place']}
                rows={companyVisitsPlanned.map((r, idx) => (
                  <tr key={`${r.id || r.visit_date}-${r.company_name}-${idx}`} className="group hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{r.visit_date || '-'}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{r.company_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{r.person_to_meet || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">
                      <div className="flex items-center justify-between gap-2">
                        <span>{r.place || '-'}</span>
                        {r.id && (
                          <button
                            type="button"
                            onClick={() => deleteCompanyVisit(r.id)}
                            className="text-[11px] font-bold text-rose-500 opacity-0 transition hover:text-rose-700 group-hover:opacity-100"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              />
            )}
          </WidgetCard>

          <WidgetCard title="Campus Interviews Planned" count={campusInterviewsPlanned.length} contentClassName="max-h-none h-full">
            {campusInterviewsPlanned.length === 0 ? (
              <EmptyState />
            ) : (
              <Table
                columns={['Code', 'Date', 'Company Name', 'Role', 'On Campus / Company']}
                rows={campusInterviewsPlanned.map((r, idx) => (
                  <tr key={r.interview_code || `interview-${r.id || idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-black text-[#2E3093] whitespace-nowrap">{r.interview_code || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{r.interview_date || '-'}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{r.company_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{r.role || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{r.interview_type || 'On Campus'}</td>
                  </tr>
                ))}
              />
            )}
          </WidgetCard>

          <WidgetCard title="Upcoming Mock Interviews" count={upcomingMockInterviews.length} contentClassName="max-h-none h-full">
            {upcomingMockInterviews.length === 0 ? (
              <EmptyState />
            ) : (
              <Table
                columns={['Date', 'Company', 'Training Name', 'Batch']}
                rows={upcomingMockInterviews.map((r, idx) => (
                  <tr key={`${r.company_name}-${r.batch_code}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{r.interview_date || '-'}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{r.company_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{r.training_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{toBatchNumber(r.batch_code)}</td>
                  </tr>
                ))}
              />
            )}
          </WidgetCard>

          <WidgetCard title="Completed Mock Interviews" count={completedMockInterviews.length} contentClassName="max-h-none h-full">
            {completedMockInterviews.length === 0 ? (
              <EmptyState />
            ) : (
              <Table
                columns={['Date', 'Company', 'Training Name', 'Batch']}
                rows={completedMockInterviews.map((r, idx) => (
                  <tr key={`${r.company_name}-${r.batch_code}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{r.interview_date || '-'}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{r.company_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{r.training_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{toBatchNumber(r.batch_code)}</td>
                  </tr>
                ))}
              />
            )}
          </WidgetCard>
        </div>
      </div>
    </div>
  );
}
