'use client';

import { useCallback, useMemo, useState } from 'react';
import { useFinanceResource } from '../shared/useFinanceResource';
import { Modal, TableHeader, TableSkeleton, EmptyRow, RowActions, TotalRow, thCls, tdCls, tdNum, inpCls, lblCls, trCls, PctBar } from '../shared/primitives';
import { fmt, pct, monthLabel, parseMonth, fmtDate } from '../shared/format';
import type { MonthlyRow, CashflowTxn, PendingInvoice, InvoiceStatus } from '../shared/types';
import { targetAttainmentTrend } from '../shared/predictions';

const INVOICE_STATUSES: InvoiceStatus[] = ['Pending', 'Paid', 'Overdue'];

function PendingInvoicesSection() {
  const invoices = useFinanceResource<PendingInvoice>('/api/finance/pending-invoices');

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
      await invoices.save({ client_name: form.client_name.trim(), invoice_no: form.invoice_no.trim() || null, amount: Number(form.amount), invoice_date: form.invoice_date || null, due_date: form.due_date || null, status: form.status, description: form.description.trim() || null } as Partial<PendingInvoice>, modal.editing);
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

interface Props { apiPath: string; title: string; cashflowDepartment: string }

/** Shared base for Accent Deputation + Accent Projects (same shape, different endpoint). */
export default function MonthlyTab({ apiPath, title, cashflowDepartment }: Props) {
  const data = useFinanceResource<MonthlyRow>(apiPath);
  const cashflow = useFinanceResource<CashflowTxn>('/api/finance/cashflow');

  const [modal, setModal] = useState<{ open: boolean; editing: MonthlyRow | null }>({ open: false, editing: null });
  const [form, setForm]   = useState({ month: '', target_cost: '' });
  const [saving, setSaving] = useState(false);

  /** Sum of cashflow payments for this department per month (YYYY-MM). */
  const cashflowActualByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const txn of cashflow.rows) {
      if ((txn.department ?? '').toUpperCase() !== cashflowDepartment.toUpperCase()) continue;
      if (txn.type !== 'Payment') continue;
      if (!txn.date) continue;
      const m = txn.date.substring(0, 7);
      map.set(m, (map.get(m) || 0) + Number(txn.payment || 0));
    }
    return map;
  }, [cashflow.rows, cashflowDepartment]);

  const openAdd = useCallback(() => {
    setForm({ month: '', target_cost: '' });
    setModal({ open: true, editing: null });
  }, []);
  const openEdit = useCallback((r: MonthlyRow) => {
    setForm({
      month: parseMonth(r.month),
      target_cost: String(r.target_cost),
    });
    setModal({ open: true, editing: r });
  }, []);
  const save = useCallback(async () => {
    setSaving(true);
    try {
      await data.save({
        month: form.month,
        target_cost: Number(form.target_cost),
      } as Partial<MonthlyRow>, modal.editing);
      setModal({ open: false, editing: null });
    } catch { /* toast */ }
    setSaving(false);
  }, [data, form, modal.editing]);

  const sortedRows = useMemo(() => {
    return [...data.rows].sort((a, b) => parseMonth(b.month).localeCompare(parseMonth(a.month)));
  }, [data.rows]);

  const totals = useMemo(() => ({
    actual: sortedRows.reduce((s, r) => s + (cashflowActualByMonth.get(parseMonth(r.month)) || 0), 0),
    target: sortedRows.reduce((s, r) => s + Number(r.target_cost || 0), 0),
  }), [sortedRows, cashflowActualByMonth]);

  const attainmentTrend = useMemo(() =>
    targetAttainmentTrend(
      [...sortedRows]
        .sort((a, b) => parseMonth(a.month).localeCompare(parseMonth(b.month)))
        .map(r => ({ actual: cashflowActualByMonth.get(parseMonth(r.month)) || 0, target: Number(r.target_cost) }))
    ),
    [sortedRows, cashflowActualByMonth]
  );

  const trendColor = attainmentTrend?.direction === 'improving' ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                   : attainmentTrend?.direction === 'declining'  ? 'text-red-600 bg-red-50 border-red-200'
                   : 'text-amber-700 bg-amber-50 border-amber-200';
  const trendIcon  = attainmentTrend?.direction === 'improving' ? '↑' : attainmentTrend?.direction === 'declining' ? '↓' : '→';

  return (
    <div className="space-y-4">
      <TableHeader title={title} onAdd={openAdd} />

      {attainmentTrend && (
        <div className={`flex flex-wrap items-center gap-4 rounded-xl border px-4 py-3 text-xs ${trendColor}`}>
          <span className="flex items-center gap-1.5 font-semibold">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AI Trend Insight
          </span>
          <span>Latest: <strong>{attainmentTrend.latestPct.toFixed(1)}%</strong></span>
          <span>Avg: <strong>{attainmentTrend.avgPct.toFixed(1)}%</strong></span>
          <span>Trend: <strong>{trendIcon} {attainmentTrend.direction}</strong> ({attainmentTrend.slopePerPeriod > 0 ? '+' : ''}{attainmentTrend.slopePerPeriod.toFixed(1)}pp/mo)</span>
          <span>Next month forecast: <strong>{attainmentTrend.nextPeriodForecast.toFixed(1)}%</strong></span>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full border-separate border-spacing-0">
          <thead><tr className="bg-[#2E3093]">
            <th className={thCls}>Month</th>
            <th className={`${thCls} text-center`}>Actual Cost (₹)</th>
            <th className={`${thCls} text-center`}>Targeted Cost (₹)</th>
            <th className={`${thCls} text-center`}>%age</th>
            <th className={`${thCls} text-center`}>Actions</th>
          </tr></thead>
          <tbody>
            {data.loading ? <TableSkeleton cols={5} /> :
             sortedRows.length === 0 ? <EmptyRow cols={5} /> :
             sortedRows.map((r, i) => {
              const actualCost = cashflowActualByMonth.get(parseMonth(r.month)) || 0;
              return (
                <tr key={r.id} className={trCls(i)}>
                  <td className={tdCls}>{monthLabel(parseMonth(r.month))}</td>
                  <td className={tdNum}>{fmt(actualCost)}</td>
                  <td className={tdNum}>{fmt(r.target_cost)}</td>
                  <td className={tdNum}><PctBar value={actualCost} denominator={r.target_cost} /></td>
                  <RowActions onEdit={() => openEdit(r)} onDelete={() => data.remove(r.id)} />
                </tr>
              );
            })}
            {sortedRows.length > 0 && (
              <TotalRow>
                <td className="px-3 py-2 text-xs text-[#2E3093]">Total</td>
                <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{fmt(totals.actual)}</td>
                <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{fmt(totals.target)}</td>
                <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{pct(totals.actual, totals.target)}</td>
                <td />
              </TotalRow>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={modal.open}
        title={modal.editing ? 'Edit Record' : 'Add Record'}
        saving={saving}
        onClose={() => setModal({ open: false, editing: null })}
        onSave={save}
      >
        <div><label className={lblCls}>Month</label><input type="month" className={inpCls} value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} /></div>
        <div>
          <label className={lblCls}>Targeted Cost (₹)</label>
          <input type="number" min="0" className={inpCls} value={form.target_cost} onChange={e => setForm(f => ({ ...f, target_cost: e.target.value }))} />
        </div>
      </Modal>
    </div>
  );
}

export function DeputationTab() {
  return <MonthlyTab apiPath="/api/finance/deputation" title="Accent Deputation — Monthly Performance" cashflowDepartment="DEPUTATION ACCENT" />;
}

export function ProjectsTab() {
  return (
    <div className="space-y-6">
      <MonthlyTab apiPath="/api/finance/projects" title="Accent Projects — Monthly Performance" cashflowDepartment="PROJECT ACCENT" />
      <PendingInvoicesSection />
    </div>
  );
}
