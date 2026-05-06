/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback } from 'react';

/* ─────────────────────────── Types ─────────────────────────────── */
type Rec = Record<string, any>;

/* ─────────────────────────── Helpers ───────────────────────────── */
function fmt(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  if (!v) return '—';
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)} Cr`;
  if (v >= 100_000)    return `₹${(v / 100_000).toFixed(2)} L`;
  return `₹${v.toLocaleString('en-IN')}`;
}
function pct(a: any, b: any) {
  const av = Number(a ?? 0), bv = Number(b ?? 1);
  return bv > 0 ? Math.min(100, Math.round((av / bv) * 100)) : 0;
}
function clamp(v: number) { return Math.min(100, Math.max(0, v)); }
function tone(v: number) {
  if (v >= 80) return { text: 'text-emerald-600', bar: 'bg-emerald-500', ring: '#10b981' };
  if (v >= 50) return { text: 'text-amber-600',   bar: 'bg-amber-400',   ring: '#f59e0b' };
  return         { text: 'text-rose-600',   bar: 'bg-rose-500',   ring: '#ef4444' };
}

async function apiFetch(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* ─────────────────────────── Donut Gauge ───────────────────────── */
function DonutGauge({ value, size = 72, stroke = 7 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const t = tone(clamp(value));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={t.ring} strokeWidth={stroke}
        strokeDasharray={`${(clamp(value) / 100) * circ} ${circ}`}
        strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.7s ease' }} />
    </svg>
  );
}

/* ─────────────────────────── Sparkline ─────────────────────────── */
function Sparkline({ data, color = '#2E3093' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 100, h = 30, pad = 3;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - (v / max) * (h - pad * 2);
    return `${x},${y}`;
  });
  const fill = pts.map((p, i) => i === 0 ? `M${p}` : `L${p}`).join(' ') + ` L${w - pad},${h} L${pad},${h} Z`;
  return (
    <svg width={w} height={h} className="block">
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#sg-${color.replace('#','')})`} />
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={pts.join(' ')} />
    </svg>
  );
}

/* ─────────────────────────── KPI Card ──────────────────────────── */
function KpiCard({ label, value, sub, trend, color = '#2E3093', icon }: {
  label: string; value: string; sub?: string; trend?: number[]; color?: string; icon: React.ReactNode;
}) {
  return (
    <div className="relative bg-white rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgb(0,0,0,0.05)] p-5 flex flex-col gap-3 overflow-hidden group hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.1)] transition-all duration-300">
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full blur-2xl opacity-10 group-hover:opacity-20 transition-opacity" style={{ background: color }} />
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${color} 12%, white)` }}>
          <span style={{ color }}>{icon}</span>
        </div>
        {trend && <Sparkline data={trend} color={color} />}
      </div>
      <div>
        <p className="text-2xl font-black text-gray-900 leading-none tracking-tight">{value}</p>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mt-1">{label}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ─────────────────────────── Section Header ────────────────────── */
function SectionHeader({ title, icon, badge }: { title: string; icon: React.ReactNode; badge?: string | number }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100" style={{ borderLeft: '3px solid #2E3093' }}>
      <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[#2E3093]/10">
        <span className="text-[#2E3093] [&_svg]:w-3.5 [&_svg]:h-3.5">{icon}</span>
      </span>
      <span className="font-bold text-gray-800 text-sm flex-1">{title}</span>
      {badge !== undefined && (
        <span className="text-[11px] font-semibold text-gray-400 tabular-nums">{badge}</span>
      )}
    </div>
  );
}

/* ─────────────────────────── Bar Row ───────────────────────────── */
function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const p = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const t = tone(p);
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
      <p className="text-xs text-gray-700 w-36 truncate shrink-0">{label}</p>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${t.bar}`} style={{ width: `${p}%` }} />
      </div>
      <span className={`text-[11px] font-bold tabular-nums w-12 text-right shrink-0 ${t.text}`}>{p}%</span>
      <span className="text-[11px] text-gray-500 tabular-nums w-16 text-right shrink-0">{fmt(value)}</span>
    </div>
  );
}

/* ─────────────────────────── Loading skeleton ──────────────────── */
function Pulse({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-100 animate-pulse rounded-lg ${className}`} />;
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════ */
export default function FinanceDashboard() {
  const now = new Date();
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const year = now.getFullYear();
  const monthYear = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;

  const [depts,   setDepts]   = useState<Rec[]>([]);
  const [loans,   setLoans]   = useState<Rec[]>([]);
  const [salary,  setSalary]  = useState<Rec | null>(null);
  const [plans,   setPlans]   = useState<Rec[]>([]);
  const [fees,    setFees]    = useState<Rec[]>([]);
  const [cashflow, setCashflow] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, l, s, p, f, c] = await Promise.allSettled([
        apiFetch(`/api/finance/dept-performance?month_year=${monthYear}`),
        apiFetch('/api/finance/loans'),
        apiFetch(`/api/finance/salary-cashflow?month_year=${monthYear}`),
        apiFetch('/api/finance/debt-plan'),
        apiFetch('/api/finance/pending-fees'),
        apiFetch('/api/finance/cashflow'),
      ]);
      if (d.status === 'fulfilled') setDepts(d.value.rows ?? []);
      if (l.status === 'fulfilled') setLoans(l.value.rows ?? []);
      if (s.status === 'fulfilled') setSalary(s.value.row ?? null);
      if (p.status === 'fulfilled') setPlans(p.value.rows ?? []);
      if (f.status === 'fulfilled') setFees(f.value.rows ?? []);
      if (c.status === 'fulfilled') setCashflow(c.value.rows ?? []);
    } catch {}
    setLoading(false);
  }, [monthYear]);

  useEffect(() => { load(); }, [load]);

  /* ── Derived KPIs ───────────────────────────────────────────────── */
  const totalRevenue    = cashflow.reduce((s, r) => s + Number(r.receipt ?? 0), 0);
  const totalExpenses   = cashflow.reduce((s, r) => s + Number(r.payment ?? 0), 0);
  const netCashflow     = totalRevenue - totalExpenses;
  const totalLoanOutstanding = loans.reduce((s, r) => s + Number(r.outstanding ?? 0), 0);
  const totalLoanPaid        = loans.reduce((s, r) => s + Number(r.paid ?? 0), 0);
  const totalPendingFees     = fees.reduce((s, r) => s + Math.max(0, Number(r.total_fees ?? 0) - Number(r.paid ?? 0)), 0);
  const totalDeptAchieved    = depts.reduce((s, r) => s + Number(r.amount_achieved ?? 0), 0);
  const totalDeptTarget      = depts.reduce((s, r) => s + Number(r.target_amount ?? 0), 0);
  const deptPct              = pct(totalDeptAchieved, totalDeptTarget);
  const pendingDebts         = plans.filter(r => r.status !== 'Paid');
  const overdueDebts         = plans.filter(r => r.status === 'Overdue');

  /* ── Cashflow monthly trend (last 6 months from cashflow data) ── */
  const monthlyMap: Record<string, { receipt: number; payment: number }> = {};
  for (const r of cashflow) {
    const k = r.date ? new Date(r.date).toISOString().slice(0, 7) : 'unknown';
    if (!monthlyMap[k]) monthlyMap[k] = { receipt: 0, payment: 0 };
    monthlyMap[k].receipt += Number(r.receipt ?? 0);
    monthlyMap[k].payment += Number(r.payment ?? 0);
  }
  const trendKeys   = Object.keys(monthlyMap).sort().slice(-6);
  const revenueTrend = trendKeys.map(k => monthlyMap[k].receipt);
  const expenseTrend = trendKeys.map(k => monthlyMap[k].payment);

  return (
    <div className="space-y-5">
      {/* ── Header bar ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-gray-900 tracking-tight">Finance Overview</h2>
          <p className="text-xs text-gray-500 mt-0.5">Live financial metrics across all departments</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Month</label>
          <select value={monthIdx} onChange={e => setMonthIdx(Number(e.target.value))}
            className="text-xs rounded-lg border border-gray-200 bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] font-semibold">
            {MONTHS.map((m, i) => <option key={i} value={i}>{m} {year}</option>)}
          </select>
          <button onClick={load} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors" title="Refresh">
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Pulse key={i} className="h-32" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Total Revenue"
            value={fmt(totalRevenue)}
            sub="Cashflow receipts"
            trend={revenueTrend}
            color="#2E3093"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <KpiCard
            label="Net Cashflow"
            value={fmt(Math.abs(netCashflow))}
            sub={netCashflow >= 0 ? '▲ Surplus' : '▼ Deficit'}
            trend={revenueTrend.map((r, i) => r - (expenseTrend[i] ?? 0))}
            color={netCashflow >= 0 ? '#10b981' : '#ef4444'}
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
          />
          <KpiCard
            label="Loan Outstanding"
            value={fmt(totalLoanOutstanding)}
            sub={`${fmt(totalLoanPaid)} repaid`}
            color="#f59e0b"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>}
          />
          <KpiCard
            label="Pending Fees"
            value={fmt(totalPendingFees)}
            sub={`${fees.length} student${fees.length !== 1 ? 's' : ''}`}
            color="#ef4444"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
          />
        </div>
      )}

      {/* ── Middle row: Dept Performance + Salary KPIs ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Dept Performance */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgb(0,0,0,0.05)] overflow-hidden">
          <SectionHeader
            title={`Dept Performance — ${MONTHS[monthIdx]}`}
            icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
            badge={depts.length}
          />
          <div className="px-5 py-4 space-y-1">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Pulse key={i} className="h-8 mb-2" />)
            ) : depts.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400 italic">No data for {MONTHS[monthIdx]}</p>
            ) : (
              <>
                {depts.map(r => (
                  <BarRow
                    key={r.id}
                    label={r.department}
                    value={Number(r.amount_achieved)}
                    max={Number(r.target_amount) || 1}
                  />
                ))}
                {depts.length > 1 && (
                  <div className="pt-3 mt-1 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DonutGauge value={deptPct} size={52} stroke={5} />
                      <div>
                        <p className={`text-lg font-black tabular-nums ${tone(deptPct).text}`}>{deptPct}%</p>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Overall</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-800">{fmt(totalDeptAchieved)}</p>
                      <p className="text-[11px] text-gray-400">of {fmt(totalDeptTarget)} target</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Salary + Debt Summary */}
        <div className="space-y-4">
          {/* Salary Cashflow */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgb(0,0,0,0.05)] overflow-hidden">
            <SectionHeader
              title="Salary Cashflow"
              icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
            />
            {loading ? (
              <div className="p-4 grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => <Pulse key={i} className="h-14" />)}
              </div>
            ) : (
              <div className="p-4 grid grid-cols-2 gap-2">
                {[
                  { label: 'Total Payable',  value: salary?.total_payable,  color: '#2E3093' },
                  { label: 'Salary Paid',    value: salary?.salary_paid,    color: '#10b981' },
                  { label: 'Salary Pending', value: salary?.salary_pending, color: '#ef4444' },
                  { label: 'Next Payout',    value: salary?.next_payout,    color: '#f59e0b', isDate: true },
                ].map(c => (
                  <div key={c.label} className="rounded-xl bg-gray-50 px-3 py-2.5">
                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">{c.label}</p>
                    <p className="text-base font-black mt-0.5 leading-none" style={{ color: c.color }}>
                      {c.isDate ? (c.value || '—') : fmt(c.value)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Debt overview */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgb(0,0,0,0.05)] overflow-hidden">
            <SectionHeader
              title="Debt Repayment"
              icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
            />
            {loading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Pulse key={i} className="h-8" />)}
              </div>
            ) : plans.length === 0 ? (
              <p className="py-4 px-5 text-xs text-gray-400 italic">No debt plan entries</p>
            ) : (
              <div className="px-5 pb-4 pt-3 space-y-2">
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: 'Total EMI',    value: fmt(plans.reduce((s,r) => s + Number(r.emi_amount ?? 0), 0)), color: '#2E3093' },
                    { label: 'Pending',      value: pendingDebts.length, color: '#f59e0b' },
                    { label: 'Overdue',      value: overdueDebts.length, color: '#ef4444' },
                  ].map(c => (
                    <div key={c.label} className="rounded-xl bg-gray-50 px-2 py-2 text-center">
                      <p className="text-base font-black leading-none" style={{ color: c.color }}>{c.value}</p>
                      <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mt-0.5">{c.label}</p>
                    </div>
                  ))}
                </div>
                {plans.slice(0, 4).map(r => {
                  const p = pct(r.actual_paid, r.emi_amount);
                  const t = tone(p);
                  return (
                    <div key={r.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700 truncate">{r.bank_name}</p>
                        <p className="text-[10px] text-gray-400">{r.planned_date || '—'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${p}%` }} />
                        </div>
                        <span className={`text-[11px] font-bold w-8 text-right tabular-nums ${t.text}`}>{p}%</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                          r.status === 'Paid' ? 'bg-green-100 text-green-700' :
                          r.status === 'Overdue' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'}`}>{r.status}</span>
                      </div>
                    </div>
                  );
                })}
                {plans.length > 4 && (
                  <p className="text-[11px] text-gray-400 text-right">+{plans.length - 4} more entries</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Loan Breakdown ──────────────────────────────────────── */}
      {!loading && loans.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgb(0,0,0,0.05)] overflow-hidden">
          <SectionHeader
            title="Outstanding Loans"
            icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
            badge={loans.length}
          />
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {loans.map(r => {
              const p = pct(r.paid, Number(r.paid) + Number(r.outstanding));
              const t = tone(p);
              return (
                <div key={r.id} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 flex items-center gap-3">
                  <div className="relative shrink-0">
                    <DonutGauge value={p} size={52} stroke={5} />
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-gray-700 rotate-90">{p}%</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{r.bank_name}</p>
                    <p className="text-[11px] text-gray-500">Outstanding: <span className="font-semibold text-gray-700">{fmt(r.outstanding)}</span></p>
                    <p className="text-[11px] text-gray-500">Repaid: <span className={`font-semibold ${t.text}`}>{fmt(r.paid)}</span></p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Pending Fees table ───────────────────────────────────── */}
      {!loading && fees.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgb(0,0,0,0.05)] overflow-hidden">
          <SectionHeader
            title="Pending Fees — Top Dues"
            icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            badge={fees.length}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Batch</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Paid</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Pending</th>
                  <th className="px-5 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fees.slice(0, 8).map(r => {
                  const pending = Math.max(0, Number(r.total_fees) - Number(r.paid));
                  return (
                    <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-2.5 font-medium text-gray-800">{r.student_name}</td>
                      <td className="px-3 py-2.5 text-gray-500">{r.batch}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{fmt(r.total_fees)}</td>
                      <td className="px-3 py-2.5 text-right text-emerald-600 font-semibold">{fmt(r.paid)}</td>
                      <td className="px-3 py-2.5 text-right text-rose-600 font-bold">{fmt(pending)}</td>
                      <td className="px-5 py-2.5 text-right text-gray-500">{r.due_date || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              {fees.length > 8 && (
                <tfoot>
                  <tr><td colSpan={6} className="px-5 py-2 text-[11px] text-gray-400 text-right">+{fees.length - 8} more records in Finance → CBD tab</td></tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── View Full Dashboard link ─────────────────────────────── */}
      <div className="flex justify-end">
        <a href="/dashboard/finance"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2E3093] hover:underline">
          Open Full Finance Dashboard
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  );
}
