'use client';

import { useCallback, useMemo, useState } from 'react';
import { useFinanceResource } from '../shared/useFinanceResource';
import { Modal, TableHeader, TableSkeleton, EmptyRow, RowActions, StatCard, thCls, tdCls, tdNum, inpCls, lblCls, trCls } from '../shared/primitives';
import { fmt, monthLabel, parseMonth, todayISO, isoOffsetDays, fmtDate } from '../shared/format';
import type { DebtPlan, CashflowProjection, Loan, DebtPlanStatus } from '../shared/types';
import DebtByBankPie from '../charts/DebtByBankPie';
import DebtPlanBarChart from '../charts/DebtPlanBarChart';
import CashflowProjectionChart from '../charts/CashflowProjectionChart';
import { loanPayoffEstimates, forecastCashflow } from '../shared/predictions';

const STATUS_OPTIONS: DebtPlanStatus[] = ['Pending', 'Paid', 'Overdue'];

export default function DebtTab() {
  const plans       = useFinanceResource<DebtPlan>('/api/finance/debt-plan');
  const projections = useFinanceResource<CashflowProjection>('/api/finance/cashflow-projection');
  const loans       = useFinanceResource<Loan>('/api/finance/loans');
  const fyMeta = useMemo(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const fyStart = month >= 4 ? now.getFullYear() : now.getFullYear() - 1;
    return {
      fyStart,
      fyEnd: fyStart + 1,
      fyStartDate: `${fyStart}-04-01`,
      fyEndDate: `${fyStart + 1}-03-31`,
      fyLabel: `FY ${fyStart}-${String(fyStart + 1).slice(2)}`,
    };
  }, []);

  /* ── Plan modal ─────────────────────────────────── */
  const [planModal, setPlanModal] = useState<{ open: boolean; editing: DebtPlan | null }>({ open: false, editing: null });
  const [planForm, setPlanForm]   = useState({ bank_name: '', emi_amount: '', planned_date: '', actual_paid: '', actual_date: '', status: 'Pending' as DebtPlanStatus });
  const [savingP, setSavingP]     = useState(false);

  const openAddPlan = useCallback(() => {
    setPlanForm({ bank_name: '', emi_amount: '', planned_date: '', actual_paid: '', actual_date: '', status: 'Pending' });
    setPlanModal({ open: true, editing: null });
  }, []);
  const openEditPlan = useCallback((r: DebtPlan) => {
    setPlanForm({
      bank_name: r.bank_name,
      emi_amount: String(r.emi_amount),
      planned_date: r.planned_date ?? '',
      actual_paid: String(r.actual_paid),
      actual_date: r.actual_date ?? '',
      status: r.status,
    });
    setPlanModal({ open: true, editing: r });
  }, []);
  const savePlan = useCallback(async () => {
    setSavingP(true);
    try {
      await plans.save({
        bank_name:   planForm.bank_name.trim(),
        emi_amount:  Number(planForm.emi_amount),
        planned_date: planForm.planned_date || null,
        actual_paid: Number(planForm.actual_paid),
        actual_date: planForm.actual_date || null,
        status: planForm.status,
      } as Partial<DebtPlan>, planModal.editing);
      setPlanModal({ open: false, editing: null });
    } catch { /* toast */ }
    setSavingP(false);
  }, [plans, planForm, planModal.editing]);

  /* ── Projection modal ───────────────────────────── */
  const [projModal, setProjModal] = useState<{ open: boolean; editing: CashflowProjection | null }>({ open: false, editing: null });
  const [projForm, setProjForm]   = useState({ month: '', revenue: '', expenses: '', loan_repayment: '' });
  const [savingPr, setSavingPr]   = useState(false);

  const openAddProj = useCallback(() => {
    setProjForm({ month: '', revenue: '', expenses: '', loan_repayment: '' });
    setProjModal({ open: true, editing: null });
  }, []);
  const openEditProj = useCallback((r: CashflowProjection) => {
    setProjForm({
      month: parseMonth(r.month),
      revenue: String(r.revenue),
      expenses: String(r.expenses),
      loan_repayment: String(r.loan_repayment),
    });
    setProjModal({ open: true, editing: r });
  }, []);
  const saveProj = useCallback(async () => {
    setSavingPr(true);
    try {
      await projections.save({
        month: projForm.month,
        revenue: Number(projForm.revenue),
        expenses: Number(projForm.expenses),
        loan_repayment: Number(projForm.loan_repayment),
      } as Partial<CashflowProjection>, projModal.editing);
      setProjModal({ open: false, editing: null });
    } catch { /* toast */ }
    setSavingPr(false);
  }, [projections, projForm, projModal.editing]);

  /* ── Memoised widgets ────────────────────────────
     Fix vs old code:
     - "Upcoming Payment (30 days)" now actually filters by planned_date.
     - Variance only computed when there's an actual payment OR plan completed.
  */
  const today = todayISO();
  const in30 = isoOffsetDays(30);

  const widgets = useMemo(() => {
    const upcoming30 = plans.rows
      .filter(r => r.status === 'Pending' && !!r.planned_date && r.planned_date! >= today && r.planned_date! <= in30)
      .reduce((s, r) => s + Number(r.emi_amount || 0), 0);

    const remaining = plans.rows
      .reduce((s, r) => s + Math.max(0, Number(r.emi_amount || 0) - Number(r.actual_paid || 0)), 0);

    const paidCurrentFy = plans.rows
      .filter(r => {
        const paidOn = r.actual_date ?? r.planned_date;
        return !!paidOn && paidOn >= fyMeta.fyStartDate && paidOn <= fyMeta.fyEndDate;
      })
      .reduce((s, r) => s + Number(r.actual_paid || 0), 0);

    return { upcoming30, remaining, paidCurrentFy };
  }, [plans.rows, today, in30, fyMeta.fyEndDate, fyMeta.fyStartDate]);

  const debtRemainingByBank = useMemo(() => {
    return loans.rows
      .map(r => {
        const outstanding = Number(r.outstanding || 0);
        const paid = Number(r.paid || 0);
        const remaining = Math.max(0, outstanding - paid);
        return {
          id: r.id,
          bank_name: r.bank_name,
          outstanding,
          paid,
          remaining,
          share: 0,
        };
      })
      .filter(r => r.outstanding > 0 || r.paid > 0)
      .sort((a, b) => b.remaining - a.remaining);
  }, [loans.rows]);

  const debtRemainingTotal = useMemo(
    () => debtRemainingByBank.reduce((s, r) => s + r.remaining, 0),
    [debtRemainingByBank]
  );

  const sortedPlans = useMemo(() =>
    [...plans.rows].sort((a, b) => (b.planned_date ?? '').localeCompare(a.planned_date ?? '')),
    [plans.rows]
  );

  const sortedProj = useMemo(() =>
    [...projections.rows].sort((a, b) => parseMonth(a.month).localeCompare(parseMonth(b.month))),
    [projections.rows]
  );

  /* ── Predictions ─────────────────────────────────
     loanPayoffs — deterministic amortisation per bank using WMA of EMIs.
     cashflowForecast — Holt / linear regression on past projection data,
       extended 3 months ahead. Only runs when we have ≥2 data points.
  */
  const loanPayoffs = useMemo(
    () => loanPayoffEstimates(loans.rows, plans.rows),
    [loans.rows, plans.rows]
  );

  const cashflowForecast = useMemo(
    () => sortedProj.length >= 2
      ? forecastCashflow(
          sortedProj.map(r => ({
            month:           parseMonth(r.month),
            revenue:         Number(r.revenue),
            expenses:        Number(r.expenses),
            loan_repayment:  Number(r.loan_repayment),
          })),
          3
        )
      : [],
    [sortedProj]
  );

  return (
    <div className="space-y-6">

      {/* ── KPI Summary Cards ────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Upcoming Payment (30 days)" value={fmt(widgets.upcoming30)} accent="text-amber-700" />
        <StatCard label="Total Debt Remaining"        value={fmt(widgets.remaining)}  accent="text-red-600" />
        <StatCard label={`Total Paid (${fyMeta.fyLabel})`} value={fmt(widgets.paidCurrentFy)} accent="text-emerald-700" />
      </div>

      {/* ── Financial Year Badge ─────────────────────── */}
      {(() => {
        return (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2E3093]/10 border border-[#2E3093]/20 text-[11px] font-semibold text-[#2E3093]">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {fyMeta.fyLabel}
            </span>
            <span className="text-[10px] text-gray-400">Apr {fyMeta.fyStart} - Mar {fyMeta.fyEnd}</span>
          </div>
        );
      })()}

      {/* ── Charts side-by-side ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DebtByBankPie loans={loans.rows} />
        <DebtPlanBarChart plans={sortedPlans} />
      </div>

      {/* ── Debt Remaining by Bank ──────────────────── */}
      <div>
        <TableHeader title="Debt Remaining by Bank" />
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-gradient-to-r from-[#2E3093] to-[#3d40a8]">
                <th className={thCls}>Bank Name</th>
                <th className={`${thCls} text-right`}>Outstanding (₹)</th>
                <th className={`${thCls} text-right`}>Paid (₹)</th>
                <th className={`${thCls} text-right`}>Debt Remaining (₹)</th>
                <th className={`${thCls} text-right`}>Share %</th>
              </tr>
            </thead>
            <tbody>
              {loans.loading ? <TableSkeleton cols={5} /> :
               debtRemainingByBank.length === 0 ? <EmptyRow cols={5} message="No bank debt records found." /> :
               debtRemainingByBank.map((r, i) => {
                 const share = debtRemainingTotal > 0 ? (r.remaining / debtRemainingTotal) * 100 : 0;
                 return (
                   <tr key={r.id} className={trCls(i)}>
                     <td className={tdCls}>{r.bank_name}</td>
                     <td className={`${tdNum} text-[#2E3093]`}>{fmt(r.outstanding)}</td>
                     <td className={`${tdNum} text-emerald-700`}>{fmt(r.paid)}</td>
                     <td className={`${tdNum} font-semibold ${r.remaining > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmt(r.remaining)}</td>
                     <td className={tdNum}>{share.toFixed(1)}%</td>
                   </tr>
                 );
               })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Loan Payoff Predictions ───────────────────── */}
      {loanPayoffs.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-700 uppercase tracking-wider">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Payoff Predictions
            </span>
            <span className="text-[10px] text-gray-400">Based on weighted average of historical EMI data</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {loanPayoffs.map(p => (
              <div key={p.bank} className="rounded-xl border border-violet-100 bg-violet-50/40 p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-bold text-gray-800 leading-tight">{p.bank}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    p.confidence === 'high'   ? 'bg-emerald-100 text-emerald-700' :
                    p.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                                               'bg-red-100 text-red-600'
                  }`}>
                    {p.confidence === 'high' ? 'High' : p.confidence === 'medium' ? 'Medium' : 'Low'} conf.
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Estimated payoff</p>
                  <p className="text-sm font-bold text-violet-700">{p.payoffDate}</p>
                  <p className="text-[10px] text-gray-400">~{p.monthsLeft} month{p.monthsLeft !== 1 ? 's' : ''} remaining</p>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-violet-100">
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase tracking-wide">Remaining</p>
                    <p className="text-[11px] font-semibold text-red-600">{fmt(p.remaining)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase tracking-wide">Avg EMI / mo</p>
                    <p className="text-[11px] font-semibold text-gray-700">{fmt(Math.round(p.avgMonthlyEmi))}</p>
                  </div>
                </div>
                <p className="text-[9px] text-gray-400">Based on {p.sampleSize} EMI record{p.sampleSize !== 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Debt Plan vs Actual Table ─────────────────── */}
      <div>
        <TableHeader title="Debt Plan vs Actual" onAdd={openAddPlan} />
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-gradient-to-r from-[#2E3093] to-[#3d40a8]">
                <th className={thCls}>Bank Name</th>
                <th className={`${thCls} text-right`}>EMI Amount (₹)</th>
                <th className={`${thCls} text-center`}>Planned Date</th>
                <th className={`${thCls} text-right`}>Actual Paid (₹)</th>
                <th className={`${thCls} text-center`}>Actual Date</th>
                <th className={`${thCls} text-right`}>Variance (₹)</th>
                <th className={`${thCls} text-center`}>Status</th>
                <th className={`${thCls} text-center`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.loading ? <TableSkeleton cols={8} /> :
               sortedPlans.length === 0 ? <EmptyRow cols={8} /> :
               sortedPlans.map((r, i) => {
                 const hasActual = Number(r.actual_paid) > 0 || r.status === 'Paid';
                 const variance  = hasActual ? Number(r.actual_paid) - Number(r.emi_amount) : null;
                 const rowCls = r.status === 'Overdue'
                   ? 'bg-red-50/80 hover:bg-red-50 transition-colors'
                   : r.status === 'Paid'
                   ? 'bg-emerald-50/50 hover:bg-emerald-50/80 transition-colors'
                   : trCls(i);
                 return (
                   <tr key={r.id} className={rowCls}>
                     <td className={tdCls}>
                       <span className="font-medium text-gray-800">{r.bank_name}</span>
                     </td>
                     <td className="px-3 py-2.5 text-xs text-right font-medium text-gray-700">{fmt(r.emi_amount)}</td>
                     <td className={`${tdNum} text-gray-500`}>{fmtDate(r.planned_date)}</td>
                     <td className="px-3 py-2.5 text-xs text-right font-medium text-gray-700">{fmt(r.actual_paid)}</td>
                     <td className={`${tdNum} text-gray-500`}>{fmtDate(r.actual_date)}</td>
                     <td className={`px-3 py-2.5 text-xs text-right font-semibold ${
                       variance == null ? 'text-gray-400'
                       : variance < 0 ? 'text-red-600'
                       : 'text-emerald-700'
                     }`}>
                       {variance == null ? '—' : (variance >= 0 ? '+' : '') + fmt(variance)}
                     </td>
                     <td className={tdNum}>
                       <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                         r.status === 'Paid'    ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' :
                         r.status === 'Overdue' ? 'bg-red-100 text-red-700 ring-1 ring-red-200' :
                                                  'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
                       }`}>
                         <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                           r.status === 'Paid' ? 'bg-emerald-500' :
                           r.status === 'Overdue' ? 'bg-red-500' : 'bg-amber-500'
                         }`} />
                         {r.status}
                       </span>
                     </td>
                     <RowActions onEdit={() => openEditPlan(r)} onDelete={() => plans.remove(r.id)} />
                   </tr>
                 );
               })}
            </tbody>
          </table>
        </div>
        {/* Legend */}
        {sortedPlans.length > 0 && (
          <div className="flex items-center gap-4 mt-2 px-1">
            <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <span className="w-3 h-3 rounded-sm bg-emerald-100 ring-1 ring-emerald-200" />Paid
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <span className="w-3 h-3 rounded-sm bg-amber-100 ring-1 ring-amber-200" />Pending
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <span className="w-3 h-3 rounded-sm bg-red-100 ring-1 ring-red-200" />Overdue
            </span>
          </div>
        )}
      </div>

      {/* ── Cashflow Projections ─────────────────────── */}
      <div className="space-y-4">
        <CashflowProjectionChart projections={projections.rows} forecast={cashflowForecast} />

        <div>
          <TableHeader title="Projected Cashflow — Upcoming Months" onAdd={openAddProj} />
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-gradient-to-r from-[#2E3093] to-[#3d40a8]">
                  <th className={thCls}>Month</th>
                  <th className={`${thCls} text-right`}>Projected Revenue (₹)</th>
                  <th className={`${thCls} text-right`}>Projected Expenses (₹)</th>
                  <th className={`${thCls} text-right`}>Loan Repayment (₹)</th>
                  <th className={`${thCls} text-right`}>Net Cashflow (₹)</th>
                  <th className={`${thCls} text-center`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projections.loading ? <TableSkeleton cols={6} /> :
                 sortedProj.length === 0 ? <EmptyRow cols={6} /> :
                 sortedProj.map((r, i) => {
                   const net = Number(r.revenue) - Number(r.expenses) - Number(r.loan_repayment);
                   return (
                     <tr key={r.id} className={net < 0
                       ? 'bg-red-50/40 hover:bg-red-50/70 transition-colors'
                       : trCls(i)
                     }>
                       <td className={`${tdCls} font-medium text-gray-800`}>{monthLabel(parseMonth(r.month))}</td>
                       <td className="px-3 py-2.5 text-xs text-right text-[#2E3093] font-medium">{fmt(r.revenue)}</td>
                       <td className="px-3 py-2.5 text-xs text-right text-red-600">{fmt(r.expenses)}</td>
                       <td className="px-3 py-2.5 text-xs text-right text-amber-700">{fmt(r.loan_repayment)}</td>
                       <td className={`px-3 py-2.5 text-xs text-right font-bold ${net < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                         {net >= 0 ? '+' : ''}{fmt(net)}
                       </td>
                       <RowActions onEdit={() => openEditProj(r)} onDelete={() => projections.remove(r.id)} />
                     </tr>
                   );
                 })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────── */}
      <Modal
        open={planModal.open}
        title={planModal.editing ? 'Edit Debt Plan Record' : 'Add Debt Plan Record'}
        saving={savingP}
        onClose={() => setPlanModal({ open: false, editing: null })}
        onSave={savePlan}
      >
        <div><label className={lblCls}>Bank Name</label>
          <select className={inpCls} value={planForm.bank_name} onChange={e => setPlanForm(f => ({ ...f, bank_name: e.target.value }))}>
            <option value="">— Select bank —</option>
            {loans.rows.map(l => (
              <option key={l.id} value={l.bank_name}>{l.bank_name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>EMI Amount (₹)</label><input type="number" min="0" className={inpCls} value={planForm.emi_amount} onChange={e => setPlanForm(f => ({ ...f, emi_amount: e.target.value }))} /></div>
          <div><label className={lblCls}>Planned Date</label><input type="date" className={inpCls} value={planForm.planned_date} onChange={e => setPlanForm(f => ({ ...f, planned_date: e.target.value }))} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Actual Paid (₹)</label><input type="number" min="0" className={inpCls} value={planForm.actual_paid} onChange={e => setPlanForm(f => ({ ...f, actual_paid: e.target.value }))} /></div>
          <div><label className={lblCls}>Actual Date</label><input type="date" className={inpCls} value={planForm.actual_date} onChange={e => setPlanForm(f => ({ ...f, actual_date: e.target.value }))} /></div>
        </div>
        <div><label className={lblCls}>Status</label>
          <select className={inpCls} value={planForm.status} onChange={e => setPlanForm(f => ({ ...f, status: e.target.value as DebtPlanStatus }))}>
            {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </Modal>

      <Modal
        open={projModal.open}
        title={projModal.editing ? 'Edit Projection' : 'Add Projection'}
        saving={savingPr}
        onClose={() => setProjModal({ open: false, editing: null })}
        onSave={saveProj}
      >
        <div><label className={lblCls}>Month</label><input type="month" className={inpCls} value={projForm.month} onChange={e => setProjForm(f => ({ ...f, month: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Projected Revenue (₹)</label><input type="number" min="0" className={inpCls} value={projForm.revenue} onChange={e => setProjForm(f => ({ ...f, revenue: e.target.value }))} /></div>
          <div><label className={lblCls}>Projected Expenses (₹)</label><input type="number" min="0" className={inpCls} value={projForm.expenses} onChange={e => setProjForm(f => ({ ...f, expenses: e.target.value }))} /></div>
        </div>
        <div><label className={lblCls}>Loan Repayment (₹)</label><input type="number" min="0" className={inpCls} value={projForm.loan_repayment} onChange={e => setProjForm(f => ({ ...f, loan_repayment: e.target.value }))} /></div>
      </Modal>
    </div>
  );
}
