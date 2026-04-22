'use client';

import { useState } from 'react';
import { TableSkeleton } from './Skeletons';
import { toBatchNumber } from '@/lib/batch-display';

interface PlacementTodoItem {
  id: string;
  taskName: string;
  dueDate: string;
  status: 'Pending' | 'In Progress' | 'Done';
  createdAt: string;
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
    completedInterviews?: Array<{ interview_date?: string; company_name?: string; training_name?: string; batch_code?: string }>;
    jobOpeningTracker?: Array<{ company_name?: string; designation?: string; location?: string; application_deadline?: string; status?: string; total_applications?: number }>;
    companyVisitsPlanned?: Array<{ visit_date?: string; region?: string; location?: string; training_name?: string; batch_code?: string }>;
    campusInterviewsPlanned?: Array<{ company_name?: string; profile?: string; training_name?: string; batch_code?: string; posted_date?: string }>;
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
      placedPct?: number;
    }>;
  };
};

function WidgetCard({
  title,
  count,
  className = '',
  contentClassName = '',
  children,
}: {
  title: string;
  count?: number;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`bg-white/95 rounded-3xl border border-slate-200/70 shadow-[0_10px_30px_rgba(15,23,42,0.05)] overflow-hidden backdrop-blur-sm ${className}`}>
      <div className="px-5 py-4 bg-gradient-to-r from-[#2E3093] via-[#2E3093] to-[#2A6BB5] text-white font-bold flex items-center justify-between gap-3">
        <h3 className="text-sm tracking-wide">{title}</h3>
        <div>
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

  const placementRows = data?.placementReport?.rows ?? [];

  if (loading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <TableSkeleton key={i} rows={5} cols={4} />
        ))}
      </div>
    );
  }

  const summaryRows = placementData.placementSummary ?? [];
  const summaryDetailRows = placementData.placementSummaryDetails ?? [];
  const upcomingInterviews = placementData.upcomingInterviews ?? [];
  const completedInterviews = placementData.completedInterviews ?? [];
  const jobOpeningTracker = placementData.jobOpeningTracker ?? [];
  const companyVisitsPlanned = placementData.companyVisitsPlanned ?? [];
  const campusInterviewsPlanned = placementData.campusInterviewsPlanned ?? [];
  const upcomingMockInterviews = placementData.upcomingMockInterviews ?? [];
  const completedMockInterviews = placementData.completedMockInterviews ?? [];
  const pendingTodos = todos.filter((todo) => todo.status !== 'Done').length;
  const summaryMap = Object.fromEntries(
    summaryRows.map((row) => [String(row.metric || '').trim(), Number(row.value || 0)])
  );

  const summaryCards = [
    {
      label: 'Total Passed Students',
      value: summaryMap['Total Passed Students'] || 0,
      tone: 'bg-[#2E3093]/10 text-[#2E3093] border-[#2E3093]/20',
    },
    {
      label: 'Total Placed Students',
      value: summaryMap['Total Placed Students'] || 0,
      tone: 'bg-[#2A6BB5]/10 text-[#2A6BB5] border-[#2A6BB5]/20',
    },
    {
      label: 'Open Job Openings',
      value: summaryMap['Open Job Openings'] || 0,
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      label: 'Upcoming Interviews',
      value: summaryMap['Upcoming Interviews'] || 0,
      tone: 'bg-amber-50 text-amber-700 border-amber-200',
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      <WidgetCard title="Placement Status Report" count={placementRows.length}>
        <div className="overflow-auto max-h-[520px]">
          {placementRows.length === 0 ? (
            <EmptyState text="No placement status data available" />
          ) : (() => {
            const rows = placementRows.slice(0, 10);
            const totals = rows.reduce<{
              passed: number;
              cvReceived: number;
              selfPlacement: number;
              resumesNotReceived: number;
              others: number;
              interviewed: number;
              placed: number;
            }>(
              (acc, row) => ({
                passed: acc.passed + (Number(row.passedStudent || 0)),
                cvReceived: acc.cvReceived + (Number(row.totalCvReceived || 0)),
                selfPlacement: acc.selfPlacement + (Number(row.selfPlacement || 0)),
                resumesNotReceived: acc.resumesNotReceived + (Number(row.resumesNotReceived || 0)),
                others: acc.others + (Number(row.others || 0)),
                interviewed: acc.interviewed + (Number(row.totalInterviewed || 0)),
                placed: acc.placed + (Number(row.totalPlaced || 0)),
              }),
              { passed: 0, cvReceived: 0, selfPlacement: 0, resumesNotReceived: 0, others: 0, interviewed: 0, placed: 0 }
            );
            const totalPct = totals.passed > 0 ? Math.round((totals.placed / totals.passed) * 1000) / 10 : 0;

            return (
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-gradient-to-r from-slate-50/95 to-white/95 backdrop-blur-xl shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
                  <tr className="text-[11px] font-bold uppercase tracking-widest text-slate-600">
                    <th className="py-3 px-5 text-left border-b border-slate-200/50" rowSpan={2}>Course Name</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap border-b border-slate-200/50" rowSpan={2}>Batch No</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap border-b border-slate-200/50" rowSpan={2}>Convocation Date</th>
                    <th className="py-3 px-4 text-center border-b border-r border-slate-200/60" rowSpan={2}>Passed Student</th>
                    <th className="py-2 px-4 text-center text-[#2E3093] border-b border-slate-200/50" colSpan={4}>Candidate Status</th>
                    <th className="py-3 px-4 text-center border-b border-l border-slate-200/60" rowSpan={2}>Total Interviewed</th>
                    <th className="py-3 px-4 text-center border-b border-slate-200/50" rowSpan={2}>Total Placed</th>
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
                      ? 'text-[#2E3093] bg-[#FAE452]/70 ring-[#FAE452]/50'
                      : placedPct >= 40
                        ? 'text-[#2A6BB5] bg-[#2A6BB5]/10 ring-[#2A6BB5]/20'
                        : 'text-[#2E3093] bg-[#2E3093]/8 ring-[#2E3093]/15';

                    return (
                      <tr key={`${row.batchCode || 'batch'}-${index}`} className="group hover:bg-gradient-to-r hover:from-[#2A6BB5]/5 hover:to-white transition-all duration-300">
                        <td className="py-3.5 px-5 font-bold text-slate-800 max-w-[240px] relative">
                          <span className="absolute inset-y-0 left-0 w-1 bg-[#FAE452] opacity-0 group-hover:opacity-100 transition-opacity"></span>
                          <span className="truncate block group-hover:text-[#2A6BB5] transition-colors drop-shadow-sm pl-1">{row.courseName || 'N/A'}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center"><span className="font-mono bg-slate-50 border border-slate-200 text-slate-600 shadow-sm rounded-lg px-2.5 py-1 text-[11px] font-semibold">{toBatchNumber(row.batchCode)}</span></td>
                        <td className="py-3.5 px-4 text-center text-slate-500 whitespace-nowrap text-xs font-medium">{row.convocationDate || '—'}</td>
                        <td className="py-3.5 px-4 text-center font-black text-slate-800 border-r border-slate-100 group-hover:border-transparent drop-shadow-sm">{row.passedStudent ?? 0}</td>
                        <td className="py-3.5 px-4 text-center text-[#2A6BB5] font-extrabold">{row.totalCvReceived ?? 0}</td>
                        <td className="py-3.5 px-4 text-center text-[#2E3093] font-extrabold">{row.selfPlacement ?? 0}</td>
                        <td className="py-3.5 px-4 text-center text-[#2E3093] font-extrabold">{row.resumesNotReceived ?? 0}</td>
                        <td className="py-3.5 px-4 text-center text-slate-400 font-semibold">{row.others ?? 0}</td>
                        <td className="py-3.5 px-4 text-center text-[#2E3093] font-black border-l border-slate-100 group-hover:border-transparent drop-shadow-sm">{row.totalInterviewed ?? 0}</td>
                        <td className="py-3.5 px-4 text-center font-black text-[#2A6BB5] drop-shadow-sm">{row.totalPlaced ?? 0}</td>
                        <td className="py-3.5 px-5 text-center"><span className={`inline-flex items-center justify-center min-w-[48px] px-2.5 py-1.5 rounded-xl text-[12px] font-black shadow-sm ring-1 ring-inset ${pctColor}`}>{placedPct}%</span></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gradient-to-r from-slate-50/95 to-white/95 backdrop-blur-xl border-t-2 border-slate-200/60 font-black text-[12px] sticky bottom-0 z-20 shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
                    <td className="py-4 px-5 text-slate-600 uppercase tracking-widest drop-shadow-sm" colSpan={3}>Totals</td>
                    <td className="py-4 px-4 text-center text-slate-900 border-r border-slate-200/60 text-[13px]">{totals.passed}</td>
                    <td className="py-4 px-4 text-center text-[#2A6BB5] text-[13px]">{totals.cvReceived}</td>
                    <td className="py-4 px-4 text-center text-[#2E3093] text-[13px]">{totals.selfPlacement}</td>
                    <td className="py-4 px-4 text-center text-[#2E3093] text-[13px]">{totals.resumesNotReceived}</td>
                    <td className="py-4 px-4 text-center text-slate-500 text-[13px]">{totals.others}</td>
                    <td className="py-4 px-4 text-center text-[#2E3093] border-l border-slate-200/60 text-[13px]">{totals.interviewed}</td>
                    <td className="py-4 px-4 text-center text-[#2A6BB5] text-[15px] drop-shadow-sm">{totals.placed}</td>
                    <td className="py-4 px-5 text-center"><span className={`inline-flex items-center justify-center min-w-[52px] px-3 py-1.5 rounded-xl text-[13px] font-black shadow-md border border-white/60 ${totalPct >= 70 ? 'text-[#2E3093] bg-[#FAE452]/75 border-[#FAE452]/60' : totalPct >= 40 ? 'text-[#2A6BB5] bg-[#2A6BB5]/10 border-[#2A6BB5]/15' : 'text-[#2E3093] bg-[#2E3093]/8 border-[#2E3093]/12'}`}>{totalPct}%</span></td>
                  </tr>
                </tfoot>
              </table>
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
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#2E3093] font-bold">Task Manager</p>
                  <p className="text-xs text-slate-500 mt-1">Capture placement follow-ups quickly and keep them visible.</p>
                </div>
                <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-[#FAE452]/35 text-[#2E3093] border border-[#FAE452]/50">
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
                  <div key={todo.id} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
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
          <WidgetCard title="Placement Summary" count={summaryCards.length} className="lg:col-span-2" contentClassName="max-h-[400px]">
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {summaryCards.map((card) => (
                  <div key={card.label} className={`rounded-2xl border p-3 ${card.tone}`}>
                    <p className="text-[11px] uppercase tracking-wider font-bold opacity-85">{card.label}</p>
                    <p className="mt-2 text-2xl font-black leading-none">{card.value.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Recent Batch Outcomes</h4>
                  <span className="text-[11px] font-semibold text-slate-500">Live from database</span>
                </div>
                {summaryDetailRows.length === 0 ? (
                  <EmptyState text="No batch outcome details found" />
                ) : (
                  <div className="overflow-auto max-h-[220px]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-white border-b border-slate-200">
                        <tr>
                          <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Training</th>
                          <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Batch</th>
                          <th className="text-center px-3 py-2.5 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Passed</th>
                          <th className="text-center px-3 py-2.5 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Placed</th>
                          <th className="text-center px-3 py-2.5 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Interviews</th>
                          <th className="text-center px-4 py-2.5 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Placed %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {summaryDetailRows.map((row, idx) => {
                          const pct = Number(row.placement_pct || 0);
                          return (
                            <tr key={`${row.batch_id || idx}`} className="hover:bg-slate-50/70">
                              <td className="px-4 py-2.5 font-semibold text-slate-800 max-w-[220px] truncate">{row.course_name || 'N/A'}</td>
                              <td className="px-4 py-2.5 text-slate-600 font-mono text-xs">{toBatchNumber(row.batch_code)}</td>
                              <td className="px-3 py-2.5 text-center font-bold text-slate-800">{Number(row.passed_students || 0).toLocaleString()}</td>
                              <td className="px-3 py-2.5 text-center font-bold text-[#2A6BB5]">{Number(row.placed_students || 0).toLocaleString()}</td>
                              <td className="px-3 py-2.5 text-center font-semibold text-slate-700">{Number(row.interviews_count || 0).toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={`inline-flex min-w-[58px] items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold border ${pct >= 70 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : pct >= 40 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                  {pct.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </WidgetCard>

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
                columns={['Date', 'Company', 'Training Name', 'Batch']}
                rows={completedInterviews.map((r, idx) => (
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

          <WidgetCard title="Job Opening Tracker" count={jobOpeningTracker.length} contentClassName="max-h-none h-full">
            {jobOpeningTracker.length === 0 ? (
              <EmptyState />
            ) : (
              <Table
                columns={['Company', 'Designation', 'Location', 'Deadline', 'Status', 'Applications']}
                rows={jobOpeningTracker.map((r, idx) => (
                  <tr key={`${r.company_name}-${r.designation}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{r.company_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{r.designation || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{r.location || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{r.application_deadline || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusTone(r.status || '-')}`}>
                        {r.status || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#2E3093]">{Number(r.total_applications || 0).toLocaleString()}</td>
                  </tr>
                ))}
              />
            )}
          </WidgetCard>

          <WidgetCard title="Company Visits Planned" count={companyVisitsPlanned.length} contentClassName="max-h-none h-full">
            {companyVisitsPlanned.length === 0 ? (
              <EmptyState />
            ) : (
              <Table
                columns={['Date', 'Region', 'Location', 'Training Name', 'Batch']}
                rows={companyVisitsPlanned.map((r, idx) => (
                  <tr key={`${r.visit_date}-${r.batch_code}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{r.visit_date || '-'}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{r.region || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{r.location || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{r.training_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{toBatchNumber(r.batch_code)}</td>
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
                columns={['Company', 'Profile', 'Training Name', 'Batch', 'Posted Date']}
                rows={campusInterviewsPlanned.map((r, idx) => (
                  <tr key={`${r.company_name}-${r.profile}-${r.batch_code}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{r.company_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{r.profile || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{r.training_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{toBatchNumber(r.batch_code)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{r.posted_date || '-'}</td>
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
