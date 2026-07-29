'use client';

import { useCallback, useMemo, useState } from 'react';
import { useFinanceResource } from '../shared/useFinanceResource';
import { Modal, TableHeader, TableSkeleton, EmptyRow, RowActions, TotalRow, SectionTitle, thCls, tdCls, tdNum, inpCls, lblCls, trCls, PctBar } from '../shared/primitives';
import { fmt, monthLabel, parseMonth, isCountableCashflow, monthsInFinancialYear, financialYearLabel } from '../shared/format';
import type { CtRow, MonthlyRow, CashflowTxn } from '../shared/types';
import { PendingInvoicesSection } from './MonthlyTab';
import { DEPT_TURNOVER_TARGETS, TARGET_EXPENSE_PCT, TARGET_PROFIT_PCT } from '../shared/targets';

export default function CtTab() {
  const now = new Date();
  const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const [year, setYear] = useState(currentYear);
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  /* ── Monthly table ── */
  const ct = useFinanceResource<CtRow>('/api/finance/ct-performance');

  const [modal, setModal] = useState<{ open: boolean; editing: CtRow | null }>({ open: false, editing: null });
  const [form, setForm] = useState({
    month_year: '',
    training_name: '',
    company: '',
    cost_from_company: '',
    trainer_cost: '',
    travelling_expenses: '',
  });
  const [saving, setSaving] = useState(false);

  const openAdd = useCallback(() => {
    setForm({ month_year: '', training_name: '', company: '', cost_from_company: '', trainer_cost: '', travelling_expenses: '' });
    setModal({ open: true, editing: null });
  }, []);

  const openEdit = useCallback((r: CtRow) => {
    setForm({
      month_year: r.month_year ?? '',
      training_name: r.training_name ?? '',
      company: r.company ?? '',
      cost_from_company: String(r.cost_from_company ?? 0),
      trainer_cost: String(r.trainer_cost ?? 0),
      travelling_expenses: String(r.travelling_expenses ?? 0),
    });
    setModal({ open: true, editing: r });
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await ct.save({
        month_year: form.month_year.trim(),
        training_name: form.training_name.trim(),
        company: form.company.trim(),
        cost_from_company: Number(form.cost_from_company),
        trainer_cost: Number(form.trainer_cost),
        travelling_expenses: Number(form.travelling_expenses),
      } as Partial<CtRow>, modal.editing);
      setModal({ open: false, editing: null });
    } catch { /* toast */ }
    setSaving(false);
  }, [ct, form, modal.editing]);

  const sortedRows = useMemo(() => [...ct.rows], [ct.rows]);

  const totals = useMemo(() => {
    const costFromCompany    = sortedRows.reduce((s, r) => s + Number(r.cost_from_company || 0), 0);
    const trainerCost        = sortedRows.reduce((s, r) => s + Number(r.trainer_cost || 0), 0);
    const travellingExpenses = sortedRows.reduce((s, r) => s + Number(r.travelling_expenses || 0), 0);
    const roughProfit        = costFromCompany - trainerCost - travellingExpenses;
    return { costFromCompany, trainerCost, travellingExpenses, roughProfit };
  }, [sortedRows]);

  /* ── Monthly Performance ── */
  const monthly = useFinanceResource<MonthlyRow>('/api/finance/ct-monthly');
  const cashflow = useFinanceResource<CashflowTxn>('/api/finance/cashflow');

  /** Corporate Training's real turnover (receipts) and expense (payments) per month, from cashflow. */
  const cfByMonth = useMemo(() => {
    const turnover = new Map<string, number>();
    const expense = new Map<string, number>();
    for (const txn of cashflow.rows) {
      if ((txn.department ?? '').toUpperCase() !== 'CORPORATE TRAINING') continue;
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
      const turnoverTarget = DEPT_TURNOVER_TARGETS.corporate.monthly;
      const expenseTarget = override ? Number(override.target_cost || 0) : turnoverActual * TARGET_EXPENSE_PCT.corporate;
      const profitActual = turnoverActual - expenseActual;
      const profitTarget = turnoverTarget * TARGET_PROFIT_PCT.corporate;
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
  const [monthlyForm, setMonthlyForm] = useState({ month: '', target_cost: '' });
  const [monthlySaving, setMonthlySaving] = useState(false);

  const openSetExpenseTarget = (month: string, override?: MonthlyRow) => {
    setMonthlyForm({ month, target_cost: override ? String(override.target_cost ?? 0) : '' });
    setMonthlyModal({ open: true, editing: override ?? null });
  };

  const saveMonthly = async () => {
    setMonthlySaving(true);
    try {
      await monthly.save({
        month: monthlyForm.month.trim(),
        target_cost: Number(monthlyForm.target_cost),
      } as Partial<MonthlyRow>, monthlyModal.editing);
      setMonthlyModal({ open: false, editing: null });
    } catch { /* toast */ }
    setMonthlySaving(false);
  };

  return (
    <div className="space-y-6">
      {/* ── Monthly Performance ── */}
      <div>
        <TableHeader title="Corporate Training — Yearly" onAdd={openAdd} />
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-separate border-spacing-0">
            <thead><tr className="bg-[#2E3093]">
              <th className={thCls}>Month</th>
              <th className={thCls}>Training Program Name</th>
              <th className={thCls}>Company</th>
              <th className={`${thCls} text-right`}>Cost from Company (₹)</th>
              <th className={`${thCls} text-right`}>Trainer Cost (₹)</th>
              <th className={`${thCls} text-right`}>Travelling & Expenses (₹)</th>
              <th className={`${thCls} text-right`}>Rough Profit (₹)</th>
              <th className={`${thCls} text-center`}>Profit %</th>
              <th className={`${thCls} text-center`}>Actions</th>
            </tr></thead>
            <tbody>
              {ct.loading ? <TableSkeleton cols={9} /> :
               sortedRows.length === 0 ? <EmptyRow cols={9} /> :
               sortedRows.map((r, i) => {
                 const profit    = Number(r.cost_from_company || 0) - Number(r.trainer_cost || 0) - Number(r.travelling_expenses || 0);
                 const profitPct = Number(r.cost_from_company || 0) > 0
                   ? (profit / Number(r.cost_from_company)) * 100
                   : 0;
                 const isLoss = profit < 0;
                 return (
                   <tr key={r.id} className={isLoss ? 'bg-red-50' : trCls(i)}>
                     <td className={tdCls}>{r.month_year || '—'}</td>
                     <td className={tdCls}>{r.training_name}</td>
                     <td className={tdCls}>{r.company || '—'}</td>
                     <td className={tdNum}>{fmt(r.cost_from_company)}</td>
                     <td className={tdNum}>{fmt(r.trainer_cost)}</td>
                     <td className={tdNum}>{fmt(r.travelling_expenses)}</td>
                     <td className={`${tdNum} ${isLoss ? 'text-red-600 font-semibold' : 'text-emerald-700 font-semibold'}`}>{fmt(profit)}</td>
                     <td className={`${tdNum} ${isLoss ? 'text-red-600' : 'text-emerald-700'}`}>
                       {Number(r.cost_from_company || 0) > 0 ? `${profitPct.toFixed(1)}%` : '—'}
                     </td>
                     <RowActions onEdit={() => openEdit(r)} onDelete={() => ct.remove(r.id)} />
                   </tr>
                 );
               })}
              {sortedRows.length > 1 && (
                <TotalRow>
                  <td colSpan={3} className="px-3 py-2 text-xs text-[#2E3093]">Total</td>
                  <td className="px-3 py-2 text-xs text-right text-[#2E3093]">{fmt(totals.costFromCompany)}</td>
                  <td className="px-3 py-2 text-xs text-right text-[#2E3093]">{fmt(totals.trainerCost)}</td>
                  <td className="px-3 py-2 text-xs text-right text-[#2E3093]">{fmt(totals.travellingExpenses)}</td>
                  <td className={`px-3 py-2 text-xs text-right font-semibold ${totals.roughProfit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {fmt(totals.roughProfit)}
                  </td>
                  <td className={`px-3 py-2 text-xs text-center font-semibold ${totals.roughProfit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {totals.costFromCompany > 0 ? `${((totals.roughProfit / totals.costFromCompany) * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td />
                </TotalRow>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Monthly record modal ── */}
      <Modal
        open={modal.open}
        title={modal.editing ? 'Edit CT Record' : 'Add CT Record'}
        saving={saving}
        onClose={() => setModal({ open: false, editing: null })}
        onSave={save}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lblCls}>Month (YYYY-MM)</label>
            <input type="month" className={inpCls} value={form.month_year} onChange={e => setForm(f => ({ ...f, month_year: e.target.value }))} />
          </div>
          <div>
            <label className={lblCls}>Company</label>
            <input className={inpCls} placeholder="e.g. ABC Corp" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className={lblCls}>Training Program Name</label>
          <input className={inpCls} value={form.training_name} onChange={e => setForm(f => ({ ...f, training_name: e.target.value }))} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={lblCls}>Cost from Company (₹)</label>
            <input type="number" min="0" className={inpCls} value={form.cost_from_company} onChange={e => setForm(f => ({ ...f, cost_from_company: e.target.value }))} />
          </div>
          <div>
            <label className={lblCls}>Trainer Cost (₹)</label>
            <input type="number" min="0" className={inpCls} value={form.trainer_cost} onChange={e => setForm(f => ({ ...f, trainer_cost: e.target.value }))} />
          </div>
          <div>
            <label className={lblCls}>Travelling & Expenses (₹)</label>
            <input type="number" min="0" className={inpCls} value={form.travelling_expenses} onChange={e => setForm(f => ({ ...f, travelling_expenses: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {/* ── Monthly Performance ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionTitle>{`Corporate Training — Monthly Performance (${financialYearLabel(year)})`}</SectionTitle>
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

      {/* ── Monthly Performance modal ── */}
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
            Leave blank to use the default ({(TARGET_EXPENSE_PCT.corporate * 100).toFixed(0)}% of that month&apos;s actual turnover).
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

      {/* ── Pending Invoices ── */}
      <PendingInvoicesSection department="Corporate Training" />
    </div>
  );
}
