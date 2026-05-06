'use client';

import { useCallback, useMemo, useState } from 'react';
import { useFinanceResource } from '../shared/useFinanceResource';
import { Modal, TableHeader, TableSkeleton, EmptyRow, RowActions, TotalRow, thCls, tdCls, tdNum, inpCls, lblCls, trCls, PctBar, downloadCsv } from '../shared/primitives';
import { fmt, pct, todayISO } from '../shared/format';
import type { CbdRow, PendingFee } from '../shared/types';
import { feeRecoveryPriority } from '../shared/predictions';

export default function CbdTab() {
  const cbd  = useFinanceResource<CbdRow>('/api/finance/cbd-performance');
  const fees = useFinanceResource<PendingFee>('/api/finance/pending-fees');

  /* ── CBD modal ───────────────────────────────────── */
  const [modal, setModal] = useState<{ open: boolean; editing: CbdRow | null }>({ open: false, editing: null });
  const [form, setForm]   = useState({ programme: '', frequency: '', target_students: '', achieved_students: '', fees_target: '', fees_received: '' });
  const [saving, setSaving] = useState(false);

  const openAdd = useCallback(() => {
    setForm({ programme: '', frequency: '', target_students: '', achieved_students: '', fees_target: '', fees_received: '' });
    setModal({ open: true, editing: null });
  }, []);
  const openEdit = useCallback((r: CbdRow) => {
    setForm({
      programme: r.programme,
      frequency: String(r.frequency),
      target_students: String(r.target_students),
      achieved_students: String(r.achieved_students),
      fees_target: String(r.fees_target),
      fees_received: String(r.fees_received),
    });
    setModal({ open: true, editing: r });
  }, []);
  const save = useCallback(async () => {
    setSaving(true);
    try {
      await cbd.save({
        programme: form.programme.trim(),
        frequency: Number(form.frequency),
        target_students: Number(form.target_students),
        achieved_students: Number(form.achieved_students),
        fees_target: Number(form.fees_target),
        fees_received: Number(form.fees_received),
      } as Partial<CbdRow>, modal.editing);
      setModal({ open: false, editing: null });
    } catch { /* toast */ }
    setSaving(false);
  }, [cbd, form, modal.editing]);

  /* ── Pending Fees modal + filters ────────────────── */
  const [feeModal, setFeeModal] = useState<{ open: boolean; editing: PendingFee | null }>({ open: false, editing: null });
  const [feeForm, setFeeForm]   = useState({ student_name: '', batch: '', total_fees: '', paid: '', due_date: '' });
  const [savingF, setSavingF]   = useState(false);
  const [feeSearch, setFeeSearch] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const openAddFee = useCallback(() => {
    setFeeForm({ student_name: '', batch: '', total_fees: '', paid: '', due_date: '' });
    setFeeModal({ open: true, editing: null });
  }, []);
  const openEditFee = useCallback((r: PendingFee) => {
    setFeeForm({
      student_name: r.student_name,
      batch: r.batch,
      total_fees: String(r.total_fees),
      paid: String(r.paid),
      due_date: r.due_date ?? '',
    });
    setFeeModal({ open: true, editing: r });
  }, []);
  const saveFee = useCallback(async () => {
    setSavingF(true);
    try {
      await fees.save({
        student_name: feeForm.student_name.trim(),
        batch: feeForm.batch.trim(),
        total_fees: Number(feeForm.total_fees),
        paid: Number(feeForm.paid),
        due_date: feeForm.due_date || null,
      } as Partial<PendingFee>, feeModal.editing);
      setFeeModal({ open: false, editing: null });
    } catch { /* toast */ }
    setSavingF(false);
  }, [fees, feeForm, feeModal.editing]);

  const today = todayISO();
  const filteredFees = useMemo(() => {
    const q = feeSearch.trim().toLowerCase();
    return fees.rows.filter(r => {
      if (q && !(`${r.student_name} ${r.batch}`).toLowerCase().includes(q)) return false;
      if (overdueOnly) {
        const pending = Math.max(0, Number(r.total_fees) - Number(r.paid));
        if (pending <= 0) return false;
        if (!r.due_date) return false;
        if (r.due_date >= today) return false;
      }
      return true;
    });
  }, [fees.rows, feeSearch, overdueOnly, today]);

  const exportFees = useCallback(() => {
    downloadCsv(`pending-fees-${today}.csv`, filteredFees.map(r => ({
      Student: r.student_name,
      Batch: r.batch,
      'Total Fees': r.total_fees,
      Paid: r.paid,
      Pending: Math.max(0, Number(r.total_fees) - Number(r.paid)),
      'Due Date': r.due_date ?? '',
    })));
  }, [filteredFees, today]);

  // Priority-scored list — run against all fee rows (not just filtered) so ranking is global
  const priorityMap = useMemo(() => {
    const items = feeRecoveryPriority(fees.rows, today);
    return new Map(items.map(item => [(item.row as PendingFee).id, item]));
  }, [fees.rows, today]);

  return (
    <div className="space-y-6">
      <div>
        <TableHeader title="CBD / Inhouse Training — Yearly Performance" onAdd={openAdd} />
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead><tr className="bg-[#2E3093]">
              <th className={thCls}>Training Programme Name</th>
              <th className={`${thCls} text-center`}>Frequency</th>
              <th className={`${thCls} text-center`}>Target Students</th>
              <th className={`${thCls} text-center`}>Achieved Students</th>
              <th className={`${thCls} text-center`}>Fees Target (₹)</th>
              <th className={`${thCls} text-center`}>Fees Received (₹)</th>
              <th className={`${thCls} text-center`}>%age</th>
              <th className={`${thCls} text-center`}>Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {cbd.loading ? <TableSkeleton cols={8} /> :
               cbd.rows.length === 0 ? <EmptyRow cols={8} /> :
               cbd.rows.map((r, i) => (
                <tr key={r.id} className={trCls(i)}>
                  <td className={tdCls}>{r.programme}</td>
                  <td className={tdNum}>{r.frequency}</td>
                  <td className={tdNum}>{r.target_students}</td>
                  <td className={tdNum}>{r.achieved_students}</td>
                  <td className={tdNum}>{fmt(r.fees_target)}</td>
                  <td className={tdNum}>{fmt(r.fees_received)}</td>
                  <td className={tdNum}><PctBar value={r.fees_received} denominator={r.fees_target} /></td>
                  <RowActions onEdit={() => openEdit(r)} onDelete={() => cbd.remove(r.id)} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <TableHeader
          title="Pending Fees"
          onAdd={openAddFee}
          extra={
            <>
              <input
                type="text"
                placeholder="Search…"
                value={feeSearch}
                onChange={e => setFeeSearch(e.target.value)}
                className="text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 w-44 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
              />
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 cursor-pointer">
                <input type="checkbox" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)} className="rounded text-[#2E3093] focus:ring-[#2E3093]/30" />
                Overdue only
              </label>
              <button
                onClick={exportFees}
                disabled={filteredFees.length === 0}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Export
              </button>
            </>
          }
        />
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead><tr className="bg-[#2E3093]">
              <th className={thCls}>Student Name</th>
              <th className={thCls}>Batch / Programme</th>
              <th className={`${thCls} text-center`}>Total Fees (₹)</th>
              <th className={`${thCls} text-center`}>Paid (₹)</th>
              <th className={`${thCls} text-center`}>Pending (₹)</th>
              <th className={`${thCls} text-center`}>Due Date</th>
              <th className={`${thCls} text-center`}>Recovery Priority</th>
              <th className={`${thCls} text-center`}>Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {fees.loading ? <TableSkeleton cols={7} /> :
               filteredFees.length === 0 ? <EmptyRow cols={7} message={fees.rows.length === 0 ? undefined : 'No matches for current filter'} /> :
               filteredFees.map((r, i) => {
                 const pending = Math.max(0, Number(r.total_fees) - Number(r.paid));
                 const overdue = !!r.due_date && r.due_date < today && pending > 0;
                 const pri = priorityMap.get(r.id);
                 return (
                   <tr key={r.id} className={overdue ? 'bg-red-50/60 hover:bg-red-50 transition-colors' : trCls(i)}>
                     <td className={tdCls}>{r.student_name}</td>
                     <td className={tdCls}>{r.batch}</td>
                     <td className={tdNum}>{fmt(r.total_fees)}</td>
                     <td className={tdNum}>{fmt(r.paid)}</td>
                     <td className={`${tdNum} ${pending > 0 ? 'text-red-600 font-medium' : ''}`}>{fmt(pending)}</td>
                     <td className={`${tdNum} ${overdue ? 'text-red-600 font-medium' : ''}`}>{r.due_date || '—'}</td>
                     <td className={tdNum}>
                       {pri ? (
                         <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                           pri.priority === 'HIGH'   ? 'bg-red-100 text-red-700 ring-1 ring-red-200' :
                           pri.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' :
                                                       'bg-gray-100 text-gray-500'
                         }`}>
                           {pri.priority === 'HIGH' ? '⚠️' : pri.priority === 'MEDIUM' ? '●' : ''} {pri.priority}
                           {pri.daysOverdue > 0 && <span className="ml-1 opacity-70">{pri.daysOverdue}d</span>}
                         </span>
                       ) : <span className="text-[10px] text-gray-400">—</span>}
                     </td>
                     <RowActions onEdit={() => openEditFee(r)} onDelete={() => fees.remove(r.id)} />
                   </tr>
                 );
              })}
              {filteredFees.length > 0 && (
                <TotalRow>
                  <td colSpan={2} className="px-3 py-2 text-xs text-[#2E3093]">Total ({filteredFees.length})</td>
                  <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{fmt(filteredFees.reduce((s, r) => s + Number(r.total_fees), 0))}</td>
                  <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{fmt(filteredFees.reduce((s, r) => s + Number(r.paid), 0))}</td>
                  <td className="px-3 py-2 text-xs text-center text-red-600">{fmt(filteredFees.reduce((s, r) => s + Math.max(0, Number(r.total_fees) - Number(r.paid)), 0))}</td>
                  <td colSpan={2} />
                </TotalRow>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modal.open}
        title={modal.editing ? 'Edit Training Record' : 'Add Training Record'}
        saving={saving}
        onClose={() => setModal({ open: false, editing: null })}
        onSave={save}
      >
        <div><label className={lblCls}>Training Programme Name</label><input className={inpCls} value={form.programme} onChange={e => setForm(f => ({ ...f, programme: e.target.value }))} /></div>
        <div><label className={lblCls}>Frequency Conducted</label><input type="number" min="0" className={inpCls} value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Target Students</label><input type="number" min="0" className={inpCls} value={form.target_students} onChange={e => setForm(f => ({ ...f, target_students: e.target.value }))} /></div>
          <div><label className={lblCls}>Achieved Students</label><input type="number" min="0" className={inpCls} value={form.achieved_students} onChange={e => setForm(f => ({ ...f, achieved_students: e.target.value }))} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Fees Target (₹)</label><input type="number" min="0" className={inpCls} value={form.fees_target} onChange={e => setForm(f => ({ ...f, fees_target: e.target.value }))} /></div>
          <div><label className={lblCls}>Fees Received (₹)</label><input type="number" min="0" className={inpCls} value={form.fees_received} onChange={e => setForm(f => ({ ...f, fees_received: e.target.value }))} /></div>
        </div>
      </Modal>

      <Modal
        open={feeModal.open}
        title={feeModal.editing ? 'Edit Pending Fee' : 'Add Pending Fee'}
        saving={savingF}
        onClose={() => setFeeModal({ open: false, editing: null })}
        onSave={saveFee}
      >
        <div><label className={lblCls}>Student Name</label><input className={inpCls} value={feeForm.student_name} onChange={e => setFeeForm(f => ({ ...f, student_name: e.target.value }))} /></div>
        <div><label className={lblCls}>Batch / Programme</label><input className={inpCls} value={feeForm.batch} onChange={e => setFeeForm(f => ({ ...f, batch: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Total Fees (₹)</label><input type="number" min="0" className={inpCls} value={feeForm.total_fees} onChange={e => setFeeForm(f => ({ ...f, total_fees: e.target.value }))} /></div>
          <div><label className={lblCls}>Paid (₹)</label><input type="number" min="0" className={inpCls} value={feeForm.paid} onChange={e => setFeeForm(f => ({ ...f, paid: e.target.value }))} /></div>
        </div>
        <div><label className={lblCls}>Due Date</label><input type="date" className={inpCls} value={feeForm.due_date} onChange={e => setFeeForm(f => ({ ...f, due_date: e.target.value }))} /></div>
      </Modal>
    </div>
  );
}
