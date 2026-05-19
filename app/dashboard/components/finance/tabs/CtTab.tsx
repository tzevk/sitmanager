'use client';

import { useCallback, useMemo, useState } from 'react';
import { useFinanceResource } from '../shared/useFinanceResource';
import { Modal, TableHeader, TableSkeleton, EmptyRow, RowActions, TotalRow, SectionTitle, thCls, tdCls, tdNum, inpCls, lblCls, trCls, PctBar } from '../shared/primitives';
import { fmt } from '../shared/format';
import type { CtRow } from '../shared/types';

interface CtYearlyRow {
  id: number;
  training_name: string;
  duration_of_program: string | null;
  frequency_conducted: number;
  target_frequency_batches: number;
  min_students_per_batch: number;
  students_admitted_yearly: number;
  yearly_students_target: number;
}

export default function CtTab() {
  /* ── Yearly table ── */
  const yearly = useFinanceResource<CtYearlyRow>('/api/finance/ct-yearly');

  const [yearlyModal, setYearlyModal] = useState<{ open: boolean; editing: CtYearlyRow | null }>({ open: false, editing: null });
  const [yearlyForm, setYearlyForm] = useState({
    training_name: '',
    duration_of_program: '',
    frequency_conducted: '',
    target_frequency_batches: '',
    min_students_per_batch: '',
    students_admitted_yearly: '',
    yearly_students_target: '',
  });
  const [yearlySaving, setYearlySaving] = useState(false);

  const openYearlyAdd = useCallback(() => {
    setYearlyForm({ training_name: '', duration_of_program: '', frequency_conducted: '', target_frequency_batches: '', min_students_per_batch: '', students_admitted_yearly: '', yearly_students_target: '' });
    setYearlyModal({ open: true, editing: null });
  }, []);

  const openYearlyEdit = useCallback((r: CtYearlyRow) => {
    setYearlyForm({
      training_name: r.training_name ?? '',
      duration_of_program: r.duration_of_program ?? '',
      frequency_conducted: String(r.frequency_conducted ?? 0),
      target_frequency_batches: String(r.target_frequency_batches ?? 0),
      min_students_per_batch: String(r.min_students_per_batch ?? 0),
      students_admitted_yearly: String(r.students_admitted_yearly ?? 0),
      yearly_students_target: String(r.yearly_students_target ?? 0),
    });
    setYearlyModal({ open: true, editing: r });
  }, []);

  const saveYearly = useCallback(async () => {
    setYearlySaving(true);
    try {
      await yearly.save({
        training_name: yearlyForm.training_name.trim(),
        duration_of_program: yearlyForm.duration_of_program.trim() || null,
        frequency_conducted: Number(yearlyForm.frequency_conducted),
        target_frequency_batches: Number(yearlyForm.target_frequency_batches),
        min_students_per_batch: Number(yearlyForm.min_students_per_batch),
        students_admitted_yearly: Number(yearlyForm.students_admitted_yearly),
        yearly_students_target: Number(yearlyForm.yearly_students_target),
      } as Partial<CtYearlyRow>, yearlyModal.editing);
      setYearlyModal({ open: false, editing: null });
    } catch { /* toast */ }
    setYearlySaving(false);
  }, [yearly, yearlyForm, yearlyModal.editing]);

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

  return (
    <div className="space-y-6">
      {/* ── Yearly Performance ── */}
      <div>
        <TableHeader title="Corporate Training — Yearly Performance" onAdd={openYearlyAdd} />
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead><tr className="bg-[#2E3093]">
              <th className={thCls}>Training Program Name</th>
              <th className={thCls}>Duration</th>
              <th className={`${thCls} text-center`}>Freq. Conducted</th>
              <th className={`${thCls} text-center`}>Target Freq. (Batches)</th>
              <th className={`${thCls} text-center`}>Min Students / Batch</th>
              <th className={`${thCls} text-center`}>Students Admitted</th>
              <th className={`${thCls} text-center`}>Yearly Target</th>
              <th className={`${thCls} text-center`}>% Achievement</th>
              <th className={`${thCls} text-center`}>Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {yearly.loading ? <TableSkeleton cols={9} /> :
               yearly.rows.length === 0 ? <EmptyRow cols={9} /> :
               yearly.rows.map((r, i) => {
                 const target = Number(r.yearly_students_target) || (Number(r.target_frequency_batches) * Number(r.min_students_per_batch));
                 const admitted = Number(r.students_admitted_yearly) || 0;
                 const pct = target > 0 ? (admitted / target) * 100 : 0;
                 return (
                   <tr key={r.id} className={trCls(i)}>
                     <td className={tdCls}>{r.training_name}</td>
                     <td className={tdCls}>{r.duration_of_program || '—'}</td>
                     <td className={tdNum}>{r.frequency_conducted}</td>
                     <td className={tdNum}>{r.target_frequency_batches}</td>
                     <td className={tdNum}>{r.min_students_per_batch}</td>
                     <td className={tdNum}>{admitted.toLocaleString('en-IN')}</td>
                     <td className={tdNum}>{target.toLocaleString('en-IN')}</td>
                     <td className={tdNum}><PctBar value={pct} denominator={100} /></td>
                     <RowActions onEdit={() => openYearlyEdit(r)} onDelete={() => yearly.remove(r.id)} />
                   </tr>
                 );
               })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Monthly Performance ── */}
      <div>
        <TableHeader title="Corporate Training — Monthly Performance" onAdd={openAdd} />
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
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
            <tbody className="divide-y divide-gray-100">
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

      {/* ── Yearly record modal ── */}
      <Modal
        open={yearlyModal.open}
        title={yearlyModal.editing ? 'Edit Yearly CT Record' : 'Add Yearly CT Record'}
        saving={yearlySaving}
        onClose={() => setYearlyModal({ open: false, editing: null })}
        onSave={saveYearly}
      >
        <div>
          <label className={lblCls}>Training Program Name</label>
          <input className={inpCls} value={yearlyForm.training_name} onChange={e => setYearlyForm(f => ({ ...f, training_name: e.target.value }))} />
        </div>
        <div>
          <label className={lblCls}>Duration of Program</label>
          <input className={inpCls} placeholder="e.g. 3 Days" value={yearlyForm.duration_of_program} onChange={e => setYearlyForm(f => ({ ...f, duration_of_program: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lblCls}>Frequency Conducted</label>
            <input type="number" min="0" className={inpCls} value={yearlyForm.frequency_conducted} onChange={e => setYearlyForm(f => ({ ...f, frequency_conducted: e.target.value }))} />
          </div>
          <div>
            <label className={lblCls}>Target Frequency (Batches)</label>
            <input type="number" min="0" className={inpCls} value={yearlyForm.target_frequency_batches} onChange={e => setYearlyForm(f => ({ ...f, target_frequency_batches: e.target.value }))} />
          </div>
          <div>
            <label className={lblCls}>Min Students per Batch</label>
            <input type="number" min="0" className={inpCls} value={yearlyForm.min_students_per_batch} onChange={e => setYearlyForm(f => ({ ...f, min_students_per_batch: e.target.value }))} />
          </div>
          <div>
            <label className={lblCls}>Students Admitted Yearly</label>
            <input type="number" min="0" className={inpCls} value={yearlyForm.students_admitted_yearly} onChange={e => setYearlyForm(f => ({ ...f, students_admitted_yearly: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className={lblCls}>Yearly Students Target</label>
          <input type="number" min="0" className={inpCls} value={yearlyForm.yearly_students_target} onChange={e => setYearlyForm(f => ({ ...f, yearly_students_target: e.target.value }))} />
        </div>
      </Modal>

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
    </div>
  );
}
