'use client';

import { useCallback, useMemo, useState } from 'react';
import { useFinanceResource } from '../shared/useFinanceResource';
import { Modal, TableHeader, TableSkeleton, EmptyRow, RowActions, SectionTitle, thCls, tdCls, tdNum, inpCls, lblCls, trCls, CellSparkline } from '../shared/primitives';
import { fmt, monthLabel, parseMonth, fmtDate, isCountableCashflow, monthsInFinancialYear, financialYearLabel } from '../shared/format';
import type { MonthlyRow, CashflowTxn, PendingInvoice, InvoiceStatus } from '../shared/types';
import { DEPT_TURNOVER_TARGETS, TARGET_EXPENSE_PCT, TARGET_PROFIT_PCT } from '../shared/targets';

const INVOICE_STATUSES: InvoiceStatus[] = ['Pending', 'Paid', 'Overdue'];

export function PendingInvoicesSection({ department = 'Projects' }: { department?: string }) {
  const invoices = useFinanceResource<PendingInvoice>('/api/finance/pending-invoices', { query: `department=${encodeURIComponent(department)}` });

  const [modal, setModal] = useState<{ open: boolean; editing: PendingInvoice | null }>({ open: false, editing: null });
  const [form, setForm] = useState({ client_name: '', invoice_no: '', amount: '', invoice_date: '', due_date: '', status: 'Pending' as InvoiceStatus, description: '' });
  const [saving, setSaving] = useState(false);

  const emptyForm = () => ({ client_name: '', invoice_no: '', amount: '', invoice_date: '', due_date: '', status: 'Pending' as InvoiceStatus, description: '' });

  const openAdd = useCallback(() => { setForm(emptyForm()); setModal({ open: true, editing: null }); }, []);
  const openEdit = useCallback((r: PendingInvoice) => {
    setForm({ client_name: r.client_name, invoice_no: r.invoice_no ?? '', amount: String(r.amount), invoice_date: r.invoice_date ?? '', due_date: r.due_date ?? '', status: r.status, description: r.description ?? '' });
    setModal({ open: true, editing: r });
  }, []);
  const save = useCallback(async () => {
    setSaving(true);
    try {
      await invoices.save({ client_name: form.client_name.trim(), invoice_no: form.invoice_no.trim() || null, amount: Number(form.amount), invoice_date: form.invoice_date || null, due_date: form.due_date || null, status: form.status, description: form.description.trim() || null, department } as Partial<PendingInvoice>, modal.editing);
      setModal({ open: false, editing: null });
    } catch { /* toast */ }
    setSaving(false);
  }, [invoices, form, modal.editing]);

  const totals = useMemo(() => ({
    pending:  invoices.rows.filter(r => r.status === 'Pending').reduce((s, r) => s + Number(r.amount), 0),
    overdue:  invoices.rows.filter(r => r.status === 'Overdue').reduce((s, r) => s + Number(r.amount), 0),
    total:    invoices.rows.reduce((s, r) => s + Number(r.amount), 0),
  }), [invoices.rows]);

  const sorted = useMemo(() =>
    [...invoices.rows].sort((a, b) => (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31')),
    [invoices.rows]
  );

  return (
    <div>
      <TableHeader title="Pending Invoices" onAdd={openAdd} />

      {/* Summary chips */}
      {invoices.rows.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-700">
            Pending: {fmt(totals.pending)}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-[11px] font-semibold text-red-600">
            Overdue: {fmt(totals.overdue)}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-50 border border-gray-200 text-[11px] font-semibold text-gray-600">
            Total: {fmt(totals.total)}
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr className="bg-[#2E3093]">
              <th className={thCls}>Client</th>
              <th className={thCls}>Invoice No.</th>
              <th className={`${thCls} text-center`}>Amount (₹)</th>
              <th className={`${thCls} text-center`}>Invoice Date</th>
              <th className={`${thCls} text-center`}>Due Date</th>
              <th className={`${thCls} text-center`}>Status</th>
              <th className={`${thCls} text-center`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.loading ? <TableSkeleton cols={7} /> :
             sorted.length === 0 ? <EmptyRow cols={7} message="No pending invoices." /> :
             sorted.map((r, i) => (
              <tr key={r.id} className={
                r.status === 'Overdue' ? 'bg-red-50/70 hover:bg-red-50 transition-colors' :
                r.status === 'Paid'    ? 'bg-emerald-50/50 hover:bg-emerald-50/80 transition-colors' :
                trCls(i)
              }>
                <td className={`${tdCls} font-medium`}>{r.client_name}</td>
                <td className={`${tdCls} text-gray-500`}>{r.invoice_no || '—'}</td>
                <td className={`${tdNum} font-semibold text-[#2E3093]`}>{fmt(r.amount)}</td>
                <td className={`${tdNum} text-gray-500`}>{fmtDate(r.invoice_date)}</td>
                <td className={`${tdNum} ${r.status === 'Overdue' ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>{fmtDate(r.due_date)}</td>
                <td className={tdNum}>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    r.status === 'Paid'    ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' :
                    r.status === 'Overdue' ? 'bg-red-100 text-red-700 ring-1 ring-red-200' :
                                             'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.status === 'Paid' ? 'bg-emerald-500' : r.status === 'Overdue' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    {r.status}
                  </span>
                </td>
                <RowActions onEdit={() => openEdit(r)} onDelete={() => invoices.remove(r.id)} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal.open} title={modal.editing ? 'Edit Invoice' : 'Add Invoice'} saving={saving} onClose={() => setModal({ open: false, editing: null })} onSave={save}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className={lblCls}>Client Name</label><input className={inpCls} placeholder="e.g. Technip, VVF…" value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} /></div>
          <div><label className={lblCls}>Invoice No.</label><input className={inpCls} placeholder="Optional" value={form.invoice_no} onChange={e => setForm(f => ({ ...f, invoice_no: e.target.value }))} /></div>
          <div><label className={lblCls}>Amount (₹)</label><input type="number" min="0" className={inpCls} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
          <div><label className={lblCls}>Invoice Date</label><input type="date" className={inpCls} value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} /></div>
          <div><label className={lblCls}>Due Date</label><input type="date" className={inpCls} value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
          <div><label className={lblCls}>Status</label>
            <select className={inpCls} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as InvoiceStatus }))}>
              {INVOICE_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div><label className={lblCls}>Description</label><input className={inpCls} placeholder="Optional" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

interface Props { apiPath: string; title: string; cashflowDepartment: string; deptKey: 'deputation' | 'accentProjects' }

/** Shared base for Accent Deputation + Accent Projects (same shape, different endpoint). */
export default function MonthlyTab({ apiPath, title, cashflowDepartment, deptKey }: Props) {
  const now = new Date();
  const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const [year, setYear] = useState(currentYear);
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const data = useFinanceResource<MonthlyRow>(apiPath);
  const cashflow = useFinanceResource<CashflowTxn>('/api/finance/cashflow');

  /** This department's real turnover (receipts) and expense (payments) per month, from cashflow. */
  const cfByMonth = useMemo(() => {
    const turnover = new Map<string, number>();
    const expense = new Map<string, number>();
    for (const txn of cashflow.rows) {
      if ((txn.department ?? '').toUpperCase() !== cashflowDepartment.toUpperCase()) continue;
      if (!txn.date || !isCountableCashflow(txn)) continue;
      const m = txn.date.substring(0, 7);
      if (txn.type === 'Receipt') turnover.set(m, (turnover.get(m) || 0) + Number(txn.receipt || 0));
      if (txn.type === 'Payment') expense.set(m, (expense.get(m) || 0) + Number(txn.payment || 0));
    }
    return { turnover, expense };
  }, [cashflow.rows, cashflowDepartment]);

  const monthlyTargetOverrides = useMemo(() => {
    const map = new Map<string, MonthlyRow>();
    for (const r of data.rows) map.set(parseMonth(r.month), r);
    return map;
  }, [data.rows]);

  // Every month of the financial year, shown at once — not one row per
  // manual entry, so a month with no manual override still shows real
  // cashflow-derived actuals instead of disappearing.
  const monthlyBreakdown = useMemo(() => {
    return monthsInFinancialYear(year).map(m => {
      const turnoverActual = cfByMonth.turnover.get(m) || 0;
      const expenseActual  = cfByMonth.expense.get(m) || 0;
      const override = monthlyTargetOverrides.get(m);
      const turnoverTarget = DEPT_TURNOVER_TARGETS[deptKey].monthly;
      const expenseTarget = override ? Number(override.target_cost || 0) : turnoverActual * TARGET_EXPENSE_PCT[deptKey];
      const profitActual = turnoverActual - expenseActual;
      const profitTarget = turnoverTarget * TARGET_PROFIT_PCT[deptKey];
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
  }, [year, cfByMonth, monthlyTargetOverrides, deptKey]);

  const [modal, setModal] = useState<{ open: boolean; editing: MonthlyRow | null }>({ open: false, editing: null });
  const [form, setForm]   = useState({ month: '', target_cost: '' });
  const [saving, setSaving] = useState(false);

  const openSetExpenseTarget = (month: string, override?: MonthlyRow) => {
    setForm({ month, target_cost: override ? String(override.target_cost ?? 0) : '' });
    setModal({ open: true, editing: override ?? null });
  };

  const save = async () => {
    setSaving(true);
    try {
      if (!form.target_cost.trim()) {
        if (modal.editing) await data.remove(modal.editing.id);
      } else {
        await data.save(
          { month: form.month.trim(), target_cost: Number(form.target_cost) } as Partial<MonthlyRow>,
          modal.editing,
        );
      }
      setModal({ open: false, editing: null });
    } catch { /* toast */ }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <SectionTitle>{`${title} (${financialYearLabel(year)})`}</SectionTitle>
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
            {data.loading || cashflow.loading ? <TableSkeleton cols={10} /> :
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
                   onDelete={r.override ? () => data.remove(r.override!.id) : undefined}
                 />
               </tr>
             ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={modal.open}
        title={`Set Expense Target — ${form.month ? monthLabel(form.month) : ''}`}
        saving={saving}
        onClose={() => setModal({ open: false, editing: null })}
        onSave={save}
      >
        <div>
          <label className={lblCls}>Expense Target (₹)</label>
          <p className="text-[11px] text-gray-400 mb-1">
            Leave blank to use the default ({(TARGET_EXPENSE_PCT[deptKey] * 100).toFixed(0)}% of that month&apos;s actual turnover).
          </p>
          <input
            type="number"
            min="0"
            className={inpCls}
            value={form.target_cost}
            onChange={e => setForm(f => ({ ...f, target_cost: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}

export function DeputationTab() {
  return (
    <div className="space-y-6">
      <MonthlyTab apiPath="/api/finance/deputation" title="Accent Deputation — Monthly Performance" cashflowDepartment="DEPUTATION ACCENT" deptKey="deputation" />
      <PendingInvoicesSection department="Deputation" />
    </div>
  );
}

export function ProjectsTab() {
  return (
    <div className="space-y-6">
      <MonthlyTab apiPath="/api/finance/projects" title="Accent Projects — Monthly Performance" cashflowDepartment="PROJECT ACCENT" deptKey="accentProjects" />
      <PendingInvoicesSection department="Projects" />
    </div>
  );
}
