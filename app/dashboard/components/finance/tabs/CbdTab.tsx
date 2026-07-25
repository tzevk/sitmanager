'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TableHeader, TableSkeleton, EmptyRow, TotalRow, SectionTitle, thCls, tdCls, tdNum, trCls, PctBar, downloadCsv, Modal, RowActions, inpCls, lblCls } from '../shared/primitives';
import { fmt, todayISO, monthLabel, parseMonth, isCountableCashflow, monthsInFinancialYear, financialYearLabel } from '../shared/format';
import type { PendingFee, MonthlyRow, CashflowTxn } from '../shared/types';
import { useFinanceResource } from '../shared/useFinanceResource';
import { feeRecoveryPriority } from '../shared/predictions';

// Same figures as the Overview tab's Department-wise Breakdown, kept in sync
// so both views agree on what CBD is being measured against.
const CBD_MONTHLY_INCOME = 5_600_000; // ₹56,00,000
const CBD_EXPENSE_TARGET_PCT = 0.20;  // target expense = 20% of actual turnover

interface PlanRow {
  Plan_Id: number;
  Training_Program_Name: string;
  Target_Frequency: number;
  Min_Students_Per_Batch: number;
  Students_Admitted: number;
  Yearly_Students_Target: number;
  Frequency_Conducted: number;
  Percentage: number;
  Fees: number;
}

export default function CbdTab() {
  /* ── Annual targets (read-only from CBD dashboard masters) ── */
  // /api/masters/annual-batch/plan's `year` param is already a financial-year
  // start year (Apr–Mar) under the hood, so Jan–Mar belongs to the FY that
  // started the previous calendar year.
  const now = new Date();
  const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const [year, setYear] = useState(currentYear);
  const [annualTargets, setAnnualTargets] = useState<PlanRow[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(true);

  const loadTargets = useCallback(async (y: number) => {
    setTargetsLoading(true);
    try {
      const res = await fetch(`/api/masters/annual-batch/plan?year=${y}`, { cache: 'no-store' });
      if (res.ok) {
        const all: PlanRow[] = (await res.json()).rows ?? [];
        setAnnualTargets(all.filter(r =>
          Number(r.Yearly_Students_Target) > 0 ||
          (Number(r.Target_Frequency) > 0 && Number(r.Min_Students_Per_Batch) > 0)
        ));
      } else {
        setAnnualTargets([]);
      }
    } finally {
      setTargetsLoading(false);
    }
  }, []);

  useEffect(() => { loadTargets(year); }, [loadTargets, year]);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  /* ── Pending Fees (read-only live from admission_master + s_fees_mst) ── */
  const [feeRows, setFeeRows]       = useState<PendingFee[]>([]);
  const [feesLoading, setFeesLoading] = useState(true);
  const [feeSearch, setFeeSearch]   = useState('');
  // Grand totals across every matching student — the API computes these
  // separately from the (capped at 300) `rows` list, since summing only the
  // fetched page silently understated "Total" whenever more than 300 students
  // had a pending balance.
  const [feeApiTotals, setFeeApiTotals] = useState({ totalCount: 0, totalFees: 0, totalPaid: 0, totalPending: 0, truncated: false });

  const loadFees = useCallback(async (q: string) => {
    setFeesLoading(true);
    try {
      const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
      const res = await fetch(`/api/finance/pending-fees-live${params}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setFeeRows(data.rows ?? []);
        setFeeApiTotals({
          totalCount: Number(data.totalCount ?? 0),
          totalFees: Number(data.totalFees ?? 0),
          totalPaid: Number(data.totalPaid ?? 0),
          totalPending: Number(data.totalPending ?? 0),
          truncated: Boolean(data.truncated),
        });
      } else {
        setFeeRows([]);
        setFeeApiTotals({ totalCount: 0, totalFees: 0, totalPaid: 0, totalPending: 0, truncated: false });
      }
    } finally {
      setFeesLoading(false);
    }
  }, []);

  useEffect(() => { loadFees(''); }, [loadFees]);

  /* debounce search — refetch after 400 ms of inactivity */
  useEffect(() => {
    const t = setTimeout(() => loadFees(feeSearch), 400);
    return () => clearTimeout(t);
  }, [feeSearch, loadFees]);

  const today = todayISO();

  /* ── Monthly Performance ── */
  const monthly  = useFinanceResource<MonthlyRow>('/api/finance/cbd-monthly');
  const cashflow = useFinanceResource<CashflowTxn>('/api/finance/cashflow');

  /** CBD's real turnover (receipts) and expense (payments) per month, from cashflow. */
  const cfByMonth = useMemo(() => {
    const turnover = new Map<string, number>();
    const expense = new Map<string, number>();
    for (const txn of cashflow.rows) {
      if ((txn.department ?? '').toUpperCase() !== 'CBD') continue;
      if (!txn.date || !isCountableCashflow(txn)) continue;
      const m = txn.date.substring(0, 7);
      if (txn.type === 'Receipt') turnover.set(m, (turnover.get(m) || 0) + Number(txn.receipt || 0));
      if (txn.type === 'Payment') expense.set(m, (expense.get(m) || 0) + Number(txn.payment || 0));
    }
    return { turnover, expense };
  }, [cashflow.rows]);

  const monthlyTargetOverrides = useMemo(() => {
    const map = new Map<string, MonthlyRow>();
    for (const r of monthly.rows) map.set((r.month ?? '').slice(0, 7), r);
    return map;
  }, [monthly.rows]);

  // Every month of the financial year, shown at once — not one row per
  // manual entry, so a month with no manual override still shows real
  // cashflow-derived actuals instead of disappearing.
  const monthlyBreakdown = useMemo(() => {
    return monthsInFinancialYear(year).map(m => {
      const turnoverActual = cfByMonth.turnover.get(m) || 0;
      const expenseActual  = cfByMonth.expense.get(m) || 0;
      const override = monthlyTargetOverrides.get(m);
      const expenseTarget = override ? Number(override.target_cost || 0) : turnoverActual * CBD_EXPENSE_TARGET_PCT;
      const turnoverTarget = CBD_MONTHLY_INCOME;
      const profitActual = turnoverActual - expenseActual;
      const profitTarget = turnoverTarget - expenseTarget;
      return {
        month: m,
        turnoverActual, turnoverTarget,
        expenseActual, expenseTarget,
        profitActual, profitTarget,
        profitPctActual: turnoverActual > 0 ? (profitActual / turnoverActual) * 100 : null,
        profitPctTarget: turnoverTarget > 0 ? (profitTarget / turnoverTarget) * 100 : null,
        override,
      };
    });
  }, [year, cfByMonth, monthlyTargetOverrides]);

  const [monthlyModal, setMonthlyModal] = useState<{ open: boolean; editing: MonthlyRow | null }>({ open: false, editing: null });
  const [monthlyForm, setMonthlyForm]   = useState({ month: '', target_cost: '' });
  const [monthlySaving, setMonthlySaving] = useState(false);

  // Every month already has a row (see monthlyBreakdown) — "editing" a month
  // just means setting/clearing its manual Expense Target override.
  const openSetExpenseTarget = useCallback((month: string, override?: MonthlyRow) => {
    setMonthlyForm({ month, target_cost: override ? String(override.target_cost ?? 0) : '' });
    setMonthlyModal({ open: true, editing: override ?? null });
  }, []);

  const saveMonthly = useCallback(async () => {
    setMonthlySaving(true);
    try {
      // Blank input means "use the default" — clear any existing override
      // instead of saving a literal ₹0 target.
      if (!monthlyForm.target_cost.trim()) {
        if (monthlyModal.editing) await monthly.remove(monthlyModal.editing.id);
      } else {
        await monthly.save(
          { month: monthlyForm.month.trim(), target_cost: Number(monthlyForm.target_cost) } as Partial<MonthlyRow>,
          monthlyModal.editing,
        );
      }
      setMonthlyModal({ open: false, editing: null });
    } catch { /* swallow */ }
    setMonthlySaving(false);
  }, [monthly, monthlyForm, monthlyModal.editing]);

  const exportFees = useCallback(() => {
    downloadCsv(`pending-fees-${today}.csv`, feeRows.map(r => ({
      Student: r.student_name,
      'Batch / Programme': r.batch,
      'Total Fees': r.total_fees,
      Paid: r.paid,
      Pending: Math.max(0, Number(r.total_fees) - Number(r.paid)),
    })));
  }, [feeRows, today]);

  const priorityMap = useMemo(() => {
    const items = feeRecoveryPriority(feeRows, today);
    return new Map(items.map(item => [(item.row as PendingFee).id, item]));
  }, [feeRows, today]);

  const feeTotals = {
    total:   feeApiTotals.totalFees,
    paid:    feeApiTotals.totalPaid,
    pending: feeApiTotals.totalPending,
  };

  return (
    <div className="space-y-6">
      {/* ── Yearly Performance ────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionTitle>CBD / Inhouse Training — Yearly Performance</SectionTitle>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="text-xs font-semibold rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
          >
            {years.map(y => <option key={y} value={y}>{financialYearLabel(y)}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-separate border-spacing-0">
            <thead><tr className="bg-[#2E3093]">
              <th className={thCls}>Training Programme</th>
              <th className={`${thCls} text-center`}>Target Freq.</th>
              <th className={`${thCls} text-center`}>Freq. Conducted</th>
              <th className={`${thCls} text-center`}>Target Students</th>
              <th className={`${thCls} text-center`}>Students Admitted</th>
              <th className={`${thCls} text-center`}>Fees (₹)</th>
              <th className={`${thCls} text-center`}>Target Fees (₹)</th>
              <th className={`${thCls} text-center`}>Fees Received (₹)</th>
              <th className={`${thCls} text-center`}>% Achievement</th>
            </tr></thead>
            <tbody>
              {targetsLoading ? <TableSkeleton cols={9} /> :
               annualTargets.length === 0 ? <EmptyRow cols={9} message={`No annual targets found for ${financialYearLabel(year)}.`} /> :
               <>
                 <TotalRow>
                   <td className="px-3 py-2 text-xs text-[#2E3093]">Total ({annualTargets.length})</td>
                   <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{annualTargets.reduce((s, r) => s + Number(r.Target_Frequency), 0)}</td>
                   <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{annualTargets.reduce((s, r) => s + Number(r.Frequency_Conducted), 0)}</td>
                   <td className="px-3 py-2 text-xs text-center text-[#2E3093]">
                     {annualTargets.reduce((s, r) => s + (Number(r.Yearly_Students_Target) || (Number(r.Target_Frequency) * Number(r.Min_Students_Per_Batch))), 0).toLocaleString('en-IN')}
                   </td>
                   <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{annualTargets.reduce((s, r) => s + Number(r.Students_Admitted), 0).toLocaleString('en-IN')}</td>
                   <td />
                   <td className="px-3 py-2 text-xs text-center text-[#2E3093]">
                     {fmt(annualTargets.reduce((s, r) => {
                       const tgt = Number(r.Yearly_Students_Target) || (Number(r.Target_Frequency) * Number(r.Min_Students_Per_Batch));
                       return s + (Number(r.Fees) * tgt);
                     }, 0))}
                   </td>
                   <td className="px-3 py-2 text-xs text-center text-[#2E3093]">
                     {fmt(annualTargets.reduce((s, r) => s + (Number(r.Fees) * Number(r.Students_Admitted)), 0))}
                   </td>
                   <td className="px-3 py-2 text-xs text-center text-[#2E3093]">
                     {(() => {
                       const totalTarget = annualTargets.reduce((s, r) => s + (Number(r.Yearly_Students_Target) || (Number(r.Target_Frequency) * Number(r.Min_Students_Per_Batch))), 0);
                       const totalAdmitted = annualTargets.reduce((s, r) => s + Number(r.Students_Admitted), 0);
                       return totalTarget > 0 ? `${((totalAdmitted / totalTarget) * 100).toFixed(1)}%` : '—';
                     })()}
                   </td>
                 </TotalRow>
                 {annualTargets.map((r, i) => {
                  const tgt          = Number(r.Yearly_Students_Target) || (Number(r.Target_Frequency) * Number(r.Min_Students_Per_Batch));
                  const adm          = Number(r.Students_Admitted) || 0;
                  const fees         = Number(r.Fees) || 0;
                  const feesTarget   = fees * tgt;
                  const feesReceived = fees * adm;
                  const pct          = Number(r.Percentage) || (tgt > 0 ? (adm / tgt) * 100 : 0);
                  return (
                    <tr key={r.Plan_Id} className={trCls(i)}>
                      <td className={tdCls}>{r.Training_Program_Name}</td>
                      <td className={tdNum}>{r.Target_Frequency}</td>
                      <td className={tdNum}>{r.Frequency_Conducted}</td>
                      <td className={tdNum}>{tgt.toLocaleString('en-IN')}</td>
                      <td className={tdNum}>{adm.toLocaleString('en-IN')}</td>
                      <td className={tdNum}>{fees ? fmt(fees) : '—'}</td>
                      <td className={tdNum}>{feesTarget ? fmt(feesTarget) : '—'}</td>
                      <td className={tdNum}>{feesReceived ? fmt(feesReceived) : '—'}</td>
                      <td className={tdNum}><PctBar value={pct} denominator={100} /></td>
                    </tr>
                  );
                 })}
               </>
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Monthly Performance ──────────────────────── */}
      <div>
        <TableHeader title={`CBD / Inhouse — Monthly Performance (${financialYearLabel(year)})`} />
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-[#2E3093]">
                <th rowSpan={2} className={`${thCls} !text-center`}>Month</th>
                <th colSpan={2} className={`${thCls} !text-center`}>Turnover (₹)</th>
                <th colSpan={2} className={`${thCls} !text-center`}>Expense (₹)</th>
                <th colSpan={2} className={`${thCls} !text-center`}>Profit (₹)</th>
                <th colSpan={2} className={`${thCls} !text-center`}>Profit %</th>
                <th rowSpan={2} className={`${thCls} !text-center`}>Actions</th>
              </tr>
              <tr className="bg-[#2E3093]">
                <th className={`${thCls} !text-center`}>Actual</th>
                <th className={`${thCls} !text-center`}>Target</th>
                <th className={`${thCls} !text-center`}>Actual</th>
                <th className={`${thCls} !text-center`}>Target</th>
                <th className={`${thCls} !text-center`}>Actual</th>
                <th className={`${thCls} !text-center`}>Target</th>
                <th className={`${thCls} !text-center`}>Actual</th>
                <th className={`${thCls} !text-center`}>Target</th>
              </tr>
            </thead>
            <tbody>
              {monthly.loading || cashflow.loading ? <TableSkeleton cols={10} /> :
               monthlyBreakdown.map((r, i) => (
                 <tr key={r.month} className={trCls(i)}>
                   <td className={tdCls}>{monthLabel(parseMonth(r.month))}</td>
                   <td className={`${tdNum} text-[#2E3093]`}>{fmt(r.turnoverActual)}</td>
                   <td className={tdNum}>{fmt(r.turnoverTarget)}</td>
                   <td className={`${tdNum} text-red-600`}>{fmt(r.expenseActual)}</td>
                   <td className={tdNum}>{fmt(r.expenseTarget)}{r.override ? <span className="ml-1 text-[9px] text-amber-600 font-semibold" title="Manually overridden">•</span> : null}</td>
                   <td className={`${tdNum} font-semibold ${r.profitActual < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmt(r.profitActual)}</td>
                   <td className={`${tdNum} font-semibold ${r.profitTarget < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmt(r.profitTarget)}</td>
                   <td className={`${tdNum} font-semibold ${(r.profitPctActual ?? 0) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{r.profitPctActual != null ? `${r.profitPctActual.toFixed(1)}%` : '—'}</td>
                   <td className={`${tdNum} font-semibold ${(r.profitPctTarget ?? 0) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{r.profitPctTarget != null ? `${r.profitPctTarget.toFixed(1)}%` : '—'}</td>
                   <RowActions
                     onEdit={() => openSetExpenseTarget(r.month, r.override)}
                     onDelete={r.override ? () => monthly.remove(r.override!.id) : undefined}
                   />
                 </tr>
               ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={monthlyModal.open}
        title={`Set Expense Target — ${monthlyForm.month ? monthLabel(monthlyForm.month) : ''}`}
        saving={monthlySaving}
        onClose={() => setMonthlyModal({ open: false, editing: null })}
        onSave={saveMonthly}
      >
        <div>
          <label className={lblCls}>Expense Target (₹)</label>
          <p className="text-[11px] text-gray-400 mb-1">
            Leave blank to use the default (20% of that month&apos;s actual turnover).
          </p>
          <input
            type="number"
            min="0"
            className={inpCls}
            value={monthlyForm.target_cost}
            onChange={e => setMonthlyForm(f => ({ ...f, target_cost: e.target.value }))}
          />
        </div>
      </Modal>

      {/* ── Pending Fees ──────────────────────────────── */}
      <div>
        <TableHeader
          title="Pending Fees"
          extra={
            <>
              <input
                type="text"
                placeholder="Search student, batch, course…"
                value={feeSearch}
                onChange={e => setFeeSearch(e.target.value)}
                className="text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 w-52 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
              />
              <button
                onClick={exportFees}
                disabled={feeRows.length === 0}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Export
              </button>
            </>
          }
        />
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-separate border-spacing-0">
            <thead><tr className="bg-[#2E3093]">
              <th className={thCls}>Student Name</th>
              <th className={thCls}>Batch / Programme</th>
              <th className={`${thCls} text-center`}>Total Fees (₹)</th>
              <th className={`${thCls} text-center`}>Paid (₹)</th>
              <th className={`${thCls} text-center`}>Pending (₹)</th>
              <th className={`${thCls} text-center`}>Recovery Priority</th>
            </tr></thead>
            <tbody>
              {feesLoading ? <TableSkeleton cols={6} /> :
               feeRows.length === 0 ? <EmptyRow cols={6} message="No pending fees found." /> :
               feeRows.map((r, i) => {
                 const pending = Math.max(0, Number(r.total_fees) - Number(r.paid));
                 const pri = priorityMap.get(r.id);
                 return (
                   <tr key={r.id} className={trCls(i)}>
                     <td className={tdCls}>{r.student_name}</td>
                     <td className={tdCls}>{r.batch}</td>
                     <td className={tdNum}>{fmt(r.total_fees)}</td>
                     <td className={tdNum}>{fmt(r.paid)}</td>
                     <td className={`${tdNum} text-red-600 font-medium`}>{fmt(pending)}</td>
                     <td className={tdNum}>
                       {pri ? (
                         <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                           pri.priority === 'HIGH'   ? 'bg-red-100 text-red-700 ring-1 ring-red-200' :
                           pri.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' :
                                                       'bg-gray-100 text-gray-500'
                         }`}>
                           {pri.priority === 'HIGH' ? '⚠️' : pri.priority === 'MEDIUM' ? '●' : ''} {pri.priority}
                         </span>
                       ) : <span className="text-[10px] text-gray-400">—</span>}
                     </td>
                   </tr>
                 );
               })}
              {feeRows.length > 0 && (
                <TotalRow>
                  <td colSpan={2} className="px-3 py-2 text-xs text-[#2E3093]">
                    Total ({feeApiTotals.totalCount})
                    {feeApiTotals.truncated && (
                      <span className="ml-1 text-[10px] font-normal text-gray-400">
                        — showing top {feeRows.length} by amount
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{fmt(feeTotals.total)}</td>
                  <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{fmt(feeTotals.paid)}</td>
                  <td className="px-3 py-2 text-xs text-center text-red-600">{fmt(feeTotals.pending)}</td>
                  <td />
                </TotalRow>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
