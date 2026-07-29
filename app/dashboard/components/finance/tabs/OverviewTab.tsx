'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFinanceResource } from '../shared/useFinanceResource';
import { Modal, TableHeader, TableSkeleton, EmptyRow, RowActions, TotalRow, SectionTitle, StatCard, thCls, tdCls, tdNum, inpCls, lblCls, trCls, PctBar } from '../shared/primitives';
import {
  fmt, pct, MONTHS_FULL, parseMonth, fmtDate, todayISO, isCountableCashflow,
  buildYearOptions, isFinancialYearValue, monthsInFinancialYear, financialYearLabel,
} from '../shared/format';
import type { Loan, DeptPerf, DebtPlan, CtRow, MonthlyRow, CashflowTxn, PendingInvoice, SalaryCashflow } from '../shared/types';

const TARGET_EXPENSE_PCT: Record<string, number> = {
  cbd: 0.70,
  deputation: 0.80,
  corporate: 0.50,
  accentProjects: 0.80,
};

const TARGET_PROFIT_PCT: Record<string, number> = {
  cbd: 0.30,
  deputation: 0.15,
  corporate: 0.40,
  accentProjects: 0.20,
};

// Hardcoded CBD income targets
const CBD_MONTHLY_INCOME = 5_621_667;   // ₹56,21,667
const CBD_YEARLY_INCOME  = 67_460_000;  // ₹6,74,60,000

// Hardcoded Corporate Training income targets
const CORPORATE_MONTHLY_INCOME = 2_500_000;  // ₹25,00,000
const CORPORATE_YEARLY_INCOME  = 30_000_000; // ₹3,00,00,000

// Hardcoded Deputation target turnover
const DEPUTATION_MONTHLY_TARGET = 2_083_333;  // ₹20,83,333
const DEPUTATION_YEARLY_TARGET  = 25_000_000; // ₹2,50,00,000

// Hardcoded Accent Projects target turnover
const ACCENT_PROJECTS_MONTHLY_TARGET = 8_333_333;   // ₹83,33,333
const ACCENT_PROJECTS_YEARLY_TARGET  = 100_000_000; // ₹10,00,00,000

export default function OverviewTab() {
  const now = new Date();
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const [yearValue, setYearValue] = useState(String(now.getFullYear()));
  const currentYear = now.getFullYear();
  const { calendar: calendarYearOptions, financial: financialYearOptions } = useMemo(
    () => buildYearOptions(currentYear), [currentYear]
  );
  const isFY = isFinancialYearValue(yearValue);
  // Single month ("2026-04") when a calendar year is picked, or every month
  // in the financial year (1 Apr – 31 Mar) when an FY is picked.
  const activeMonths = useMemo(() => (
    isFY ? monthsInFinancialYear(Number(yearValue.slice(2))) : [`${yearValue}-${String(monthIdx + 1).padStart(2, '0')}`]
  ), [isFY, yearValue, monthIdx]);
  const monthYear = activeMonths[0];
  const periodLabel = isFY ? financialYearLabel(Number(yearValue.slice(2))) : `${MONTHS_FULL[monthIdx]} ${yearValue}`;

  // In FY mode the server can only filter on one exact month, so fetch everything
  // and narrow to activeMonths client-side instead.
  const depts  = useFinanceResource<DeptPerf>('/api/finance/dept-performance', isFY ? {} : { query: `month_year=${monthYear}` });
  const loans  = useFinanceResource<Loan>('/api/finance/loans');
  const debtPlans = useFinanceResource<DebtPlan>('/api/finance/debt-plan');
  const ctPerf = useFinanceResource<CtRow>('/api/finance/ct-performance');
  const deputation = useFinanceResource<MonthlyRow>('/api/finance/deputation');
  const projects = useFinanceResource<MonthlyRow>('/api/finance/projects');
  const cashflow = useFinanceResource<CashflowTxn>('/api/finance/cashflow');
  const pendingInvoices = useFinanceResource<PendingInvoice>('/api/finance/pending-invoices');

  const [salaryData, setSalaryData] = useState<SalaryCashflow | null>(null);
  useEffect(() => {
    const my = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    fetch(`/api/finance/salary-cashflow?month_year=${my}`)
      .then(r => r.json())
      .then(d => setSalaryData(d.row ?? null))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpis = useMemo(() => {
    const countableRows = cashflow.rows.filter(isCountableCashflow);
    const totalReceipts = countableRows.reduce((s, r) => s + Number(r.receipt || 0), 0);
    const totalPayments = countableRows.reduce((s, r) => s + Number(r.payment || 0), 0);
    const totalCash = totalReceipts - totalPayments;

    const today = todayISO();
    const upcomingEmi = [...debtPlans.rows]
      .filter(r => r.status === 'Pending' && !!r.planned_date && r.planned_date >= today)
      .sort((a, b) => (a.planned_date ?? '').localeCompare(b.planned_date ?? ''))[0] ?? null;

    const totalReceivables = pendingInvoices.rows
      .filter(r => r.status !== 'Paid')
      .reduce((s, r) => s + Number(r.amount || 0), 0);

    return { totalCash, upcomingEmi, totalReceivables };
  }, [cashflow.rows, debtPlans.rows, pendingInvoices.rows]);

  /** Cashflow receipts (turnover) and payments (expense) per department per month (YYYY-MM). */
  const cashflowByDeptMonth = useMemo(() => {
    const turnover = new Map<string, number>();
    const expense = new Map<string, number>();
    for (const txn of cashflow.rows) {
      if (!txn.date || !txn.department) continue;
      if (!isCountableCashflow(txn)) continue;
      const key = `${(txn.department).toUpperCase()}::${txn.date.substring(0, 7)}`;
      if (txn.type === 'Receipt') turnover.set(key, (turnover.get(key) || 0) + Number(txn.receipt || 0));
      if (txn.type === 'Payment') expense.set(key, (expense.get(key) || 0) + Number(txn.payment || 0));
    }
    return { turnover, expense };
  }, [cashflow.rows]);
  const [loanModal, setLoanModal] = useState<{ open: boolean; editing: Loan | null }>({ open: false, editing: null });
  const [loanForm, setLoanForm]   = useState({ bank_name: '', outstanding: '', paid: '' });
  const [savingL, setSavingL]     = useState(false);

  const openAddLoan = useCallback(() => {
    setLoanForm({ bank_name: '', outstanding: '', paid: '' });
    setLoanModal({ open: true, editing: null });
  }, []);
  const openEditLoan = useCallback((r: Loan) => {
    setLoanForm({ bank_name: r.bank_name, outstanding: String(r.outstanding), paid: String(r.paid) });
    setLoanModal({ open: true, editing: r });
  }, []);
  const saveLoan = useCallback(async () => {
    setSavingL(true);
    try {
      await loans.save({
        bank_name: loanForm.bank_name.trim(),
        outstanding: Number(loanForm.outstanding),
        paid: Number(loanForm.paid),
      } as Partial<Loan>, loanModal.editing);
      setLoanModal({ open: false, editing: null });
    } catch { /* toast */ }
    setSavingL(false);
  }, [loans, loanForm, loanModal.editing]);

  /* ── memoised totals ────────────────────────────────────── */
  const paidByBankFromDebtPlans = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of debtPlans.rows) {
      const bank = (row.bank_name || '').trim().toLowerCase();
      if (!bank) continue;
      totals.set(bank, (totals.get(bank) || 0) + Number(row.actual_paid || 0));
    }
    return totals;
  }, [debtPlans.rows]);

  const deptBreakdown = useMemo(() => {
    const base = {
      cbd: { key: 'cbd', label: 'CBD', turnoverActual: 0, turnoverTarget: 0, expenseActual: 0, expenseTarget: 0 },
      deputation: { key: 'deputation', label: 'Deputation', turnoverActual: 0, turnoverTarget: 0, expenseActual: 0, expenseTarget: 0 },
      corporate: { key: 'corporate', label: 'Corporate Training', turnoverActual: 0, turnoverTarget: 0, expenseActual: 0, expenseTarget: 0 },
      accentProjects: { key: 'accentProjects', label: 'Accent Projects', turnoverActual: 0, turnoverTarget: 0, expenseActual: 0, expenseTarget: 0 },
      other: { key: 'other', label: 'Other Departments', turnoverActual: 0, turnoverTarget: 0, expenseActual: 0, expenseTarget: 0 },
    };

    for (const r of depts.rows) {
      if (!activeMonths.includes(parseMonth(r.month_year))) continue;
      const dept = (r.department || '').toLowerCase();
      const amountActual = Number(r.amount_achieved || 0);
      const amountTarget = Number(r.target_amount || 0);
      const expenseActual = Number(r.expense_actual || 0);
      const expenseTarget = Number(r.expense_target || 0);

      if (dept.includes('cbd') || dept.includes('inhouse')) {
        base.cbd.turnoverActual += amountActual;
        base.cbd.turnoverTarget += amountTarget;
        base.cbd.expenseActual += expenseActual;
        base.cbd.expenseTarget += expenseTarget;
      } else if (dept.includes('deputation')) {
        base.deputation.turnoverActual += amountActual;
        base.deputation.turnoverTarget += amountTarget;
        base.deputation.expenseActual += expenseActual;
        base.deputation.expenseTarget += expenseTarget;
      } else if (dept.includes('corporate') || dept.includes('training') || dept === 'ct') {
        base.corporate.turnoverActual += amountActual;
        base.corporate.turnoverTarget += amountTarget;
        base.corporate.expenseActual += expenseActual;
        base.corporate.expenseTarget += expenseTarget;
      } else if (dept.includes('accent') && dept.includes('project')) {
        base.accentProjects.turnoverActual += amountActual;
        base.accentProjects.turnoverTarget += amountTarget;
        base.accentProjects.expenseActual += expenseActual;
        base.accentProjects.expenseTarget += expenseTarget;
      } else {
        base.other.expenseActual += expenseActual;
        base.other.expenseTarget += expenseTarget;
      }
    }

    const ctMonthRows = ctPerf.rows.filter(r => activeMonths.includes(parseMonth(r.month_year)));
    const ctTurnover = ctMonthRows.reduce((s, r) => s + Number(r.cost_from_company || 0), 0);
    const ctExpense = ctMonthRows.reduce((s, r) => s + Number(r.trainer_cost || 0) + Number(r.travelling_expenses || 0), 0);
    if (ctTurnover > 0 || ctExpense > 0) {
      base.corporate.turnoverActual += ctTurnover;
      base.corporate.expenseActual += ctExpense;
    }

    const sumOverMonths = (map: Map<string, number>, dept: string) =>
      activeMonths.reduce((s, my) => s + (map.get(`${dept}::${my}`) || 0), 0);

    const depMonthRows = deputation.rows.filter(r => activeMonths.includes(parseMonth(r.month)));
    // Turnover = receipts, not payments — using the payment-only map here
    // previously made Deputation's turnover identical to its expense.
    const depActual = sumOverMonths(cashflowByDeptMonth.turnover, 'DEPUTATION ACCENT') || depMonthRows.reduce((s, r) => s + Number(r.actual_cost || 0), 0);
    const depTarget = depMonthRows.reduce((s, r) => s + Number(r.target_cost || 0), 0);
    if (base.deputation.turnoverActual === 0 && depActual > 0) base.deputation.turnoverActual = depActual;
    if (base.deputation.turnoverTarget === 0 && depTarget > 0) base.deputation.turnoverTarget = depTarget;

    const projMonthRows = projects.rows.filter(r => activeMonths.includes(parseMonth(r.month)));
    const projActual = sumOverMonths(cashflowByDeptMonth.turnover, 'PROJECT ACCENT') || projMonthRows.reduce((s, r) => s + Number(r.actual_cost || 0), 0);
    const projTarget = projMonthRows.reduce((s, r) => s + Number(r.target_cost || 0), 0);
    if (base.accentProjects.turnoverActual === 0 && projActual > 0) base.accentProjects.turnoverActual = projActual;
    if (base.accentProjects.turnoverTarget === 0 && projTarget > 0) base.accentProjects.turnoverTarget = projTarget;

    // Fill any actuals still at zero directly from real cashflow transactions
    // for the selected period, keyed by department. This is what actually
    // updates every month as new payments/receipts are entered — the
    // dept-performance / CT / deputation / projects tables above are manually
    // maintained and often lag behind, which is why totals can look stale.
    const cfTurnover = (depts_: string[]) =>
      depts_.reduce((s, d) => s + sumOverMonths(cashflowByDeptMonth.turnover, d), 0);
    const cfExpense = (depts_: string[]) =>
      depts_.reduce((s, d) => s + sumOverMonths(cashflowByDeptMonth.expense, d), 0);

    if (base.cbd.turnoverActual === 0) base.cbd.turnoverActual = cfTurnover(['CBD']);
    if (base.cbd.expenseActual === 0) base.cbd.expenseActual = cfExpense(['CBD']);

    if (base.corporate.turnoverActual === 0) base.corporate.turnoverActual = cfTurnover(['CORPORATE TRAINING']);
    if (base.corporate.expenseActual === 0) base.corporate.expenseActual = cfExpense(['CORPORATE TRAINING']);

    if (base.deputation.expenseActual === 0) base.deputation.expenseActual = cfExpense(['DEPUTATION ACCENT']);
    if (base.accentProjects.expenseActual === 0) base.accentProjects.expenseActual = cfExpense(['PROJECT ACCENT']);

    const otherDepts = ['T&D', 'ADMIN ACCOUNTS', 'HELPING STAFF', 'GENERAL', 'MANAGEMENT', 'TRAINERS', 'LOAN REPAYMENT'];
    if (base.other.turnoverActual === 0) base.other.turnoverActual = cfTurnover(otherDepts);
    if (base.other.expenseActual === 0) base.other.expenseActual = cfExpense(otherDepts);

    // CBD income target: monthly target as-is, or × 12 across the whole financial year
    base.cbd.turnoverTarget = isFY ? CBD_YEARLY_INCOME : CBD_MONTHLY_INCOME;
    base.corporate.turnoverTarget = isFY ? CORPORATE_YEARLY_INCOME : CORPORATE_MONTHLY_INCOME;
    base.deputation.turnoverTarget = isFY ? DEPUTATION_YEARLY_TARGET : DEPUTATION_MONTHLY_TARGET;
    base.accentProjects.turnoverTarget = isFY ? ACCENT_PROJECTS_YEARLY_TARGET : ACCENT_PROJECTS_MONTHLY_TARGET;

    return [base.cbd, base.deputation, base.corporate, base.accentProjects, base.other].map(item => {
      const targetPct = TARGET_EXPENSE_PCT[item.key];
      const expenseTarget = targetPct != null ? item.turnoverActual * targetPct : item.expenseTarget;
      const profitActual = item.turnoverActual - item.expenseActual;
      const profitTargetPct = TARGET_PROFIT_PCT[item.key];
      const profitTarget = profitTargetPct != null ? item.turnoverTarget * profitTargetPct : item.turnoverTarget - expenseTarget;
      const profitPctActual = item.turnoverActual > 0 ? (profitActual / item.turnoverActual) * 100 : null;
      const profitPctTarget = item.turnoverTarget > 0 ? (profitTarget / item.turnoverTarget) * 100 : null;
      return {
        ...item,
        expenseTarget,
        profitActual,
        profitTarget,
        profitPctActual,
        profitPctTarget,
      };
    });
  }, [ctPerf.rows, depts.rows, deputation.rows, projects.rows, activeMonths, isFY, cashflowByDeptMonth]);

  const summaryTotals = useMemo(() => {
    return deptBreakdown.reduce(
      (acc, row) => {
        acc.turnoverActual += Number(row.turnoverActual || 0);
        acc.turnoverTarget += Number(row.turnoverTarget || 0);
        acc.expenseActual += Number(row.expenseActual || 0);
        acc.expenseTarget += Number(row.expenseTarget || 0);
        acc.profitActual += Number(row.profitActual || 0);
        acc.profitTarget += Number(row.profitTarget || 0);
        return acc;
      },
      { turnoverActual: 0, turnoverTarget: 0, expenseActual: 0, expenseTarget: 0, profitActual: 0, profitTarget: 0 }
    );
  }, [deptBreakdown]);

  const summaryProfitPctActual = summaryTotals.turnoverActual > 0
    ? (summaryTotals.profitActual / summaryTotals.turnoverActual) * 100
    : null;
  const summaryProfitPctTarget = summaryTotals.turnoverTarget > 0
    ? (summaryTotals.profitTarget / summaryTotals.turnoverTarget) * 100
    : null;

  return (
    <div className="space-y-6">
      {/* ── KPI Summary ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Cash Available"
          value={fmt(kpis.totalCash)}
          accent={kpis.totalCash < 0 ? 'text-red-600' : 'text-emerald-700'}
        />
        <StatCard
          label="Upcoming EMI"
          accent="text-amber-700"
          value={kpis.upcomingEmi ? (
            <span className="flex flex-col gap-0.5">
              <span>{fmt(kpis.upcomingEmi.emi_amount)}</span>
              <span className="text-[11px] font-medium text-gray-500">{fmtDate(kpis.upcomingEmi.planned_date)} · {kpis.upcomingEmi.bank_name}</span>
            </span>
          ) : '—'}
        />
        <StatCard
          label="Upcoming Salary"
          accent="text-[#2E3093]"
          value={salaryData ? (
            <span className="flex flex-col gap-0.5">
              <span>{fmt(salaryData.total_payable ?? 0)}</span>
              {salaryData.next_payout && (
                <span className="text-[11px] font-medium text-gray-500">{fmtDate(salaryData.next_payout)}</span>
              )}
            </span>
          ) : '—'}
        />
        <StatCard
          label="Total Receivables"
          value={fmt(kpis.totalReceivables)}
          accent="text-violet-700"
        />
      </div>

      {/* Cashflow Summary - Department-wise Breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Cashflow Summary - Department-wise Breakdown</SectionTitle>
            <span className="text-[11px] font-medium text-gray-500">
              Showing:&nbsp;<span className="font-bold text-[#2E3093]">{periodLabel}</span>
              &nbsp;·&nbsp;CBD {isFY ? 'Annual' : 'Monthly'} Income Target:&nbsp;
              <span className="font-bold text-[#2E3093]">₹{(isFY ? CBD_YEARLY_INCOME : CBD_MONTHLY_INCOME).toLocaleString('en-IN')}</span>
            </span>
          <div className="flex items-center gap-2">
            {!isFY && (
              <>
                <label className="text-xs font-medium text-gray-500">Month:</label>
                <select
                  value={monthIdx}
                  onChange={e => setMonthIdx(Number(e.target.value))}
                  className="text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                >
                  {MONTHS_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </>
            )}
            <label className="text-xs font-medium text-gray-500">Year:</label>
            <select
              value={yearValue}
              onChange={e => setYearValue(e.target.value)}
              className="text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
            >
              <optgroup label="Calendar Year">
                {calendarYearOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </optgroup>
              <optgroup label="Financial Year">
                {financialYearOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </optgroup>
            </select>
          </div>
        </div>
        <div className="w-full lg:w-1/2 overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-[#2E3093]">
                <th rowSpan={2} style={{ textAlign: 'center' }} className={`${thCls} border border-white/20 !text-center`}>Department</th>
                <th colSpan={2} style={{ textAlign: 'center' }} className={`${thCls} border border-white/20 !text-center`}>Turnover (1 Income)</th>
                <th colSpan={2} style={{ textAlign: 'center' }} className={`${thCls} border border-white/20 !text-center`}>Expense (2)</th>
                <th colSpan={2} style={{ textAlign: 'center' }} className={`${thCls} border border-white/20 !text-center`}>Profit (3)</th>
                <th colSpan={2} style={{ textAlign: 'center' }} className={`${thCls} border border-white/20 !text-center`}>Profit %</th>
              </tr>
              <tr className="bg-[#2E3093]">
                <th style={{ textAlign: 'center' }} className={`${thCls} border border-white/20 !text-center`}>Actual</th>
                <th style={{ textAlign: 'center' }} className={`${thCls} border border-white/20 !text-center`}>Target</th>
                <th style={{ textAlign: 'center' }} className={`${thCls} border border-white/20 !text-center`}>Actual</th>
                <th style={{ textAlign: 'center' }} className={`${thCls} border border-white/20 !text-center`}>Target</th>
                <th style={{ textAlign: 'center' }} className={`${thCls} border border-white/20 !text-center`}>Actual</th>
                <th style={{ textAlign: 'center' }} className={`${thCls} border border-white/20 !text-center`}>Target</th>
                <th style={{ textAlign: 'center' }} className={`${thCls} border border-white/20 !text-center`}>Actual</th>
                <th style={{ textAlign: 'center' }} className={`${thCls} border border-white/20 !text-center`}>Target</th>
              </tr>
            </thead>
            <tbody>
              {ctPerf.loading || deputation.loading || projects.loading ? (
                <tr><td colSpan={9} className="py-6 text-center text-xs text-gray-400">Loading summary...</td></tr>
              ) : deptBreakdown.length === 0 ? (
                <tr><td colSpan={9} className="py-6 text-center text-xs text-gray-400">No summary rows for selected month.</td></tr>
              ) : deptBreakdown.map((row, i) => {
                const showTurnover = row.key !== 'other';
                const withPct = (actual: number, target: number, label: string) =>
                  target > 0 ? `${label} (${pct(actual, target)})` : label;
                return (
                  <tr key={row.key} className={trCls(i)}>
                    <td className={`${tdCls} font-semibold text-[#2E3093] border border-gray-200 bg-[#f8f9ff]`}>{row.label}</td>
                    <td className={`${tdNum} border border-gray-200 ${showTurnover ? 'text-[#2E3093]' : 'text-gray-400'}`}>{showTurnover ? withPct(row.turnoverActual, row.turnoverTarget, fmt(row.turnoverActual)) : '—'}</td>
                    <td className={`${tdNum} border border-gray-200 ${showTurnover ? 'text-gray-700' : 'text-gray-400'}`}>{showTurnover ? fmt(row.turnoverTarget) : '—'}</td>
                    <td className={`${tdNum} border border-gray-200 ${row.expenseTarget > 0 && row.expenseActual > row.expenseTarget ? 'text-red-600' : 'text-gray-700'}`}>{withPct(row.expenseActual, row.expenseTarget, fmt(row.expenseActual))}</td>
                    <td className={`${tdNum} border border-gray-200 text-gray-700`}>{fmt(row.expenseTarget)}</td>
                    <td className={`${tdNum} border border-gray-200 font-semibold ${row.profitActual < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{showTurnover ? withPct(row.profitActual, row.profitTarget, fmt(row.profitActual)) : '—'}</td>
                    <td className={`${tdNum} border border-gray-200 font-semibold ${row.profitTarget < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{showTurnover ? fmt(row.profitTarget) : '—'}</td>
                    <td className={`${tdNum} border border-gray-200 font-semibold ${(row.profitPctActual ?? 0) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {showTurnover && row.profitPctActual != null ? `${row.profitPctActual.toFixed(1)}%` : '—'}
                    </td>
                    <td className={`${tdNum} border border-gray-200 font-semibold ${(row.profitPctTarget ?? 0) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {showTurnover && row.profitPctTarget != null ? `${row.profitPctTarget.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                );
              })}
              {deptBreakdown.length > 0 && (
                <TotalRow>
                  <td className="px-3 py-2 text-xs border border-gray-200 text-[#2E3093] text-center">Total</td>
                  <td className="px-3 py-2 text-xs text-center border border-gray-200 text-[#2E3093]">{fmt(summaryTotals.turnoverActual)}</td>
                  <td className="px-3 py-2 text-xs text-center border border-gray-200 text-[#2E3093]">{fmt(summaryTotals.turnoverTarget)}</td>
                  <td className={`px-3 py-2 text-xs text-center border border-gray-200 ${summaryTotals.expenseTarget > 0 && summaryTotals.expenseActual > summaryTotals.expenseTarget ? 'text-red-600' : 'text-gray-700'}`}>{fmt(summaryTotals.expenseActual)}</td>
                  <td className="px-3 py-2 text-xs text-center border border-gray-200 text-[#2E3093]">{fmt(summaryTotals.expenseTarget)}</td>
                  <td className={`px-3 py-2 text-xs text-center border border-gray-200 font-semibold ${summaryTotals.profitActual < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmt(summaryTotals.profitActual)}</td>
                  <td className={`px-3 py-2 text-xs text-center border border-gray-200 font-semibold ${summaryTotals.profitTarget < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmt(summaryTotals.profitTarget)}</td>
                  <td className={`px-3 py-2 text-xs text-center border border-gray-200 font-semibold ${(summaryProfitPctActual ?? 0) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {summaryProfitPctActual != null ? `${summaryProfitPctActual.toFixed(1)}%` : '—'}
                  </td>
                  <td className={`px-3 py-2 text-xs text-center border border-gray-200 font-semibold ${(summaryProfitPctTarget ?? 0) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {summaryProfitPctTarget != null ? `${summaryProfitPctTarget.toFixed(1)}%` : '—'}
                  </td>
                </TotalRow>
              )}
            </tbody>
          </table>
        </div>
        <div className="w-full lg:w-1/2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] leading-relaxed text-gray-500">
          <span className="font-semibold text-gray-600">How these numbers are calculated:</span>
          <ul className="mt-1 list-disc pl-4 space-y-0.5">
            <li>Turnover Actual = sum of receipts posted for the department in the selected period</li>
            <li>Turnover Target = hardcoded income target (CBD ₹6,74,60,000/yr, Corporate Training ₹3,00,00,000/yr, Deputation ₹2,50,00,000/yr, Accent Projects ₹10,00,00,000/yr; ÷12 for monthly view)</li>
            <li>Expense Actual = sum of payments posted for the department in the selected period</li>
            <li>Expense Target = Turnover Actual × expense% (CBD 70%, Deputation 80%, Corporate Training 50%, Accent Projects 80%)</li>
            <li>Profit Actual = Turnover Actual − Expense Actual</li>
            <li>Profit Target = Turnover Target × profit% (CBD 30%, Deputation 15%, Corporate Training 40%, Accent Projects 20%)</li>
            <li>Profit % Actual = Profit Actual ÷ Turnover Actual</li>
            <li>Profit % Target = Hardcoded Profit Percentage (CBD 30%, Deputation 15%, Corporate Training 40%, Accent Projects 20%)</li>
          </ul>
        </div>
      </div>

      {/* Loans */}
      <div>
        <TableHeader title="Outstanding Loans" onAdd={openAddLoan} />
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-separate border-spacing-0">
            <thead><tr className="bg-[#2E3093]">
              <th className={thCls}>Bank Name</th>
              <th className={`${thCls} text-center`}>Outstanding Amount (₹)</th>
              <th className={`${thCls} text-center`}>Paid Amount (₹)</th>
              <th className={`${thCls} text-center`}>%age Paid</th>
              <th className={`${thCls} text-center`}>Actions</th>
            </tr></thead>
            <tbody>
              {loans.loading ? <TableSkeleton cols={5} /> :
               loans.rows.length === 0 ? <EmptyRow cols={5} /> :
               [...loans.rows].sort((a, b) => Number(b.outstanding) - Number(a.outstanding)).map((r, i) => {
                const paidFromDebtPlan = paidByBankFromDebtPlans.get((r.bank_name || '').trim().toLowerCase()) || 0;
                return (
                  <tr key={r.id} className={trCls(i)}>
                    <td className={tdCls}>
                      <span className="font-medium">{r.bank_name}</span>
                      <span className="ml-2 text-[11px] text-gray-400">({fmt(r.outstanding)})</span>
                    </td>
                    <td className={tdNum}>{fmt(r.outstanding)}</td>
                    <td className={tdNum}>{fmt(paidFromDebtPlan)}</td>
                    <td className={tdNum}><PctBar value={paidFromDebtPlan} denominator={r.outstanding} /></td>
                    <RowActions onEdit={() => openEditLoan(r)} onDelete={() => loans.remove(r.id)} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={loanModal.open}
        title={loanModal.editing ? 'Edit Loan' : 'Add Loan'}
        saving={savingL}
        onClose={() => setLoanModal({ open: false, editing: null })}
        onSave={saveLoan}
      >
        <div><label className={lblCls}>Bank Name</label><input className={inpCls} value={loanForm.bank_name} onChange={e => setLoanForm(f => ({ ...f, bank_name: e.target.value }))} /></div>
        <div><label className={lblCls}>Outstanding Amount (₹)</label><input type="number" min="0" className={inpCls} value={loanForm.outstanding} onChange={e => setLoanForm(f => ({ ...f, outstanding: e.target.value }))} /></div>
        <div><label className={lblCls}>Paid Amount (₹)</label><input type="number" min="0" className={inpCls} value={loanForm.paid} onChange={e => setLoanForm(f => ({ ...f, paid: e.target.value }))} /></div>
      </Modal>

    </div>
  );
}
