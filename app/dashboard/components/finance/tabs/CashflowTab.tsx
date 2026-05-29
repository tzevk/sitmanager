'use client';

import { useCallback, useMemo, useState } from 'react';
import { useFinanceResource } from '../shared/useFinanceResource';
import { Modal, TableHeader, TableSkeleton, EmptyRow, TotalRow, inpCls, lblCls, trCls, downloadCsv } from '../shared/primitives';
import { fmt, todayISO, fmtDate } from '../shared/format';
import type { CashflowTxn, CashflowType } from '../shared/types';
import CashflowCategoryBars from '../charts/CashflowCategoryBars';
import { detectCashflowAnomalies, categoryMoMGrowth } from '../shared/predictions';

const CF_TYPES: CashflowType[] = ['Payment', 'Receipt'];
const CF_DEPARTMENTS = ['CBD','CORPORATE TRAINING','DEPUTATION ACCENT','PROJECT ACCENT','T&D','ADMIN ACCOUNTS','HELPING STAFF','GENERAL','MANAGEMENT','TRAINERS','LOAN REPAYMENT','MARKETING - ACCENT','PUNE BRANCH'] as const;
const CF_COMPANIES   = ['Suvidya','SIT Alumni','ATS','Accent','SIT Mumbai','SIT Pune'] as const;

const SIT_CATS = [
  'OD Interest / Loan EMI','Management Car Expenses','Management Salary','Employee Salary',
  'Trainers Payment','Food','Utility','Marketing - SIT',
  'Travelling Expense - Staff (Marketing)','Software','Stationary','Infrastructure','Taxes',
  'Mock Interview Charges','Mock Interview','Refund','Internal Transfer',
];
const ACCENT_CATS = [
  'OD Interest / Loan EMI','Management Car Expenses','Management Salary','Employee Salary',
  'Trainers Payment','Food','Utility','Marketing - Accent',
  'Travelling Expense - Staff (Marketing)','Software','Stationary','Infrastructure','Taxes',
  'Mock Interview Charges','Mock Interview','Refund','Internal Transfer',
];
const RECEIPT_CATS = [
  'Tution Fees','Corporate Training','Deputation','Projects','Internal Transfer',
];
const PAYMENT_CATS = Array.from(new Set([...SIT_CATS, ...ACCENT_CATS]));
const ALL_CATS = Array.from(new Set([...PAYMENT_CATS, ...RECEIPT_CATS]));

function catsFor(type?: string): string[] {
  if (type === 'Receipt') return RECEIPT_CATS;
  if (type === 'Payment') return PAYMENT_CATS;
  return ALL_CATS;
}

const cellInp = 'w-full text-xs border border-[#2E3093]/30 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/40 bg-white';
const thT = 'px-2 py-2 text-left text-[10px] font-semibold text-white uppercase tracking-wide whitespace-nowrap border border-white/20';
const tdT = 'px-2 py-1.5 text-xs text-gray-700 border border-gray-200 bg-white overflow-hidden whitespace-nowrap max-w-0';
const tdNT = 'px-2 py-1.5 text-xs text-center text-gray-700 border border-gray-200 bg-white';

type EditForm = {
  date: string; type: CashflowType;
  category: string; department: string; company: string; description: string; payment: string; receipt: string;
};

type SortColumn = 'date' | 'description' | 'category' | 'amount';
type SortDir = 'asc' | 'desc';
type SortState = { col: SortColumn | null; dir: SortDir };

function emptyForm(): EditForm {
  return { date: todayISO(), type: 'Payment', category: SIT_CATS[0], department: '', company: '', description: '', payment: '', receipt: '' };
}

function sortCashRows(rows: CashflowTxn[], sort: SortState, amountField: 'payment' | 'receipt'): CashflowTxn[] {
  if (!sort.col) return rows;
  const mult = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sort.col === 'date') return ((a.date ?? '').localeCompare(b.date ?? '')) * mult;
    if (sort.col === 'description') return ((a.description ?? '').localeCompare(b.description ?? '')) * mult;
    if (sort.col === 'category') return ((a.category ?? '').localeCompare(b.category ?? '')) * mult;
    return (Number(a[amountField] || 0) - Number(b[amountField] || 0)) * mult;
  });
}

function HeaderSort({
  label,
  col,
  sort,
  onSort,
  labelClassName,
}: {
  label: string;
  col: SortColumn;
  sort: SortState;
  onSort: (next: SortState) => void;
  labelClassName?: string;
}) {
  const isActive = sort.col === col;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={labelClassName}>{label}</span>
      <div className="inline-flex items-center rounded border border-white/25 bg-white/10 p-px shadow-sm">
        <button
          type="button"
          aria-label={`Sort ${label} ascending`}
          title={`Sort ${label} ascending`}
          onClick={() => onSort({ col, dir: 'asc' })}
          className={`inline-flex h-4 w-4 items-center justify-center rounded transition-colors focus:outline-none focus:ring-1 focus:ring-white/70 ${isActive && sort.dir === 'asc' ? 'bg-white text-[#2E3093]' : 'text-white/80 hover:bg-white/15 hover:text-white'}`}
        >
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 5v10" />
            <path d="M6.8 11.8L10 15l3.2-3.2" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={`Sort ${label} descending`}
          title={`Sort ${label} descending`}
          onClick={() => onSort({ col, dir: 'desc' })}
          className={`inline-flex h-4 w-4 items-center justify-center rounded transition-colors focus:outline-none focus:ring-1 focus:ring-white/70 ${isActive && sort.dir === 'desc' ? 'bg-white text-[#2E3093]' : 'text-white/80 hover:bg-white/15 hover:text-white'}`}
        >
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 15V5" />
            <path d="M6.8 8.2L10 5l3.2 3.2" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={`Reset ${label} sorting`}
          title={`Reset ${label} sorting`}
          onClick={() => onSort({ col: null, dir: 'asc' })}
          className={`inline-flex h-4 w-4 items-center justify-center rounded transition-colors focus:outline-none focus:ring-1 focus:ring-white/70 ${!isActive ? 'bg-white text-[#2E3093]' : 'text-white/80 hover:bg-white/15 hover:text-white'}`}
        >
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 10a6 6 0 1 1-2-4.47" />
            <path d="M16 4v4h-4" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function CashflowTab() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const [search, setSearch] = useState('');
  const [type, setType]     = useState<'' | CashflowType>('');
  const [category, setCat]  = useState('');
  const [department, setDepartment] = useState('');
  const [company, setCompany]         = useState('');
  const [month, setMonth]   = useState('');
  const [year, setYear]     = useState(String(currentYear));
  const [dateFrom, setFrom] = useState('');
  const [dateTo, setTo]     = useState('');
  const [paySort, setPaySort] = useState<SortState>({ col: null, dir: 'asc' });
  const [receiptSort, setReceiptSort] = useState<SortState>({ col: null, dir: 'asc' });

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (search)     p.set('q', search);
    if (type)       p.set('type', type);
    if (category)   p.set('category', category);
    if (department) p.set('department', department);
    if (company)    p.set('company', company);
    // year expands into a date range so the server can apply it
    const effectiveDateFrom = year && !dateFrom ? `${year}-01-01` : dateFrom;
    const effectiveDateTo   = year && !dateTo   ? `${year}-12-31` : dateTo;
    if (effectiveDateFrom) p.set('dateFrom', effectiveDateFrom);
    if (effectiveDateTo)   p.set('dateTo',   effectiveDateTo);
    return p.toString();
  }, [search, type, category, department, company, year, dateFrom, dateTo]);

  const cash = useFinanceResource<CashflowTxn>('/api/finance/cashflow', { query: query || undefined });

  /* ── inline edit ────────────────────────────────── */
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm]   = useState<EditForm>(emptyForm());
  const [saving, setSaving]       = useState(false);

  const startEdit = useCallback((r: CashflowTxn) => {
    setEditForm({
      date: r.date ?? '', type: r.type,
      category: r.category, department: r.department ?? '', company: r.company ?? '', description: r.description ?? '',
      payment: String(r.payment ?? 0), receipt: String(r.receipt ?? 0),
    });
    setEditingId(r.id);
  }, []);

  const cancelEdit = useCallback(() => setEditingId(null), []);

  const saveEdit = useCallback(async (r: CashflowTxn) => {
    setSaving(true);
    try {
      await cash.save({
        date: editForm.date, type: editForm.type,
        category: editForm.category, description: editForm.description.trim(),
        payment: Number(editForm.payment), receipt: Number(editForm.receipt),
        company: editForm.company || null,
        department: editForm.department || null,
      } as Partial<CashflowTxn>, r);
      setEditingId(null);
    } catch { /* toast */ }
    setSaving(false);
  }, [cash, editForm]);

  /* ── add modal ──────────────────────────────────── */
  const [addModal, setAddModal]   = useState(false);
  const [addForm, setAddForm]     = useState<EditForm>(emptyForm());
  const [addSaving, setAddSaving] = useState(false);

  const openAdd = useCallback(() => { setAddForm(emptyForm()); setAddModal(true); }, []);
  const saveAdd = useCallback(async () => {
    setAddSaving(true);
    try {
      await cash.save({
        date: addForm.date, type: addForm.type,
        category: addForm.category, description: addForm.description.trim(),
        payment: Number(addForm.payment), receipt: Number(addForm.receipt),
        company: addForm.company || null,
        department: addForm.department || null,
      } as Partial<CashflowTxn>, null);
      setAddModal(false);
    } catch { /* toast */ }
    setAddSaving(false);
  }, [cash, addForm]);

  /* ── client-side filtering ──────────────────────── */
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cash.rows.filter(r => {
      if (q && !`${r.description ?? ''} ${r.company ?? ''} ${r.department ?? ''} ${r.category}`.toLowerCase().includes(q)) return false;
      if (type       && r.type     !== type)             return false;
      if (category   && r.category !== category)         return false;
      if (department && (r.department ?? '') !== department) return false;
      if (company    && (r.company ?? '')    !== company)    return false;
      if (year       && !(r.date ?? '').startsWith(year))   return false;
      if (month      && !(r.date ?? '').startsWith(month)) return false;
      if (dateFrom   && (r.date ?? '') < dateFrom)       return false;
      if (dateTo     && (r.date ?? '') > dateTo)         return false;
      return true;
    });
  }, [cash.rows, search, type, category, company, department, year, month, dateFrom, dateTo]);

  const payRows = useMemo(() => {
    const base = filteredRows.filter(r => r.type === 'Payment');
    return sortCashRows(base, paySort, 'payment');
  }, [filteredRows, paySort]);

  const receiptRows = useMemo(() => {
    const base = filteredRows.filter(r => r.type === 'Receipt');
    return sortCashRows(base, receiptSort, 'receipt');
  }, [filteredRows, receiptSort]);

  const totals = useMemo(() => ({
    payment: payRows.reduce((s, r) => s + Number(r.payment || 0), 0),
    receipt: receiptRows.reduce((s, r) => s + Number(r.receipt || 0), 0),
  }), [payRows, receiptRows]);

  // CF_DEPARTMENTS provides static options for the department filter

  const handleExport = useCallback(() => {
    downloadCsv(`cashflow-${todayISO()}.csv`, filteredRows.map(r => ({
      Date: r.date ?? '', Type: r.type, Category: r.category, Department: r.department ?? '',
      Company: r.company ?? '', Description: r.description ?? '', Payment: r.payment, Receipt: r.receipt,
    })));
  }, [filteredRows]);

  const handleClear = useCallback(() => {
    setSearch(''); setType(''); setCat(''); setDepartment(''); setCompany(''); setYear(''); setMonth(''); setFrom(''); setTo('');
  }, []);

  const anomalies = useMemo(() => detectCashflowAnomalies(cash.rows), [cash.rows]);
  const momGrowth = useMemo(() => categoryMoMGrowth(cash.rows), [cash.rows]);

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
      {/* Payment vs Receipt by Department */}
      <div>
        <CashflowCategoryBars rows={filteredRows} view="dept" />
      </div>

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
                {catsFor().map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-0.5">Department</label>
              <select value={department} onChange={e => setDepartment(e.target.value)}
                className="text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 w-44 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]">
                <option value="">All departments</option>
                {CF_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-0.5">Company</label>
              <select value={company} onChange={e => setCompany(e.target.value)}
                className="text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 w-36 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]">
                <option value="">All companies</option>
                {CF_COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-0.5">Year</label>
              <select value={year} onChange={e => setYear(e.target.value)}
                className="text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 w-24 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]">
                <option value="">All years</option>
                {yearOptions.map(y => <option key={y} value={String(y)}>{y}</option>)}
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

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {/* ── Payments ── */}
          <div className="flex h-[620px] min-h-[620px] flex-col">
            <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wider mb-2 pl-1">Payments</p>
            <div className="flex-1 overflow-hidden rounded-xl border border-red-200">
              <div className="h-full overflow-auto">
              <table className="table-fixed w-full border-separate border-spacing-0">
                <colgroup>
                  <col style={{width:'11%'}} /><col style={{width:'20%'}} /><col style={{width:'17%'}} />
                  <col style={{width:'14%'}} /><col style={{width:'11%'}} /><col style={{width:'15%'}} /><col style={{width:'12%'}} />
                </colgroup>
                <thead>
                  <tr className="bg-red-600">
                    <th className={`${thT} sticky top-0 z-10 bg-red-600`}><HeaderSort label="Date" col="date" sort={paySort} onSort={setPaySort} /></th>
                    <th className={`${thT} sticky top-0 z-10 bg-red-600`}><HeaderSort label="Description" col="description" sort={paySort} onSort={setPaySort} /></th>
                    <th className={`${thT} sticky top-0 z-10 bg-red-600`}><HeaderSort label="Category" col="category" sort={paySort} onSort={setPaySort} /></th>
                    <th className={`${thT} sticky top-0 z-10 bg-red-600`}>Department</th>
                    <th className={`${thT} sticky top-0 z-10 bg-red-600`}>Company</th>
                    <th className={`${thT} sticky top-0 z-10 bg-red-600 text-center`}><HeaderSort label="Amount (₹)" col="amount" sort={paySort} onSort={setPaySort} /></th>
                    <th className={`${thT} sticky top-0 z-10 bg-red-600 text-center`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cash.loading ? <TableSkeleton cols={6} /> :
                   payRows.length === 0 ? <EmptyRow cols={6} message={cash.rows.length === 0 ? undefined : 'No payments'} /> :
                   <>
                   <TotalRow>
                     <td colSpan={5} className="px-2 py-1.5 text-xs text-[#2E3093]">Total ({payRows.length})</td>
                     <td className="px-2 py-1.5 text-xs text-center text-red-600">{fmt(totals.payment)}</td>
                     <td />
                   </TotalRow>
                   {payRows.map((r, i) => {
                     if (editingId === r.id) {
                       return (
                         <tr key={r.id} className="bg-blue-50/60">
                           <td className="px-2 py-1.5"><input type="date" className={cellInp} value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} /></td>
                           <td className="px-2 py-1.5"><input className={cellInp} placeholder="Description" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} /></td>
                           <td className="px-2 py-1.5">
                             <select className={cellInp} value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                               {catsFor('Payment').map(c => <option key={c}>{c}</option>)}
                             </select>
                           </td>
                           <td className="px-2 py-1.5">
                             <select className={cellInp} value={editForm.department} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))}>
                               <option value="">— dept —</option>
                               {CF_DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                             </select>
                           </td>
                           <td className="px-2 py-1.5">
                             <select className={cellInp} value={editForm.company} onChange={e => setEditForm(f => ({ ...f, company: e.target.value }))}>
                               <option value="">— co —</option>
                               {CF_COMPANIES.map(c => <option key={c}>{c}</option>)}
                             </select>
                           </td>
                           <td className="px-2 py-1.5"><input type="number" min="0" className={cellInp} value={editForm.payment} onChange={e => setEditForm(f => ({ ...f, payment: e.target.value }))} /></td>
                           <td className="px-2 py-1.5 text-center whitespace-nowrap">
                             <button onClick={() => saveEdit(r)} disabled={saving} className="px-2.5 py-1 text-[10px] font-semibold rounded bg-[#2E3093] text-white hover:bg-[#252880] disabled:opacity-50 mr-1">{saving ? '…' : 'Save'}</button>
                             <button onClick={cancelEdit} className="px-2.5 py-1 text-[10px] font-semibold rounded border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
                           </td>
                         </tr>
                       );
                     }
                     return (
                       <tr key={r.id} className={anomalySet.has(r.id) ? 'bg-orange-50/70 hover:bg-orange-50 transition-colors' : trCls(i)}>
                         <td className={tdT}>{fmtDate(r.date)}</td>
                         <td className={tdT} title={r.description ?? ''}>{r.description}</td>
                         <td className={tdT} title={r.category}>
                           <span>{r.category}</span>
                           {anomalySet.has(r.id) && <span className="ml-1 inline-flex items-center px-1 py-px rounded text-[9px] font-bold bg-orange-100 text-orange-700 ring-1 ring-orange-200">⚠</span>}
                         </td>
                         <td className={tdT} title={r.department ?? ''}>{r.department || '—'}</td>
                         <td className={tdT} title={r.company ?? ''}>{r.company || '—'}</td>
                         <td className={`${tdNT} text-red-600`}>{r.payment ? fmt(r.payment) : '—'}</td>
                         <td className="px-1 py-1.5 text-center whitespace-nowrap">
                           <button onClick={() => startEdit(r)} className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-[#2E3093]/10 text-[#2E3093] transition-colors mr-1">
                             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                           </button>
                           <button onClick={() => cash.remove(r.id)} className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-red-100 text-red-500 transition-colors">
                             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                           </button>
                         </td>
                       </tr>
                     );
                   })}
                   </>
                  }
                </tbody>
              </table>
              </div>
            </div>
          </div>

          {/* ── Receipts ── */}
          <div className="flex h-[620px] min-h-[620px] flex-col">
            <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider mb-2 pl-1">Receipts</p>
            <div className="flex-1 overflow-hidden rounded-xl border border-emerald-200">
              <div className="h-full overflow-auto">
              <table className="table-fixed w-full border-separate border-spacing-0">
                <colgroup>
                  <col style={{width:'11%'}} /><col style={{width:'20%'}} /><col style={{width:'17%'}} />
                  <col style={{width:'14%'}} /><col style={{width:'11%'}} /><col style={{width:'15%'}} /><col style={{width:'12%'}} />
                </colgroup>
                <thead>
                  <tr className="bg-emerald-600">
                    <th className={`${thT} sticky top-0 z-10 bg-emerald-600`}><HeaderSort label="Date" col="date" sort={receiptSort} onSort={setReceiptSort} /></th>
                    <th className={`${thT} sticky top-0 z-10 bg-emerald-600`}><HeaderSort label="Description" col="description" sort={receiptSort} onSort={setReceiptSort} /></th>
                    <th className={`${thT} sticky top-0 z-10 bg-emerald-600`}><HeaderSort label="Category" col="category" sort={receiptSort} onSort={setReceiptSort} /></th>
                    <th className={`${thT} sticky top-0 z-10 bg-emerald-600`}>Department</th>
                    <th className={`${thT} sticky top-0 z-10 bg-emerald-600`}>Company</th>
                    <th className={`${thT} sticky top-0 z-10 bg-emerald-600 text-center`}><HeaderSort label="Amount (₹)" col="amount" sort={receiptSort} onSort={setReceiptSort} /></th>
                    <th className={`${thT} sticky top-0 z-10 bg-emerald-600 text-center`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cash.loading ? <TableSkeleton cols={6} /> :
                   receiptRows.length === 0 ? <EmptyRow cols={6} message={cash.rows.length === 0 ? undefined : 'No receipts'} /> :
                   <>
                   <TotalRow>
                     <td colSpan={5} className="px-2 py-1.5 text-xs text-[#2E3093]">Total ({receiptRows.length})</td>
                     <td className="px-2 py-1.5 text-xs text-center text-green-600">{fmt(totals.receipt)}</td>
                     <td />
                   </TotalRow>
                   {receiptRows.map((r, i) => {
                     if (editingId === r.id) {
                       return (
                         <tr key={r.id} className="bg-blue-50/60">
                           <td className="px-2 py-1.5"><input type="date" className={cellInp} value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} /></td>
                           <td className="px-2 py-1.5"><input className={cellInp} placeholder="Description" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} /></td>
                           <td className="px-2 py-1.5">
                             <select className={cellInp} value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                               {catsFor('Receipt').map(c => <option key={c}>{c}</option>)}
                             </select>
                           </td>
                           <td className="px-2 py-1.5">
                             <select className={cellInp} value={editForm.department} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))}>
                               <option value="">— dept —</option>
                               {CF_DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                             </select>
                           </td>
                           <td className="px-2 py-1.5">
                             <select className={cellInp} value={editForm.company} onChange={e => setEditForm(f => ({ ...f, company: e.target.value }))}>
                               <option value="">— co —</option>
                               {CF_COMPANIES.map(c => <option key={c}>{c}</option>)}
                             </select>
                           </td>
                           <td className="px-2 py-1.5"><input type="number" min="0" className={cellInp} value={editForm.receipt} onChange={e => setEditForm(f => ({ ...f, receipt: e.target.value }))} /></td>
                           <td className="px-2 py-1.5 text-center whitespace-nowrap">
                             <button onClick={() => saveEdit(r)} disabled={saving} className="px-2.5 py-1 text-[10px] font-semibold rounded bg-[#2E3093] text-white hover:bg-[#252880] disabled:opacity-50 mr-1">{saving ? '…' : 'Save'}</button>
                             <button onClick={cancelEdit} className="px-2.5 py-1 text-[10px] font-semibold rounded border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
                           </td>
                         </tr>
                       );
                     }
                     return (
                       <tr key={r.id} className={trCls(i)}>
                         <td className={tdT}>{fmtDate(r.date)}</td>
                         <td className={tdT} title={r.description ?? ''}>{r.description}</td>
                         <td className={tdT} title={r.category}>{r.category}</td>
                         <td className={tdT} title={r.department ?? ''}>{r.department || '—'}</td>
                         <td className={tdT} title={r.company ?? ''}>{r.company || '—'}</td>
                         <td className={`${tdNT} text-green-600`}>{r.receipt ? fmt(r.receipt) : '—'}</td>
                         <td className="px-1 py-1.5 text-center whitespace-nowrap">
                           <button onClick={() => startEdit(r)} className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-[#2E3093]/10 text-[#2E3093] transition-colors mr-1">
                             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                           </button>
                           <button onClick={() => cash.remove(r.id)} className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-red-100 text-red-500 transition-colors">
                             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                           </button>
                         </td>
                       </tr>
                     );
                   })}
                   </>
                  }
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts: Profit summary + Payment vs Receipt by Category */}
      <div>
        <CashflowCategoryBars rows={filteredRows} view="summary-and-category" />
      </div>

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

      {/* ── Add modal ────────────────────────────────── */}
      <Modal open={addModal} title="Add Transaction" saving={addSaving} onClose={() => setAddModal(false)} onSave={saveAdd}>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Date</label><input type="date" className={inpCls} value={addForm.date} onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))} /></div>
          <div><label className={lblCls}>Type</label>
            <select className={inpCls} value={addForm.type} onChange={e => setAddForm(f => ({ ...f, type: e.target.value as CashflowType }))}>
              {CF_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div><label className={lblCls}>Category</label>
          <select className={inpCls} value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}>
            {catsFor(addForm.type).map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div><label className={lblCls}>Department</label>
          <select className={inpCls} value={addForm.department} onChange={e => setAddForm(f => ({ ...f, department: e.target.value }))}>
            <option value="">— select —</option>
            {CF_DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div><label className={lblCls}>Company</label>
          <select className={inpCls} value={addForm.company} onChange={e => setAddForm(f => ({ ...f, company: e.target.value }))}>
            <option value="">— select —</option>
            {CF_COMPANIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div><label className={lblCls}>Description</label><input className={inpCls} value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Payment (₹)</label><input type="number" min="0" className={inpCls} value={addForm.payment} onChange={e => setAddForm(f => ({ ...f, payment: e.target.value }))} /></div>
          <div><label className={lblCls}>Receipt (₹)</label><input type="number" min="0" className={inpCls} value={addForm.receipt} onChange={e => setAddForm(f => ({ ...f, receipt: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}
