'use client';

import { useCallback, useMemo, useState } from 'react';
import { useFinanceResource } from '../shared/useFinanceResource';
import { Modal, TableHeader, TableSkeleton, EmptyRow, RowActions, TotalRow, SectionTitle, thCls, tdCls, tdNum, inpCls, lblCls, trCls, PctBar } from '../shared/primitives';
import { fmt, pct, MONTHS_FULL, parseMonth } from '../shared/format';
import type { Loan, DeptPerf, DebtPlan, CtRow, MonthlyRow, CashflowTxn } from '../shared/types';

export default function OverviewTab() {
  const now = new Date();
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
  const monthYear = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;

  // Separate filter for Department Performance table
  const [deptPerfMonthIdx, setDeptPerfMonthIdx] = useState(now.getMonth());
  const [deptPerfYear, setDeptPerfYear] = useState(now.getFullYear());
  const deptPerfMonthYear = `${deptPerfYear}-${String(deptPerfMonthIdx + 1).padStart(2, '0')}`;
  const deptPerfLabel = `${MONTHS_FULL[deptPerfMonthIdx]} ${deptPerfYear}`;
  const deptPerfYearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const depts  = useFinanceResource<DeptPerf>('/api/finance/dept-performance', { query: `month_year=${monthYear}` });
  const deptsPerf = useFinanceResource<DeptPerf>('/api/finance/dept-performance', { query: `month_year=${deptPerfMonthYear}` });
  const loans  = useFinanceResource<Loan>('/api/finance/loans');
  const debtPlans = useFinanceResource<DebtPlan>('/api/finance/debt-plan');
  const ctPerf = useFinanceResource<CtRow>('/api/finance/ct-performance');
  const deputation = useFinanceResource<MonthlyRow>('/api/finance/deputation');
  const projects = useFinanceResource<MonthlyRow>('/api/finance/projects');
  const cashflow = useFinanceResource<CashflowTxn>('/api/finance/cashflow');

  /** Cashflow payments per department per month (YYYY-MM). */
  const cashflowActualByDeptMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const txn of cashflow.rows) {
      if (txn.type !== 'Payment') continue;
      if (!txn.date || !txn.department) continue;
      const key = `${(txn.department).toUpperCase()}::${txn.date.substring(0, 7)}`;
      map.set(key, (map.get(key) || 0) + Number(txn.payment || 0));
    }
    return map;
  }, [cashflow.rows]);
  const [deptModal, setDeptModal] = useState<{ open: boolean; editing: DeptPerf | null }>({ open: false, editing: null });
  const [deptForm, setDeptForm]   = useState({ department: '', amount_achieved: '', target_amount: '' });
  const [savingD, setSavingD]     = useState(false);

  const openAddDept = useCallback(() => {
    setDeptForm({ department: '', amount_achieved: '', target_amount: '' });
    setDeptModal({ open: true, editing: null });
  }, []);
  const openEditDept = useCallback((r: DeptPerf) => {
    setDeptForm({ department: r.department, amount_achieved: String(r.amount_achieved), target_amount: String(r.target_amount) });
    setDeptModal({ open: true, editing: r });
  }, []);
  const saveDept = useCallback(async () => {
    setSavingD(true);
    try {
      await deptsPerf.save({
        month_year: deptPerfMonthYear,
        department: deptForm.department.trim(),
        amount_achieved: Number(deptForm.amount_achieved),
        target_amount: Number(deptForm.target_amount),
      } as Partial<DeptPerf>, deptModal.editing);
      setDeptModal({ open: false, editing: null });
    } catch { /* toast already shown */ }
    setSavingD(false);
  }, [deptsPerf, deptPerfMonthYear, deptForm, deptModal.editing]);

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
  const deptTotals = useMemo(() => {
    const a = deptsPerf.rows.reduce((s, r) => s + Number(r.amount_achieved || 0), 0);
    const t = deptsPerf.rows.reduce((s, r) => s + Number(r.target_amount || 0), 0);
    return { achieved: a, target: t };
  }, [deptsPerf.rows]);

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

    const ctMonthRows = ctPerf.rows.filter(r => parseMonth(r.month_year) === monthYear);
    const ctTurnover = ctMonthRows.reduce((s, r) => s + Number(r.cost_from_company || 0), 0);
    const ctExpense = ctMonthRows.reduce((s, r) => s + Number(r.trainer_cost || 0) + Number(r.travelling_expenses || 0), 0);
    if (ctTurnover > 0 || ctExpense > 0) {
      base.corporate.turnoverActual += ctTurnover;
      base.corporate.expenseActual += ctExpense;
    }

    const depMonthRows = deputation.rows.filter(r => parseMonth(r.month) === monthYear);
    const depActual = cashflowActualByDeptMonth.get(`DEPUTATION ACCENT::${monthYear}`) || depMonthRows.reduce((s, r) => s + Number(r.actual_cost || 0), 0);
    const depTarget = depMonthRows.reduce((s, r) => s + Number(r.target_cost || 0), 0);
    if (base.deputation.turnoverActual === 0 && depActual > 0) base.deputation.turnoverActual = depActual;
    if (base.deputation.turnoverTarget === 0 && depTarget > 0) base.deputation.turnoverTarget = depTarget;

    const projMonthRows = projects.rows.filter(r => parseMonth(r.month) === monthYear);
    const projActual = cashflowActualByDeptMonth.get(`PROJECT ACCENT::${monthYear}`) || projMonthRows.reduce((s, r) => s + Number(r.actual_cost || 0), 0);
    const projTarget = projMonthRows.reduce((s, r) => s + Number(r.target_cost || 0), 0);
    if (base.accentProjects.turnoverActual === 0 && projActual > 0) base.accentProjects.turnoverActual = projActual;
    if (base.accentProjects.turnoverTarget === 0 && projTarget > 0) base.accentProjects.turnoverTarget = projTarget;

    return [base.cbd, base.deputation, base.corporate, base.accentProjects, base.other].map(item => {
      const profitActual = item.turnoverActual - item.expenseActual;
      const profitTarget = item.turnoverTarget - item.expenseTarget;
      const profitPctActual = item.turnoverActual > 0 ? (profitActual / item.turnoverActual) * 100 : null;
      const profitPctTarget = item.turnoverTarget > 0 ? (profitTarget / item.turnoverTarget) * 100 : null;
      return {
        ...item,
        profitActual,
        profitTarget,
        profitPctActual,
        profitPctTarget,
      };
    });
  }, [ctPerf.rows, depts.rows, deputation.rows, projects.rows, monthYear, cashflowActualByDeptMonth]);

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
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-gray-600">Month:</label>
        <select
          value={monthIdx}
          onChange={e => setMonthIdx(Number(e.target.value))}
          className="text-xs rounded-lg border border-gray-200 bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
        >
          {MONTHS_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <label className="text-xs font-medium text-gray-600">Year:</label>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="text-xs rounded-lg border border-gray-200 bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
        >
          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Cashflow Summary - Department-wise Breakdown */}
      <div className="space-y-3">
        <SectionTitle>Cashflow Summary - Department-wise Breakdown</SectionTitle>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
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
                return (
                  <tr key={row.key} className={trCls(i)}>
                    <td className={`${tdCls} font-semibold text-[#2E3093] border border-gray-200 bg-[#f8f9ff]`}>{row.label}</td>
                    <td className={`${tdNum} border border-gray-200 ${showTurnover ? 'text-[#2E3093]' : 'text-gray-400'}`}>{showTurnover ? fmt(row.turnoverActual) : '—'}</td>
                    <td className={`${tdNum} border border-gray-200 ${showTurnover ? 'text-gray-700' : 'text-gray-400'}`}>{showTurnover ? fmt(row.turnoverTarget) : '—'}</td>
                    <td className={`${tdNum} border border-gray-200 text-red-600`}>{fmt(row.expenseActual)}</td>
                    <td className={`${tdNum} border border-gray-200 text-gray-700`}>{fmt(row.expenseTarget)}</td>
                    <td className={`${tdNum} border border-gray-200 font-semibold ${row.profitActual < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{showTurnover ? fmt(row.profitActual) : '—'}</td>
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
                  <td className="px-3 py-2 text-xs text-center border border-gray-200 text-red-600">{fmt(summaryTotals.expenseActual)}</td>
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
      </div>

      {/* Dept Performance */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <TableHeader title={`Department Performance — ${deptPerfLabel}`} onAdd={openAddDept} />
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500">Month:</label>
            <select
              value={deptPerfMonthIdx}
              onChange={e => setDeptPerfMonthIdx(Number(e.target.value))}
              className="text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
            >
              {MONTHS_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <label className="text-xs font-medium text-gray-500">Year:</label>
            <select
              value={deptPerfYear}
              onChange={e => setDeptPerfYear(Number(e.target.value))}
              className="text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
            >
              {deptPerfYearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-separate border-spacing-0">
            <thead><tr className="bg-[#2E3093]">
              <th className={thCls}>Department</th>
              <th className={`${thCls} text-center`}>Amount Achieved (₹)</th>
              <th className={`${thCls} text-center`}>Target Amount (₹)</th>
              <th className={`${thCls} text-center`}>%age</th>
              <th className={`${thCls} text-center`}>Actions</th>
            </tr></thead>
            <tbody>
              {deptsPerf.loading ? <TableSkeleton cols={5} /> :
               deptsPerf.rows.length === 0 ? <EmptyRow cols={5} /> :
               deptsPerf.rows.map((r, i) => (
                <tr key={r.id} className={trCls(i)}>
                  <td className={tdCls}>{r.department}</td>
                  <td className={tdNum}>{fmt(r.amount_achieved)}</td>
                  <td className={tdNum}>{fmt(r.target_amount)}</td>
                  <td className={tdNum}><PctBar value={r.amount_achieved} denominator={r.target_amount} /></td>
                  <RowActions onEdit={() => openEditDept(r)} onDelete={() => deptsPerf.remove(r.id)} />
                </tr>
              ))}
              {deptsPerf.rows.length > 1 && (
                <TotalRow>
                  <td className="px-3 py-2 text-xs text-[#2E3093]">Total</td>
                  <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{fmt(deptTotals.achieved)}</td>
                  <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{fmt(deptTotals.target)}</td>
                  <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{pct(deptTotals.achieved, deptTotals.target)}</td>
                  <td />
                </TotalRow>
              )}
            </tbody>
          </table>
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
        open={deptModal.open}
        title={deptModal.editing ? 'Edit Department Record' : 'Add Department Record'}
        saving={savingD}
        onClose={() => setDeptModal({ open: false, editing: null })}
        onSave={saveDept}
      >
        <div><label className={lblCls}>Department Name</label>
          <input className={inpCls} placeholder="e.g. CBD / Inhouse Training" value={deptForm.department} onChange={e => setDeptForm(f => ({ ...f, department: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Amount Achieved (₹)</label><input type="number" min="0" className={inpCls} value={deptForm.amount_achieved} onChange={e => setDeptForm(f => ({ ...f, amount_achieved: e.target.value }))} /></div>
          <div><label className={lblCls}>Target Amount (₹)</label><input type="number" min="0" className={inpCls} value={deptForm.target_amount} onChange={e => setDeptForm(f => ({ ...f, target_amount: e.target.value }))} /></div>
        </div>
      </Modal>

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
