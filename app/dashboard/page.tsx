/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  QuickStatsSkeleton,
  TableSkeleton,
  WidgetSkeleton,
  UpcomingBatchesSkeleton,
  EnquirySkeleton,
} from './components/Skeletons';

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
}

// --- Mini Sparkline (SVG) ---
function Sparkline({ data, color = '#2E3093' }: { data: number[]; color?: string }) {
  if (!data || data.length === 0) return <span className="text-[10px] text-gray-300">—</span>;
  const max = Math.max(...data, 1);
  const w = 80, h = 24, pad = 2;
  const points = data.map((v, i) => {
    const x = pad + (i / Math.max(data.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - (v / max) * (h - pad * 2);
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} className="inline-block align-middle">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points.join(' ')} />
      {data.length > 0 && (
        <circle cx={parseFloat(points[points.length - 1].split(',')[0])} cy={parseFloat(points[points.length - 1].split(',')[1])} r="2.5" fill={color} />
      )}
    </svg>
  );
}

// --- Stat Card ---
function StatCard({ icon, label, value, color, glow }: { icon: React.ReactNode; label: string; value: number | string; color: string; glow: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl p-6 flex flex-col justify-center gap-3 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/80 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 group">
      {/* Background soft glow */ }
      <div className={`absolute -right-6 -top-6 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 ${glow} pointer-events-none`}></div>
      <div className="flex items-center gap-4 relative z-10">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${color}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-3xl font-black text-gray-900 leading-none tracking-tight">{typeof value === 'number' ? value.toLocaleString() : value}</p>
          <p className="text-[11px] text-gray-500 mt-1.5 font-bold uppercase tracking-widest">{label}</p>
        </div>
      </div>
    </div>
  );
}

// --- Widget Card Wrapper ---
function Widget({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/50 overflow-hidden flex flex-col backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

function WidgetHeader({ title, icon, badge, accent = 'from-[#2E3093] to-[#2A6BB5]' }: { title: string; icon: React.ReactNode; badge?: string | number; accent?: string }) {
  return (
    <div className={`bg-gradient-to-r ${accent} px-6 py-4 flex items-center gap-3 relative overflow-hidden`}>
      <div className="absolute inset-0 bg-white/5 mix-blend-overlay"></div>
      <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner relative z-10 border border-white/20">{icon}</div>
      <h2 className="text-white font-bold text-[15px] tracking-wide flex-1 relative z-10">{title}</h2>
      {badge !== undefined && (
        <span className="text-[11px] bg-white/25 backdrop-blur-md text-white border border-white/20 rounded-full px-3 py-1 font-bold relative z-10 shadow-sm">{badge}</span>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodo, setNewTodo] = useState('');

  // Fetch dashboard data
  useEffect(() => {
    let cancelled = false;
    fetch('/api/dashboard')
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); })
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Load todos from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sit-dashboard-todos');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setTodos(JSON.parse(saved));
  }, []);

  const saveTodos = useCallback((items: TodoItem[]) => {
    setTodos(items);
    localStorage.setItem('sit-dashboard-todos', JSON.stringify(items));
  }, []);

  const addTodo = () => {
    if (!newTodo.trim()) return;
    saveTodos([{ id: Date.now().toString(), text: newTodo.trim(), done: false, createdAt: new Date().toISOString() }, ...todos]);
    setNewTodo('');
  };

  const toggleTodo = (id: string) => saveTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const removeTodo = (id: string) => saveTodos(todos.filter(t => t.id !== id));

  const qs = data?.quickStats ?? { totalStudents: 0, activeCourses: 0, activeBatches: 0, totalFaculty: 0 };

  return (
    <div className="space-y-6 pb-8">
      {/* ── Quick Stats Row ── */}
      {loading ? (
        <QuickStatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>}
          label="Total Students" value={qs.totalStudents}
          color="bg-gradient-to-br from-[#2E3093] to-[#4547B2] text-white" glow="bg-[#2E3093]"
        />
        <StatCard
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>}
          label="Active Courses" value={qs.activeCourses}
          color="bg-gradient-to-br from-[#2A6BB5] to-[#4A90D9] text-white" glow="bg-[#2A6BB5]"
        />
        <StatCard
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>}
          label="Active Batches" value={qs.activeBatches}
          color="bg-gradient-to-br from-[#FAE452] to-[#FBEA75] text-[#2E3093]" glow="bg-[#FAE452]"
        />
        <StatCard
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>}
          label="Faculty Members" value={qs.totalFaculty}
          color="bg-gradient-to-br from-white to-gray-50 text-[#2A6BB5] border border-gray-100" glow="bg-gray-200"
        />
      </div>
      )}

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Annual Targets (full width) ── */}
        {loading ? (
          <TableSkeleton rows={6} cols={10} className="lg:col-span-3" />
        ) : (
        <Widget className="lg:col-span-3">
          <WidgetHeader
            title="Annual Targets"
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>}
            badge={`${new Date().getFullYear()} · ${(data?.annualTargets?.batchTargets ?? []).length} programs`}
          />
          <div className="p-0 flex-1 overflow-auto max-h-[420px]">
            {(data?.annualTargets?.batchTargets?.length ?? 0) > 0 ? (() => {
              const sparkMap: Record<number, number[]> = data?.placementReport?.sparkMap ?? {};
              // Also build from sparklineData if sparkMap doesn't have the data
              const rawSparkMap: Record<number, number[]> = { ...sparkMap };
              (data?.annualTargets?.sparklineData ?? []).forEach((s: any) => {
                if (!rawSparkMap[s.Course_Id]) rawSparkMap[s.Course_Id] = new Array(12).fill(0);
                const monthIdx = parseInt(s.month.split('-')[1], 10) - 1;
                rawSparkMap[s.Course_Id][monthIdx] = s.batch_count;
              });

              return (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                      <th className="text-left py-3 px-4">#</th>
                      <th className="text-left py-3 px-4">Training Program</th>
                      <th className="text-center py-3 px-4">Duration</th>
                      <th className="text-right py-3 px-4">Fees (₹)</th>
                      <th className="text-center py-3 px-4">Freq.</th>
                      <th className="text-center py-3 px-4">Target</th>
                      <th className="text-center py-3 px-4 whitespace-nowrap">Min Stu.</th>
                      <th className="text-center py-3 px-4">Admitted</th>
                      <th className="text-center py-3 px-4 whitespace-nowrap">Stu. Target</th>
                      <th className="text-center py-3 px-4 w-[80px]">Trend</th>
                      <th className="text-right py-3 px-4">Collected</th>
                      <th className="text-right py-3 px-4 whitespace-nowrap">Fees Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.annualTargets?.batchTargets ?? []).map((t: any, i: number) => {
                      const minStu = parseInt(t.min_students_batch) || 15;
                      const targetFreq = Number(t.target_frequency) || 1;
                      const yearlyTarget = minStu * targetFreq;
                      const fees = Number(t.Fees) || 0;
                      const feesTarget = yearlyTarget * fees;
                      const feesCollected = Number(t.fees_collected) || 0;
                      const admitted = Number(t.students_admitted) || 0;
                      const adPct = yearlyTarget > 0 ? Math.min(100, (admitted / yearlyTarget) * 100) : 0;
                      const spark = rawSparkMap[t.Course_Id] ?? [];
                      const conducted = Number(t.frequency_conducted) || 0;

                      return (
                        <tr key={t.Course_Id ?? i} className="border-b border-gray-100 hover:bg-slate-50/80 transition-all duration-200 group">
                          <td className="py-3 px-4 text-gray-400 font-semibold text-xs">{i + 1}</td>
                          <td className="py-3 px-4 font-bold text-gray-800 max-w-[240px]"><span className="truncate block group-hover:text-[#2E3093] transition-colors">{t.CourseName || 'N/A'}</span></td>
                          <td className="py-3 px-4 text-center"><span className="bg-slate-100 text-slate-600 rounded-md px-2 py-1 text-[11px] font-medium">{t.Duration || '—'}</span></td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-700 whitespace-nowrap">{fees > 0 ? `₹${fees.toLocaleString('en-IN')}` : '—'}</td>
                          <td className="py-3 px-4 text-center"><span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold shadow-sm ${conducted >= targetFreq ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{conducted}</span></td>
                          <td className="py-3 px-4 text-center"><span className="inline-block px-2.5 py-1 rounded-full bg-indigo-50 text-[#2E3093] text-[11px] font-bold shadow-sm">{targetFreq}</span></td>
                          <td className="py-3 px-4 text-center text-slate-600 font-medium">{minStu}</td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-extrabold text-gray-900">{admitted}</span>
                              <div className="w-12 bg-gray-100 rounded-full h-1.5 overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${adPct >= 80 ? 'bg-emerald-500' : adPct >= 40 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${adPct}%` }} /></div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-[#2E3093]">{yearlyTarget}</td>
                          <td className="py-3 px-4 text-center"><Sparkline data={spark} color={conducted >= targetFreq ? '#10B981' : '#4F46E5'} /></td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <span className="font-bold text-slate-700">{feesCollected > 0 ? `₹${(feesCollected / 100000).toFixed(1)}L` : '—'}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-extrabold text-[#2E3093] whitespace-nowrap">{feesTarget > 0 ? `₹${(feesTarget / 100000).toFixed(1)}L` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50/90 backdrop-blur-md border-t-2 border-slate-200 font-bold text-[12px] sticky bottom-0 z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]">
                      <td className="py-3 px-4" colSpan={4}><span className="text-slate-500 uppercase tracking-widest">Totals</span></td>
                      <td className="py-3 px-4 text-center text-slate-800">{(data?.annualTargets?.batchTargets ?? []).reduce((s: number, t: any) => s + (Number(t.frequency_conducted) || 0), 0)}</td>
                      <td className="py-3 px-4 text-center text-[#2E3093]">{(data?.annualTargets?.batchTargets ?? []).reduce((s: number, t: any) => s + (Number(t.target_frequency) || 1), 0)}</td>
                      <td className="py-3 px-4"></td>
                      <td className="py-3 px-4 text-center text-slate-800">{(data?.annualTargets?.batchTargets ?? []).reduce((s: number, t: any) => s + (Number(t.students_admitted) || 0), 0)}</td>
                      <td className="py-3 px-4 text-center text-[#2E3093]">{(data?.annualTargets?.batchTargets ?? []).reduce((s: number, t: any) => { const ms = parseInt(t.min_students_batch) || 15; const tf = Number(t.target_frequency) || 1; return s + ms * tf; }, 0)}</td>
                      <td className="py-3 px-4"></td>
                      <td className="py-3 px-4 text-right text-slate-800">₹{((data?.annualTargets?.batchTargets ?? []).reduce((s: number, t: any) => s + (Number(t.fees_collected) || 0), 0) / 100000).toFixed(1)}L</td>
                      <td className="py-3 px-4 text-right text-[#2E3093]">₹{((data?.annualTargets?.batchTargets ?? []).reduce((s: number, t: any) => { const ms = parseInt(t.min_students_batch) || 15; const tf = Number(t.target_frequency) || 1; const f = Number(t.Fees) || 0; return s + ms * tf * f; }, 0) / 100000).toFixed(1)}L</td>
                    </tr>
                  </tfoot>
                </table>
              );
            })() : (
              <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>
                <p className="text-sm">No target data for this year</p>
              </div>
            )}
          </div>
        </Widget>
        )}

        {/* ── ROW 2: Upcoming Batches & Todo List ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:col-span-3 w-full">
          {/* ── Upcoming Batches (2 col)  ── */}
          {loading ? (
            <UpcomingBatchesSkeleton />
          ) : (
          <Widget className="lg:col-span-2">
            <WidgetHeader
              title="Upcoming Batches"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>}
              badge={(data?.upcomingBatches ?? []).length}
              accent="from-[#2A6BB5] to-[#4A90D9]"
            />
            <div className="p-4 flex-1 overflow-auto max-h-80">
              {(data?.upcomingBatches ?? []).length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-2 gap-y-1.5">
                  {(data?.upcomingBatches ?? []).map((b: any) => (
                    <div key={b.Batch_Id} className="relative overflow-hidden rounded-2xl border border-sky-100/60 bg-white p-4 hover:border-sky-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 group">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-sky-50 to-transparent rounded-bl-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
                      <div className="relative z-10">
                        <div className="flex items-start justify-between mb-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-800 text-[14px] truncate group-hover:text-[#2A6BB5] transition-colors">{b.CourseName || `Batch ${b.Batch_code}`}</p>
                            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                              <span className="font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px] border border-slate-200/60">{b.Batch_code}</span>
                              <span>&middot;</span>
                              <span>{b.Category}</span>
                            </p>
                          </div>
                          <span className="text-[11px] bg-gradient-to-r from-[#FAE452] to-[#FCD34D] text-[#2E3093] font-black px-3 py-1.5 rounded-xl whitespace-nowrap shadow-sm border border-[#FBE14F]/50 transform group-hover:scale-105 transition-transform">
                            {b.SDate}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-2 text-[11px] text-slate-600 font-medium bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                          {b.Duration && <span className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100"><svg className="w-3.5 h-3.5 text-[#2A6BB5]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>{b.Duration}</span>}
                          {b.Timings && <span className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100">{b.Timings}</span>}
                          {b.Training_Coordinator && <span className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100"><svg className="w-3.5 h-3.5 text-[#2A6BB5]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>{b.Training_Coordinator}</span>}
                          {b.INR_Basic ? <span className="font-extrabold text-[#2E3093] ml-auto self-center text-[13px]">₹{Number(b.INR_Basic).toLocaleString()}</span> : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                  <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>
                  <p className="text-sm">No upcoming batches</p>
                </div>
              )}
            </div>
          </Widget>
          )}

          {/* ── Todo List (client-only, col 3) ── */}
          <Widget className="lg:col-span-1">
            <WidgetHeader
              title="To-Do List"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
              badge={`${todos.filter(t => !t.done).length} pending`}
              accent="from-[#2E3093] to-[#4547B2]"
            />
            <div className="p-4 flex-1 flex flex-col">
              <div className="flex gap-3 mb-4">
                <input
                  type="text"
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTodo()}
                  placeholder="Add a new task..."
                  className="flex-1 text-sm bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-4 focus:ring-[#2E3093]/10 focus:border-[#2E3093] placeholder:text-gray-400 transition-all font-medium"
                />
                <button
                  onClick={addTodo}
                  className="bg-gradient-to-br from-[#2E3093] to-[#2A6BB5] hover:to-[#1a4a84] text-white px-4 py-3 rounded-xl transition-all shadow-[0_4px_14px_rgba(46,48,147,0.3)] hover:shadow-[0_6px_20px_rgba(46,48,147,0.4)] hover:-translate-y-0.5 text-sm font-bold flex items-center justify-center min-w-[3.5rem]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                </button>
              </div>
              <div className="space-y-1.5 overflow-y-auto max-h-[300px] flex-1">
                {todos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-300">
                    <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75"/></svg>
                    <p className="text-sm">No tasks yet</p>
                  </div>
                ) : (
                  todos.map((todo) => (
                    <div
                      key={todo.id}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
                        todo.done ? 'bg-gray-50/50 opacity-60' : 'bg-white border border-gray-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:border-[#2E3093]/30 hover:shadow-md hover:-translate-y-0.5'
                      }`}
                    >
                      <button onClick={() => toggleTodo(todo.id)} className="shrink-0 relative">
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-300 ${
                          todo.done ? 'bg-[#2E3093] border-[#2E3093]' : 'border-gray-300 group-hover:border-[#2E3093]'
                        }`}>
                          {todo.done && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                        </div>
                      </button>
                      <span className={`flex-1 text-[13px] font-medium transition-all ${todo.done ? 'line-through text-gray-400' : 'text-slate-700'}`}>{todo.text}</span>
                      <button onClick={() => removeTodo(todo.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1.5 bg-red-50 hover:bg-red-100 rounded-lg">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Widget>
        </div>

        {/* ── ROW 3: Secondary Info Widgets ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:col-span-3 w-full">
          {/* ── Notice Board  ── */}
          {loading ? (
            <WidgetSkeleton lines={3} />
          ) : (
          <Widget>
            <WidgetHeader
              title="Notice Board"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/></svg>}
              accent="from-[#2A6BB5] to-[#4A90D9]"
            />
            <div className="p-4 flex-1 overflow-auto max-h-80">
            {(data?.notices ?? []).length > 0 ? (
              <div className="space-y-3">
                {(data?.notices ?? []).map((n: any) => (
                  <div key={n.id} className="p-4 rounded-2xl bg-gradient-to-br from-purple-50/80 to-purple-100/30 border border-purple-100/50 hover:shadow-md hover:border-purple-200 transition-all duration-300 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-400 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    <div className="text-[13px] text-slate-700 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: n.specification }} />
                    <div className="flex items-center gap-3 mt-3 text-[10px] text-purple-600/70 font-semibold uppercase tracking-wider">
                      {n.startdate && <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> {n.startdate}</span>}
                      {n.enddate && <span className="flex items-center gap-1">To: {n.enddate}</span>}
                      {n.created_date && <span className="ml-auto bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md">{new Date(n.created_date).toLocaleDateString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38a1.125 1.125 0 01-1.493-.368 16.5 16.5 0 01-1.412-2.955m5.05-7.553c.253-.962.584-1.892.985-2.783a1.125 1.125 0 00-.463-1.511l-.657-.38a1.125 1.125 0 00-1.493.368 16.5 16.5 0 00-1.412 2.955m5.05 7.553a16.58 16.58 0 002.632-7.552l.01-.096a1.125 1.125 0 00-.937-1.244l-.749-.111a1.125 1.125 0 00-1.275.811 14.27 14.27 0 01-2.261 5.184m5.17-7.565l-.749-.112a1.125 1.125 0 01-.811-1.275 12.78 12.78 0 00-1.072-6.78 1.125 1.125 0 00-1.544-.448l-.66.38a1.125 1.125 0 00-.415 1.522c.474.923.775 1.93.887 2.972"/></svg>
                <p className="text-sm">No notices</p>
              </div>
            )}
          </div>
        </Widget>
        )}

          {/* ── Enquiry Report  ── */}
          {loading ? (
            <EnquirySkeleton />
          ) : (
          <Widget>
            <WidgetHeader
              title="Enquiry Report"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>}
              accent="from-[#2E3093] to-[#4547B2]"
            />
            <div className="p-4 flex-1 overflow-auto max-h-80">
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-2xl p-4 text-center border border-indigo-100/50 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                <div className="absolute inset-0 bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <p className="text-2xl font-black text-[#2E3093] relative z-10">{data?.enquiryReport?.summary?.total_enquiries ?? 0}</p>
                <p className="text-[10px] text-indigo-600/70 mt-1 font-bold uppercase tracking-widest relative z-10">Student</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl p-4 text-center border border-emerald-100/50 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                <div className="absolute inset-0 bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <p className="text-2xl font-black text-emerald-600 relative z-10">{data?.enquiryReport?.corporateTotal ?? 0}</p>
                <p className="text-[10px] text-emerald-600/70 mt-1 font-bold uppercase tracking-widest relative z-10">Corporate</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-2xl p-4 text-center border border-purple-100/50 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                <div className="absolute inset-0 bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <p className="text-2xl font-black text-purple-600 relative z-10">{(data?.enquiryReport?.summary?.total_enquiries ?? 0) + (data?.enquiryReport?.corporateTotal ?? 0)}</p>
                <p className="text-[10px] text-purple-600/70 mt-1 font-bold uppercase tracking-widest relative z-10">Total</p>
              </div>
            </div>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              Recent Corporate <div className="h-px bg-slate-100 flex-1"></div>
            </h3>
            <div className="space-y-2 overflow-y-auto max-h-48 pr-1">
              {(data?.enquiryReport?.recentCorporate ?? []).length > 0 ? (
                (data?.enquiryReport?.recentCorporate ?? []).map((e: any) => (
                  <div key={e.Id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:border-indigo-100 hover:shadow-[0_4px_20px_rgb(0,0,0,0.04)] hover:-translate-y-0.5 transition-all duration-300">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 text-[#2E3093] flex items-center justify-center text-[14px] font-black shrink-0 shadow-inner border border-indigo-100/50">
                      {(e.FullName || '?')[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold text-slate-800 truncate">{e.FullName}</p>
                      <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">{e.CompanyName}{e.Designation ? ` · ${e.Designation}` : ''}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap bg-white px-2 py-1 rounded-md border border-slate-100 shadow-sm">{e.Idate || ''}</span>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-sm text-center py-6 border-2 border-dashed border-slate-100 rounded-2xl font-medium flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  No recent enquiries
                </p>
              )}
            </div>
            </div>
          </Widget>
          )}

          {/* ── Company Requirements  ── */}
          {loading ? (
            <WidgetSkeleton lines={3} />
          ) : (
          <Widget>
            <WidgetHeader
              title="Company Requirements"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>}
              badge={`${data?.placementReport?.activeRequirements ?? 0} active`}
              accent="from-[#2A6BB5] to-[#4A90D9]"
            />
            <div className="p-4 flex-1 overflow-auto max-h-80">
              {(data?.placementReport?.companyRequirements ?? []).length > 0 ? (
                <div className="space-y-3 pr-1">
                  {(data?.placementReport?.companyRequirements ?? []).map((r: any) => (
                    <div key={r.CompReqId} className="p-4 rounded-2xl border border-sky-100/50 bg-gradient-to-br from-white to-sky-50/20 hover:border-sky-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 group">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[14px] font-bold text-slate-800 truncate group-hover:text-[#2A6BB5] transition-colors">{r.Profile || 'Open Position'}</p>
                          <p className="text-[11px] text-slate-500 font-medium mt-1 inline-flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-[#2A6BB5]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg> {r.CompanyName || 'Company'}{r.Location ? ` · ${r.Location}` : ''}</p>
                        </div>
                        {r.PostedDate && <span className="text-[10px] text-sky-600/70 font-bold whitespace-nowrap bg-sky-50 px-2 py-1 rounded-md border border-sky-100">{r.PostedDate}</span>}
                      </div>
                      {r.Eligibility && <p className="text-[12px] text-slate-600 mt-2.5 leading-relaxed bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">{r.Eligibility}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                  <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
                  <p className="text-sm">No active requirements</p>
                </div>
              )}
            </div>
          </Widget>
          )}
        </div>

        {/* ── ROW 4: Placement Report ── */}
        {loading ? (
          <TableSkeleton rows={5} cols={11} className="lg:col-span-3" />
        ) : (
        <Widget className="lg:col-span-3">
          <WidgetHeader
            title="Placement Report"
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>}
            badge={`${(data?.placementReport?.rows ?? []).length} batches`}
            accent="from-[#2E3093] to-[#4547B2]"
          />
          <div className="p-0 flex-1 overflow-auto max-h-[420px]">
            {(data?.placementReport?.rows ?? []).length > 0 ? (() => {
              const rows = (data?.placementReport?.rows ?? []).slice(0, 10);
              const totals = rows.reduce(
                (acc: any, r: any) => ({
                  passed: acc.passed + (r.passedStudent || 0),
                  cvReceived: acc.cvReceived + (r.totalCvReceived || 0),
                  selfPlacement: acc.selfPlacement + (r.selfPlacement || 0),
                  resumesNotReceived: acc.resumesNotReceived + (r.resumesNotReceived || 0),
                  others: acc.others + (r.others || 0),
                  interviewed: acc.interviewed + (r.totalInterviewed || 0),
                  placed: acc.placed + (r.totalPlaced || 0),
                }),
                { passed: 0, cvReceived: 0, selfPlacement: 0, resumesNotReceived: 0, others: 0, interviewed: 0, placed: 0 }
              );
              const totalPct = totals.passed > 0 ? Math.round((totals.placed / totals.passed) * 1000) / 10 : 0;

              return (
                <table className="w-full text-sm border-collapse">
                  <thead className="shadow-[0_4px_20px_rgb(0,0,0,0.03)] bg-teal-50/95 backdrop-blur-xl sticky top-0 z-20 before:content-[''] before:absolute before:inset-0 before:border-b before:border-teal-100/60 before:z-[-1]">
                    <tr className="text-[11px] font-bold uppercase tracking-widest text-teal-800">
                      <th className="py-3 px-5 text-left border-b border-teal-100/50" rowSpan={2}>Course</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap border-b border-teal-100/50" rowSpan={2}>Batch</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap border-b border-teal-100/50" rowSpan={2}>Conv. Date</th>
                      <th className="py-3 px-4 text-center border-b border-r border-teal-100/50" rowSpan={2}>Passed</th>
                      <th className="py-2 px-4 text-center text-teal-700 border-b border-teal-100/50" colSpan={4}>Candidate Status</th>
                      <th className="py-3 px-4 text-center border-b border-l border-teal-100/50" rowSpan={2}>Intervw.</th>
                      <th className="py-3 px-4 text-center border-b border-teal-100/50" rowSpan={2}>Placed</th>
                      <th className="py-3 px-5 text-center border-b border-teal-100/50" rowSpan={2}>Conv. Rate</th>
                    </tr>
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-teal-700 bg-teal-50/50">
                      <th className="py-2.5 px-4 text-center border-l border-b border-teal-100/50">CV Recv</th>
                      <th className="py-2.5 px-4 text-center border-b border-teal-100/50">Self</th>
                      <th className="py-2.5 px-4 text-center whitespace-nowrap border-b border-teal-100/50">No Resume</th>
                      <th className="py-2.5 px-4 text-center border-b border-teal-100/50">Others</th>
                    </tr>
                  </thead>
                    <tbody className="divide-y divide-teal-50">
                    {rows.map((r: any, i: number) => {
                      const pct = r.placedPct ?? 0;
                      const pctColor = pct >= 70 ? 'text-teal-700 bg-teal-100/80 ring-teal-600/20' : pct >= 40 ? 'text-amber-700 bg-amber-100/80 ring-amber-600/20' : 'text-rose-700 bg-rose-100/80 ring-rose-600/20';
                      return (
                        <tr key={r.batchCode ?? i} className="group hover:bg-gradient-to-r hover:from-teal-50/40 hover:to-white transition-all duration-300">
                          <td className="py-3.5 px-5 font-bold text-slate-800 max-w-[240px] relative">
                            <span className="absolute inset-y-0 left-0 w-1 bg-teal-400 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            <span className="truncate block group-hover:text-teal-700 transition-colors drop-shadow-sm pl-1">{r.courseName || 'N/A'}</span>
                          </td>
                          <td className="py-3.5 px-4 text-center"><span className="font-mono bg-slate-50 border border-slate-200 text-slate-600 shadow-sm rounded-lg px-2.5 py-1 text-[11px] font-semibold">{r.batchCode}</span></td>
                          <td className="py-3.5 px-4 text-center text-slate-500 whitespace-nowrap text-xs font-medium">{r.convocationDate || '—'}</td>
                          <td className="py-3.5 px-4 text-center font-black text-slate-800 border-r border-teal-50/50 group-hover:border-transparent drop-shadow-sm">{r.passedStudent}</td>
                          <td className="py-3.5 px-4 text-center text-indigo-600 font-extrabold">{r.totalCvReceived}</td>
                          <td className="py-3.5 px-4 text-center text-purple-600 font-extrabold">{r.selfPlacement}</td>
                          <td className="py-3.5 px-4 text-center text-amber-600 font-extrabold">{r.resumesNotReceived}</td>
                          <td className="py-3.5 px-4 text-center text-slate-400 font-semibold">{r.others}</td>
                          <td className="py-3.5 px-4 text-center text-[#2E3093] font-black border-l border-teal-50/50 group-hover:border-transparent drop-shadow-sm">{r.totalInterviewed}</td>
                          <td className="py-3.5 px-4 text-center font-black text-teal-600 drop-shadow-sm">{r.totalPlaced}</td>
                          <td className="py-3.5 px-5 text-center"><span className={`inline-flex items-center justify-center min-w-[48px] px-2.5 py-1.5 rounded-xl text-[12px] font-black shadow-sm ring-1 ring-inset ${pctColor}`}>{pct}%</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gradient-to-r from-teal-50/95 to-teal-100/95 backdrop-blur-xl border-t-2 border-teal-200/60 font-black text-[12px] sticky bottom-0 z-20 shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
                      <td className="py-4 px-5 text-teal-800 uppercase tracking-widest drop-shadow-sm" colSpan={3}>Totals</td>
                      <td className="py-4 px-4 text-center text-slate-900 border-r border-teal-200/40 text-[13px]">{totals.passed}</td>
                      <td className="py-4 px-4 text-center text-indigo-700 text-[13px]">{totals.cvReceived}</td>
                      <td className="py-4 px-4 text-center text-purple-700 text-[13px]">{totals.selfPlacement}</td>
                      <td className="py-4 px-4 text-center text-amber-700 text-[13px]">{totals.resumesNotReceived}</td>
                      <td className="py-4 px-4 text-center text-slate-500 text-[13px]">{totals.others}</td>
                      <td className="py-4 px-4 text-center text-[#2E3093] border-l border-teal-200/40 text-[13px]">{totals.interviewed}</td>
                      <td className="py-4 px-4 text-center text-teal-700 text-[15px] drop-shadow-sm">{totals.placed}</td>
                      <td className="py-4 px-5 text-center"><span className={`inline-flex items-center justify-center min-w-[52px] px-3 py-1.5 rounded-xl text-[13px] font-black shadow-md border border-white/60 ${totalPct >= 70 ? 'text-teal-800 bg-teal-100' : totalPct >= 40 ? 'text-amber-800 bg-amber-100' : 'text-rose-800 bg-rose-100'}`}>{totalPct}%</span></td>
                    </tr>
                  </tfoot>
                </table>
              );
            })() : (
              <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
                <p className="text-sm">No placement data available</p>
              </div>
            )}
          </div>
        </Widget>
        )}
      </div>
    </div>
  );
}
