'use client';

import { useCallback, useMemo, useState } from 'react';
import { useFinanceResource } from '../shared/useFinanceResource';
import { Modal, TableHeader, TableSkeleton, EmptyRow, RowActions, TotalRow, thCls, tdCls, tdNum, inpCls, lblCls, trCls, PctBar } from '../shared/primitives';
import { fmt, pct, monthLabel, parseMonth } from '../shared/format';
import type { MonthlyRow } from '../shared/types';
import { targetAttainmentTrend } from '../shared/predictions';

interface Props { apiPath: string; title: string }

/** Shared base for Accent Deputation + Accent Projects (same shape, different endpoint). */
export default function MonthlyTab({ apiPath, title }: Props) {
  const data = useFinanceResource<MonthlyRow>(apiPath);

  const [modal, setModal] = useState<{ open: boolean; editing: MonthlyRow | null }>({ open: false, editing: null });
  const [form, setForm]   = useState({ month: '', actual_cost: '', target_cost: '' });
  const [saving, setSaving] = useState(false);

  const openAdd = useCallback(() => {
    setForm({ month: '', actual_cost: '', target_cost: '' });
    setModal({ open: true, editing: null });
  }, []);
  const openEdit = useCallback((r: MonthlyRow) => {
    setForm({
      month: parseMonth(r.month),
      actual_cost: String(r.actual_cost),
      target_cost: String(r.target_cost),
    });
    setModal({ open: true, editing: r });
  }, []);
  const save = useCallback(async () => {
    setSaving(true);
    try {
      await data.save({
        month: form.month,
        actual_cost: Number(form.actual_cost),
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
    actual: sortedRows.reduce((s, r) => s + Number(r.actual_cost || 0), 0),
    target: sortedRows.reduce((s, r) => s + Number(r.target_cost || 0), 0),
  }), [sortedRows]);

  const attainmentTrend = useMemo(() =>
    targetAttainmentTrend(
      [...sortedRows]
        .sort((a, b) => parseMonth(a.month).localeCompare(parseMonth(b.month)))
        .map(r => ({ actual: Number(r.actual_cost), target: Number(r.target_cost) }))
    ),
    [sortedRows]
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
        <table className="w-full border-collapse">
          <thead><tr className="bg-[#2E3093]">
            <th className={thCls}>Month</th>
            <th className={`${thCls} text-center`}>Actual Cost (₹)</th>
            <th className={`${thCls} text-center`}>Targeted Cost (₹)</th>
            <th className={`${thCls} text-center`}>%age</th>
            <th className={`${thCls} text-center`}>Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {data.loading ? <TableSkeleton cols={5} /> :
             sortedRows.length === 0 ? <EmptyRow cols={5} /> :
             sortedRows.map((r, i) => (
              <tr key={r.id} className={trCls(i)}>
                <td className={tdCls}>{monthLabel(parseMonth(r.month))}</td>
                <td className={tdNum}>{fmt(r.actual_cost)}</td>
                <td className={tdNum}>{fmt(r.target_cost)}</td>
                <td className={tdNum}><PctBar value={r.actual_cost} denominator={r.target_cost} /></td>
                <RowActions onEdit={() => openEdit(r)} onDelete={() => data.remove(r.id)} />
              </tr>
            ))}
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
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Actual Cost (₹)</label><input type="number" min="0" className={inpCls} value={form.actual_cost} onChange={e => setForm(f => ({ ...f, actual_cost: e.target.value }))} /></div>
          <div><label className={lblCls}>Targeted Cost (₹)</label><input type="number" min="0" className={inpCls} value={form.target_cost} onChange={e => setForm(f => ({ ...f, target_cost: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

export function DeputationTab() {
  return <MonthlyTab apiPath="/api/finance/deputation" title="Accent Deputation — Monthly Performance" />;
}

export function ProjectsTab() {
  return <MonthlyTab apiPath="/api/finance/projects" title="Accent Projects — Monthly Performance" />;
}
