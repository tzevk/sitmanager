'use client';

import { useCallback, useMemo, useState } from 'react';
import { useFinanceResource } from '../shared/useFinanceResource';
import { Modal, TableHeader, TableSkeleton, EmptyRow, RowActions, TotalRow, SectionTitle, thCls, tdCls, tdNum, inpCls, lblCls, trCls, downloadCsv } from '../shared/primitives';
import { fmt, todayISO } from '../shared/format';
import type { CashflowTxn, CashflowType, CashflowEntity } from '../shared/types';
import CashflowCategoryBars from '../charts/CashflowCategoryBars';
import { detectCashflowAnomalies, categoryMoMGrowth } from '../shared/predictions';

const CF_TYPES: CashflowType[]     = ['Payment', 'Receipt'];
const CF_ENTITIES: CashflowEntity[] = ['Suvidya', 'SIT Alumni', 'Accent', 'ATS'];

const SIT_CATS = [
  'OD Interest / Loan EMI',
  'Management Car Expenses',
  'Management Salary',
  'Employee Salary',
  'Trainers Payment',
  'Food',
  'Utility',
  'Marketing - SIT',
  'Travelling Expense - Staff (Marketing)',
  'Software',
  'Stationary',
  'Infrastructure',
  'Taxes',
];

const ACCENT_CATS = [
  'OD Interest / Loan EMI',
  'Management Car Expenses',
  'Management Salary',
  'Employee Salary',
  'Trainers Payment',
  'Food',
  'Utility',
  'Marketing - Accent',
  'Travelling Expense - Staff (Marketing)',
  'Software',
  'Stationary',
  'Infrastructure',
  'Taxes',
];

const ALL_CATS = Array.from(new Set([...SIT_CATS, ...ACCENT_CATS]));

function catsFor(entity: CashflowEntity | ''): string[] {
  if (entity === 'Accent') return ACCENT_CATS;
  if (entity === 'SIT' || entity === 'Suvidya' || entity === 'SIT Alumni' || entity === 'ATS') return SIT_CATS;
  return ALL_CATS;
}

export default function CashflowTab() {
  const [search, setSearch] = useState('');
  const [entity, setEntity] = useState<'' | CashflowEntity>('');
  const [type, setType]     = useState<'' | CashflowType>('');
  const [category, setCat]  = useState('');
  const [dateFrom, setFrom] = useState('');
  const [dateTo, setTo]     = useState('');

  // Build query string for server-side filtering — only applies if backend supports it,
  // otherwise the client-side filter below catches it too.
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (search)   p.set('q', search);
    if (entity)   p.set('entity', entity);
    if (type)     p.set('type', type);
    if (category) p.set('category', category);
    if (dateFrom) p.set('dateFrom', dateFrom);
    if (dateTo)   p.set('dateTo', dateTo);
    return p.toString();
  }, [search, entity, type, category, dateFrom, dateTo]);

  const cash = useFinanceResource<CashflowTxn>('/api/finance/cashflow', { query: query || undefined });

  /* ── modal ──────────────────────────────────────── */
  const [modal, setModal] = useState<{ open: boolean; editing: CashflowTxn | null }>({ open: false, editing: null });
  const [form, setForm]   = useState({ date: '', entity: 'Suvidya' as CashflowEntity, type: 'Payment' as CashflowType, category: SIT_CATS[0], description: '', payment: '', receipt: '', ref_no: '' });
  const [saving, setSaving] = useState(false);

  const openAdd = useCallback(() => {
    setForm({ date: todayISO(), entity: 'Suvidya', type: 'Payment', category: SIT_CATS[0], description: '', payment: '', receipt: '', ref_no: '' });
    setModal({ open: true, editing: null });
  }, []);
  const openEdit = useCallback((r: CashflowTxn) => {
    setForm({
      date: r.date ?? '',
      entity: r.entity ?? 'SIT',
      type: r.type,
      category: r.category,
      description: r.description ?? '',
      payment: String(r.payment),
      receipt: String(r.receipt),
      ref_no: r.ref_no ?? '',
    });
    setModal({ open: true, editing: r });
  }, []);
  const save = useCallback(async () => {
    setSaving(true);
    try {
      await cash.save({
        date: form.date,
        entity: form.entity,
        type: form.type,
        category: form.category,
        description: form.description.trim(),
        payment: Number(form.payment),
        receipt: Number(form.receipt),
        ref_no: form.ref_no.trim(),
      } as Partial<CashflowTxn>, modal.editing);
      setModal({ open: false, editing: null });
    } catch { /* toast */ }
    setSaving(false);
  }, [cash, form, modal.editing]);

  /* ── client-side filtering (defensive — works whether or not API filters) */
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cash.rows.filter(r => {
      if (q && !`${r.description ?? ''} ${r.ref_no ?? ''} ${r.category}`.toLowerCase().includes(q)) return false;
      if (entity   && (r.entity ?? 'SIT') !== entity) return false;
      if (type     && r.type     !== type)             return false;
      if (category && r.category !== category)         return false;
      if (dateFrom && (r.date ?? '') < dateFrom)       return false;
      if (dateTo   && (r.date ?? '') > dateTo)         return false;
      return true;
    });
  }, [cash.rows, search, entity, type, category, dateFrom, dateTo]);

  /* ── memoised aggregates ────────────────────────── */
  const totals = useMemo(() => ({
    payment: filteredRows.reduce((s, r) => s + Number(r.payment || 0), 0),
    receipt: filteredRows.reduce((s, r) => s + Number(r.receipt || 0), 0),
  }), [filteredRows]);


  /* ── CSV export ─────────────────────────────────── */
  const handleExport = useCallback(() => {
    downloadCsv(`cashflow-${todayISO()}.csv`, filteredRows.map(r => ({
      Date: r.date ?? '',
      Company: r.entity ?? '',
      Type: r.type,
      Category: r.category,
      Description: r.description ?? '',
      Payment: r.payment,
      Receipt: r.receipt,
      Ref: r.ref_no ?? '',
    })));
  }, [filteredRows]);

  const companySummary = useMemo(() => {
    const map = new Map<string, { entity: string; payment: number; receipt: number }>();
    for (const r of filteredRows) {
      const e = r.entity ?? 'Suvidya';
      const cur = map.get(e) ?? { entity: e, payment: 0, receipt: 0 };
      cur.payment += Number(r.payment || 0);
      cur.receipt += Number(r.receipt || 0);
      map.set(e, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.entity.localeCompare(b.entity));
  }, [filteredRows]);

  const handleClear = useCallback(() => {
    setSearch(''); setEntity(''); setType(''); setCat(''); setFrom(''); setTo('');
  }, []);

  // Anomaly detection runs on ALL rows (not filtered) to maintain statistical validity
  const anomalies = useMemo(() => detectCashflowAnomalies(cash.rows), [cash.rows]);
  const momGrowth = useMemo(() => categoryMoMGrowth(cash.rows), [cash.rows]);

  // Map anomaly transaction ids for O(1) lookup in the table
  const anomalySet = useMemo(() => {
    const s = new Set<number>();
    for (const a of anomalies) {
      cash.rows.forEach(r => {
        if (r.date === a.date && r.payment === a.amount && r.category === a.category) s.add(r.id);
      });
    }
    return s;
  }, [anomalies, cash.rows]);

  return (
    <div className="space-y-6">
      <div>
        <TableHeader title="Payments & Receipts" onAdd={openAdd} />

        {/* Filter bar */}
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 mb-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#2E3093]">Filters</span>
            <div className="flex gap-2">
              <button onClick={handleClear} className="px-3 py-1.5 text-[11px] font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Clear</button>
              <button onClick={handleExport} disabled={filteredRows.length === 0}
                className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-[#2E3093] text-white hover:bg-[#252880] disabled:opacity-50 transition-colors">Export CSV</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[10px] text-gray-400 mb-0.5">Search</label>
              <input type="text" placeholder="Description, ref, category…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]" />
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-0.5">Company</label>
              <select value={entity} onChange={e => setEntity((e.target.value || '') as '' | CashflowEntity)}
                className="text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 w-32 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]">
                <option value="">All companies</option>
                {CF_ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-0.5">Type</label>
              <select value={type} onChange={e => setType((e.target.value || '') as '' | CashflowType)}
                className="text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 w-28 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]">
                <option value="">All types</option>
                {CF_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-0.5">Category</label>
              <select value={category} onChange={e => setCat(e.target.value)}
                className="text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 w-44 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]">
                <option value="">All categories</option>
                {catsFor(entity).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-0.5">Date From</label>
              <input type="date" value={dateFrom} onChange={e => setFrom(e.target.value)}
                className="text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 w-36 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]" />
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-0.5">Date To</label>
              <input type="date" value={dateTo} onChange={e => setTo(e.target.value)}
                className="text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 w-36 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#2E3093]">
                <th rowSpan={2} className={thCls}>Date</th>
                <th rowSpan={2} className={thCls}>Description</th>
                <th rowSpan={2} className={thCls}>Category</th>
                <th rowSpan={2} className={thCls}>Company</th>
                <th colSpan={2} className={`${thCls} border-b border-white/20`} style={{ textAlign: 'center' }}>Payment / Receipt (₹)</th>
                <th rowSpan={2} className={`${thCls} text-center`}>Actions</th>
              </tr>
              <tr className="bg-[#2E3093]">
                <th className="px-3 py-1 text-[9px] font-semibold text-red-200 uppercase tracking-wider text-center">Payment</th>
                <th className="px-3 py-1 text-[9px] font-semibold text-emerald-200 uppercase tracking-wider text-center">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cash.loading ? <TableSkeleton cols={7} /> :
               filteredRows.length === 0 ? <EmptyRow cols={7} message={cash.rows.length === 0 ? undefined : 'No matches for current filter'} /> :
               filteredRows.map((r, i) => (
                <tr key={r.id} className={anomalySet.has(r.id) ? 'bg-orange-50/70 hover:bg-orange-50 transition-colors' : trCls(i)}>
                  <td className={tdCls}>{r.date}</td>
                  <td className={tdCls}>{r.description}</td>
                  <td className={tdCls}>
                    <span>{r.category}</span>
                    {anomalySet.has(r.id) && (
                      <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-100 text-orange-700 ring-1 ring-orange-200">⚠ Spike</span>
                    )}
                  </td>
                  <td className={tdCls}>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#2E3093]/10 text-[#2E3093]">{r.entity ?? 'Suvidya'}</span>
                  </td>
                  <td className={`${tdNum} text-red-600`}>{r.payment ? fmt(r.payment) : '—'}</td>
                  <td className={`${tdNum} text-emerald-700`}>{r.receipt ? fmt(r.receipt) : '—'}</td>
                  <RowActions onEdit={() => openEdit(r)} onDelete={() => cash.remove(r.id)} />
                </tr>
              ))}
              {filteredRows.length > 0 && (
                <TotalRow>
                  <td colSpan={4} className="px-3 py-2 text-xs text-[#2E3093]">Total ({filteredRows.length})</td>
                  <td className="px-3 py-2 text-xs text-center text-red-600">{fmt(totals.payment)}</td>
                  <td className="px-3 py-2 text-xs text-center text-emerald-700">{fmt(totals.receipt)}</td>
                  <td />
                </TotalRow>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Company-wise Summary ────────────────────── */}
      {companySummary.length > 0 && (
        <div>
          <SectionTitle>Company-wise Summary</SectionTitle>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full border-collapse">
              <thead><tr className="bg-[#2E3093]">
                <th className={thCls}>Company</th>
                <th className={`${thCls} text-center`}>Total Payment (₹)</th>
                <th className={`${thCls} text-center`}>Total Receipt (₹)</th>
                <th className={`${thCls} text-center`}>Net (₹)</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {companySummary.map((r, i) => {
                  const net = r.receipt - r.payment;
                  return (
                    <tr key={r.entity} className={net < 0 ? 'bg-red-50/30 hover:bg-red-50/50 transition-colors' : trCls(i)}>
                      <td className={tdCls}>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#2E3093]/10 text-[#2E3093]">{r.entity}</span>
                      </td>
                      <td className={`${tdNum} text-red-600`}>{fmt(r.payment)}</td>
                      <td className={`${tdNum} text-emerald-700`}>{fmt(r.receipt)}</td>
                      <td className={`${tdNum} font-semibold ${net < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmt(net)}</td>
                    </tr>
                  );
                })}
                <TotalRow>
                  <td className="px-3 py-2 text-xs text-[#2E3093]">Grand Total</td>
                  <td className="px-3 py-2 text-xs text-center text-red-600">{fmt(totals.payment)}</td>
                  <td className="px-3 py-2 text-xs text-center text-emerald-700">{fmt(totals.receipt)}</td>
                  <td className={`px-3 py-2 text-xs text-center font-semibold ${totals.receipt - totals.payment < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {fmt(totals.receipt - totals.payment)}
                  </td>
                </TotalRow>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CashflowCategoryBars rows={filteredRows} />

      {/* ── AI Insights: Anomaly Spikes ─────────────── */}
      {anomalies.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-700 uppercase tracking-wider mb-3">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            Spending Anomalies Detected ({anomalies.length})
          </p>
          <div className="space-y-2">
            {anomalies.slice(0, 5).map((a, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-white border border-orange-100 px-3 py-2">
                <div>
                  <span className="text-xs font-semibold text-gray-800">{a.category}</span>
                  {a.description && <span className="text-[10px] text-gray-500 ml-2">{a.description}</span>}
                  <span className="text-[10px] text-gray-400 ml-2">{a.date}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-orange-700">{fmt(a.amount)}</p>
                  <p className="text-[10px] text-gray-400">Avg: {fmt(Math.round(a.categoryAvg))} · z={a.zScore.toFixed(1)}</p>
                </div>
              </div>
            ))}
            {anomalies.length > 5 && <p className="text-[10px] text-orange-600 pl-1">+{anomalies.length - 5} more anomalies in full data.</p>}
          </div>
        </div>
      )}

      {/* ── AI Insights: MoM Category Growth ────────── */}
      {momGrowth.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#2E3093] uppercase tracking-wider mb-3">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Month-on-Month Spending Growth (vs previous month)
          </p>
          <div className="flex flex-wrap gap-2">
            {momGrowth.map(g => (
              <div key={g.category} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                g.direction === 'up'   ? 'bg-red-50 border-red-200' :
                g.direction === 'down' ? 'bg-emerald-50 border-emerald-200' :
                                         'bg-gray-50 border-gray-200'
              }`}>
                <span className="text-[10px] font-semibold text-gray-700">{g.category}</span>
                <span className={`text-[11px] font-bold ${
                  g.direction === 'up' ? 'text-red-600' : g.direction === 'down' ? 'text-emerald-700' : 'text-gray-500'
                }`}>
                  {g.growthPct > 0 ? '+' : ''}{g.growthPct.toFixed(1)}%
                  {g.direction === 'up' ? ' ↑' : g.direction === 'down' ? ' ↓' : ' →'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={modal.open}
        title={modal.editing ? 'Edit Transaction' : 'Add Transaction'}
        saving={saving}
        onClose={() => setModal({ open: false, editing: null })}
        onSave={save}
      >
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Date</label><input type="date" className={inpCls} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
          <div><label className={lblCls}>Company</label>
            <select className={inpCls} value={form.entity} onChange={e => setForm(f => ({ ...f, entity: e.target.value as CashflowEntity, category: catsFor(e.target.value as CashflowEntity)[0] }))}>
              {CF_ENTITIES.map(en => <option key={en} value={en}>{en}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Type</label>
            <select className={inpCls} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as CashflowType }))}>
              {CF_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div><label className={lblCls}>Category</label>
            <select className={inpCls} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {catsFor(form.entity).map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div><label className={lblCls}>Description</label><input className={inpCls} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Payment (₹)</label><input type="number" min="0" className={inpCls} value={form.payment} onChange={e => setForm(f => ({ ...f, payment: e.target.value }))} /></div>
          <div><label className={lblCls}>Receipt (₹)</label><input type="number" min="0" className={inpCls} value={form.receipt} onChange={e => setForm(f => ({ ...f, receipt: e.target.value }))} /></div>
        </div>
        <div><label className={lblCls}>Ref / Voucher No.</label><input className={inpCls} value={form.ref_no} onChange={e => setForm(f => ({ ...f, ref_no: e.target.value }))} /></div>
      </Modal>
    </div>
  );
}
