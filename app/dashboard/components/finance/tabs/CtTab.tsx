'use client';

import { useCallback, useMemo, useState } from 'react';
import { useFinanceResource } from '../shared/useFinanceResource';
import { Modal, TableHeader, TableSkeleton, EmptyRow, RowActions, TotalRow, SectionTitle, thCls, tdCls, tdNum, inpCls, lblCls, trCls, PctBar } from '../shared/primitives';
import { fmt } from '../shared/format';
import type { CtRow, MonthlyRow, CashflowTxn } from '../shared/types';
import { PendingInvoicesSection } from './MonthlyTab';

export default function CtTab() {
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

  /** Sum of cashflow payments for CORPORATE TRAINING per month (YYYY-MM). */
  const cfActualByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const txn of cashflow.rows) {
      if ((txn.department ?? '').toUpperCase() !== 'CORPORATE TRAINING') continue;
      if (txn.type !== 'Payment') continue;
      if (!txn.date) continue;
      const m = txn.date.substring(0, 7);
      map.set(m, (map.get(m) || 0) + Number(txn.payment || 0));
    }
    return map;
  }, [cashflow.rows]);

  const [monthlyModal, setMonthlyModal] = useState<{ open: boolean; editing: MonthlyRow | null }>({ open: false, editing: null });
  const [monthlyForm, setMonthlyForm] = useState({ month: '', target_cost: '' });
  const [monthlySaving, setMonthlySaving] = useState(false);

  const openAddMonthly = useCallback(() => {
    setMonthlyForm({ month: '', target_cost: '' });
    setMonthlyModal({ open: true, editing: null });
  }, []);

  const openEditMonthly = useCallback((r: MonthlyRow) => {
    setMonthlyForm({ month: r.month ?? '', target_cost: String(r.target_cost ?? 0) });
    setMonthlyModal({ open: true, editing: r });
  }, []);

  const saveMonthly = useCallback(async () => {
    setMonthlySaving(true);
    try {
      await monthly.save({
        month: monthlyForm.month.trim(),
        target_cost: Number(monthlyForm.target_cost),
      } as Partial<MonthlyRow>, monthlyModal.editing);
      setMonthlyModal({ open: false, editing: null });
    } catch { /* toast */ }
    setMonthlySaving(false);
  }, [monthly, monthlyForm, monthlyModal.editing]);

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
        <TableHeader title="Monthly Performance" onAdd={openAddMonthly} />
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-separate border-spacing-0">
            <thead><tr className="bg-[#2E3093]">
              <th className={thCls}>Month</th>
              <th className={`${thCls} text-right`}>Actual Cost (₹)</th>
              <th className={`${thCls} text-right`}>Targeted Cost (₹)</th>
              <th className={`${thCls} text-center`}>%age</th>
              <th className={`${thCls} text-center`}>Actions</th>
            </tr></thead>
            <tbody>
              {monthly.loading ? <TableSkeleton cols={5} /> :
               monthly.rows.length === 0 ? <EmptyRow cols={5} /> :
               monthly.rows.map((r, i) => {
                 const actualCost = cfActualByMonth.get((r.month ?? '').substring(0, 7)) || 0;
                 const pct = Number(r.target_cost || 0) > 0
                   ? (actualCost / Number(r.target_cost)) * 100
                   : 0;
                 const over = pct > 100;
                 return (
                   <tr key={r.id} className={trCls(i)}>
                     <td className={tdCls}>{r.month || '—'}</td>
                     <td className={tdNum}>{fmt(actualCost)}</td>
                     <td className={tdNum}>{fmt(r.target_cost)}</td>
                     <td className={`${tdNum} ${over ? 'text-red-600 font-semibold' : 'text-emerald-700'}`}>
                       {Number(r.target_cost || 0) > 0 ? `${pct.toFixed(1)}%` : '—'}
                     </td>
                     <RowActions onEdit={() => openEditMonthly(r)} onDelete={() => monthly.remove(r.id)} />
                   </tr>
                 );
               })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Monthly Performance modal ── */}
      <Modal
        open={monthlyModal.open}
        title={monthlyModal.editing ? 'Edit Monthly Performance' : 'Add Monthly Performance'}
        saving={monthlySaving}
        onClose={() => setMonthlyModal({ open: false, editing: null })}
        onSave={saveMonthly}
      >
        <div>
          <label className={lblCls}>Month (YYYY-MM)</label>
          <input type="month" className={inpCls} value={monthlyForm.month} onChange={e => setMonthlyForm(f => ({ ...f, month: e.target.value }))} />
        </div>
        <div>
          <label className={lblCls}>Targeted Cost (₹)</label>
          <input type="number" min="0" className={inpCls} value={monthlyForm.target_cost} onChange={e => setMonthlyForm(f => ({ ...f, target_cost: e.target.value }))} />
        </div>
      </Modal>

      {/* ── Pending Invoices ── */}
      <PendingInvoicesSection department="Corporate Training" />
    </div>
  );
}
