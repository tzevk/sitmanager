'use client';

import { useState, useEffect, useCallback, ReactNode } from 'react';

/* ─────────────────────────── Tabs ───────────────────────────────── */
const TABS = [
  { id: 'overview',   label: 'Main Overview' },
  { id: 'cbd',        label: 'CBD / Inhouse' },
  { id: 'ct',         label: 'Corporate Training' },
  { id: 'deputation', label: 'Accent Deputation' },
  { id: 'projects',   label: 'Accent Projects' },
  { id: 'debt',       label: 'Debt Repayment' },
  { id: 'cashflow',   label: 'Cashflow' },
] as const;
type TabId = typeof TABS[number]['id'];

/* ─────────────────────────── Helpers ───────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;

const thCls  = 'px-3 py-2 text-left text-[10px] font-semibold text-white uppercase tracking-wide whitespace-nowrap';
const tdCls  = 'px-3 py-2 text-xs text-gray-700';
const tdNum  = 'px-3 py-2 text-xs text-center text-gray-700';
const inpCls = 'w-full text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]';
const lblCls = 'block text-[10px] font-medium text-gray-600 mb-0.5';

function fmt(n: number | string) {
  const v = Number(n);
  return !v ? '—' : `₹${v.toLocaleString('en-IN')}`;
}
function pct(a: number | string, b: number | string) {
  const av = Number(a), bv = Number(b);
  return bv > 0 ? ((av / bv) * 100).toFixed(1) + '%' : '—';
}

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

/* ─────────────────────────── Shared UI ─────────────────────────── */
function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-bold text-[#2E3093] border-b border-[#2E3093]/20 pb-1 mb-3">{children}</h2>;
}
function EmptyRow({ cols }: { cols: number }) {
  return <tr><td colSpan={cols} className="py-6 text-center text-xs text-gray-400 italic">No records yet — click &quot;+ Add&quot; to add the first entry</td></tr>;
}
function LoadingRow({ cols }: { cols: number }) {
  return <tr><td colSpan={cols} className="py-6 text-center text-xs text-gray-400">Loading…</td></tr>;
}
function TableHeader({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <SectionTitle>{title}</SectionTitle>
      <button onClick={onAdd} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#2E3093] text-white hover:bg-[#252880] transition-colors">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
        Add
      </button>
    </div>
  );
}
function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <td className="px-2 py-1.5 text-center whitespace-nowrap">
      <button onClick={onEdit} title="Edit" className="inline-flex items-center justify-center w-6 h-6 rounded text-blue-600 hover:bg-blue-50 transition-colors mr-1">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
      </button>
      <button onClick={onDelete} title="Delete" className="inline-flex items-center justify-center w-6 h-6 rounded text-red-500 hover:bg-red-50 transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>
    </td>
  );
}
function Modal({ open, title, saving, onClose, onSave, children }: {
  open: boolean; title: string; saving?: boolean; onClose: () => void; onSave: () => void; children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-[#2E3093] text-white">
          <h3 className="text-sm font-bold">{title}</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">{children}</div>
        <div className="flex justify-end gap-2 px-5 pb-4">
          <button onClick={onClose} className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={onSave} disabled={saving} className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#2E3093] text-white hover:bg-[#252880] transition-colors disabled:opacity-60">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   OVERVIEW TAB
════════════════════════════════════════════════════════════════════ */
const MONTHS_SELECT = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function OverviewTab() {
  const now = new Date();
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const year = now.getFullYear();
  const monthYear = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;

  /* ── Dept Performance ── */
  const [depts, setDepts]       = useState<Rec[]>([]);
  const [loadD, setLoadD]       = useState(true);
  const [deptModal, setDeptModal] = useState(false);
  const [editDept, setEditDept] = useState<Rec | null>(null);
  const [deptForm, setDeptForm] = useState({ department: '', amount_achieved: '', target_amount: '' });
  const [savingD, setSavingD]   = useState(false);

  const loadDepts = useCallback(async () => {
    setLoadD(true);
    try { const d = await apiFetch(`/api/finance/dept-performance?month_year=${monthYear}`); setDepts(d.rows ?? []); } catch {}
    setLoadD(false);
  }, [monthYear]);
  useEffect(() => { loadDepts(); }, [loadDepts]);

  function openAddDept()        { setEditDept(null); setDeptForm({ department: '', amount_achieved: '', target_amount: '' }); setDeptModal(true); }
  function openEditDept(r: Rec) { setEditDept(r); setDeptForm({ department: r.department, amount_achieved: String(r.amount_achieved), target_amount: String(r.target_amount) }); setDeptModal(true); }
  async function saveDept() {
    setSavingD(true);
    try {
      const body = { month_year: monthYear, department: deptForm.department, amount_achieved: Number(deptForm.amount_achieved), target_amount: Number(deptForm.target_amount) };
      if (editDept) await apiFetch(`/api/finance/dept-performance/${editDept.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      else await apiFetch('/api/finance/dept-performance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      await loadDepts(); setDeptModal(false);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    setSavingD(false);
  }
  async function delDept(id: number) { if (!confirm('Delete?')) return; await apiFetch(`/api/finance/dept-performance/${id}`, { method: 'DELETE' }); await loadDepts(); }

  /* ── Loans ── */
  const [loans, setLoans]       = useState<Rec[]>([]);
  const [loadL, setLoadL]       = useState(true);
  const [loanModal, setLoanModal] = useState(false);
  const [editLoan, setEditLoan] = useState<Rec | null>(null);
  const [loanForm, setLoanForm] = useState({ bank_name: '', outstanding: '', paid: '' });
  const [savingL, setSavingL]   = useState(false);

  const loadLoans = useCallback(async () => {
    setLoadL(true);
    try { const d = await apiFetch('/api/finance/loans'); setLoans(d.rows ?? []); } catch {}
    setLoadL(false);
  }, []);
  useEffect(() => { loadLoans(); }, [loadLoans]);

  function openAddLoan()        { setEditLoan(null); setLoanForm({ bank_name: '', outstanding: '', paid: '' }); setLoanModal(true); }
  function openEditLoan(r: Rec) { setEditLoan(r); setLoanForm({ bank_name: r.bank_name, outstanding: String(r.outstanding), paid: String(r.paid) }); setLoanModal(true); }
  async function saveLoan() {
    setSavingL(true);
    try {
      const body = { bank_name: loanForm.bank_name, outstanding: Number(loanForm.outstanding), paid: Number(loanForm.paid) };
      if (editLoan) await apiFetch(`/api/finance/loans/${editLoan.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      else await apiFetch('/api/finance/loans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      await loadLoans(); setLoanModal(false);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    setSavingL(false);
  }
  async function delLoan(id: number) { if (!confirm('Delete?')) return; await apiFetch(`/api/finance/loans/${id}`, { method: 'DELETE' }); await loadLoans(); }

  /* ── Salary Cashflow ── */
  const [salary, setSalary]         = useState<Rec | null>(null);
  const [salaryModal, setSalaryModal] = useState(false);
  const [salaryForm, setSalaryForm] = useState({ total_payable: '', salary_paid: '', salary_pending: '', next_payout: '' });
  const [savingS, setSavingS]       = useState(false);

  useEffect(() => {
    apiFetch(`/api/finance/salary-cashflow?month_year=${monthYear}`).then(d => setSalary(d.row ?? null)).catch(() => setSalary(null));
  }, [monthYear]);

  function openSalary() {
    setSalaryForm({ total_payable: String(salary?.total_payable ?? ''), salary_paid: String(salary?.salary_paid ?? ''), salary_pending: String(salary?.salary_pending ?? ''), next_payout: salary?.next_payout ?? '' });
    setSalaryModal(true);
  }
  async function saveSalary() {
    setSavingS(true);
    try {
      const d = await apiFetch('/api/finance/salary-cashflow', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month_year: monthYear, total_payable: Number(salaryForm.total_payable), salary_paid: Number(salaryForm.salary_paid), salary_pending: Number(salaryForm.salary_pending), next_payout: salaryForm.next_payout || null }) });
      setSalary(d.row); setSalaryModal(false);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    setSavingS(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-gray-600">Month:</label>
        <select value={monthIdx} onChange={e => setMonthIdx(Number(e.target.value))}
          className="text-xs rounded-lg border border-gray-200 bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]">
          {MONTHS_SELECT.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <span className="text-xs text-gray-400">FY 2025–26</span>
      </div>

      {/* Dept Performance */}
      <div>
        <TableHeader title={`Department Performance — ${MONTHS_SELECT[monthIdx]}`} onAdd={openAddDept} />
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead><tr className="bg-[#2E3093]">
              <th className={thCls}>Department</th>
              <th className={`${thCls} text-center`}>Amount Achieved (₹)</th>
              <th className={`${thCls} text-center`}>Target Amount (₹)</th>
              <th className={`${thCls} text-center`}>%age</th>
              <th className={`${thCls} text-center`}>Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loadD ? <LoadingRow cols={5} /> : depts.length === 0 ? <EmptyRow cols={5} /> : depts.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                  <td className={tdCls}>{r.department}</td>
                  <td className={tdNum}>{fmt(r.amount_achieved)}</td>
                  <td className={tdNum}>{fmt(r.target_amount)}</td>
                  <td className={tdNum}>{pct(r.amount_achieved, r.target_amount)}</td>
                  <RowActions onEdit={() => openEditDept(r)} onDelete={() => delDept(r.id)} />
                </tr>
              ))}
              {depts.length > 1 && (
                <tr className="bg-[#2E3093]/5 border-t-2 border-[#2E3093]/20 font-semibold">
                  <td className="px-3 py-2 text-xs text-[#2E3093]">Total</td>
                  <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{fmt(depts.reduce((s,r)=>s+Number(r.amount_achieved),0))}</td>
                  <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{fmt(depts.reduce((s,r)=>s+Number(r.target_amount),0))}</td>
                  <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{pct(depts.reduce((s,r)=>s+Number(r.amount_achieved),0),depts.reduce((s,r)=>s+Number(r.target_amount),0))}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Loans */}
      <div>
        <TableHeader title="Outstanding Loans" onAdd={openAddLoan} />
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead><tr className="bg-[#2E3093]">
              <th className={thCls}>Bank Name</th>
              <th className={`${thCls} text-center`}>Outstanding Amount (₹)</th>
              <th className={`${thCls} text-center`}>Paid Amount (₹)</th>
              <th className={`${thCls} text-center`}>%age Paid</th>
              <th className={`${thCls} text-center`}>Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loadL ? <LoadingRow cols={5} /> : loans.length === 0 ? <EmptyRow cols={5} /> : loans.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                  <td className={tdCls}>{r.bank_name}</td>
                  <td className={tdNum}>{fmt(r.outstanding)}</td>
                  <td className={tdNum}>{fmt(r.paid)}</td>
                  <td className={tdNum}>{pct(r.paid, r.outstanding)}</td>
                  <RowActions onEdit={() => openEditLoan(r)} onDelete={() => delLoan(r.id)} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Salary Cashflow */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionTitle>Salary Cashflow — {MONTHS_SELECT[monthIdx]}</SectionTitle>
          <button onClick={openSalary} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#2E3093] text-[#2E3093] hover:bg-[#2E3093]/5 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            Edit
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Salary Payable', value: salary?.total_payable ? fmt(salary.total_payable) : '—' },
            { label: 'Salary Paid',          value: salary?.salary_paid   ? fmt(salary.salary_paid)   : '—' },
            { label: 'Salary Pending',       value: salary?.salary_pending ? fmt(salary.salary_pending) : '—' },
            { label: 'Next Payout Date',     value: salary?.next_payout   || '—' },
          ].map(c => (
            <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{c.label}</p>
              <p className="text-xl font-bold text-[#2E3093] mt-1">{c.value}</p>
            </div>
          ))}
        </div>
      </div>

      <Modal open={deptModal} title={editDept ? 'Edit Department Record' : 'Add Department Record'} saving={savingD} onClose={() => setDeptModal(false)} onSave={saveDept}>
        <div><label className={lblCls}>Department Name</label><input className={inpCls} placeholder="e.g. CBD / Inhouse Training" value={deptForm.department} onChange={e => setDeptForm(f => ({ ...f, department: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Amount Achieved (₹)</label><input type="number" className={inpCls} value={deptForm.amount_achieved} onChange={e => setDeptForm(f => ({ ...f, amount_achieved: e.target.value }))} /></div>
          <div><label className={lblCls}>Target Amount (₹)</label><input type="number" className={inpCls} value={deptForm.target_amount} onChange={e => setDeptForm(f => ({ ...f, target_amount: e.target.value }))} /></div>
        </div>
      </Modal>
      <Modal open={loanModal} title={editLoan ? 'Edit Loan' : 'Add Loan'} saving={savingL} onClose={() => setLoanModal(false)} onSave={saveLoan}>
        <div><label className={lblCls}>Bank Name</label><input className={inpCls} value={loanForm.bank_name} onChange={e => setLoanForm(f => ({ ...f, bank_name: e.target.value }))} /></div>
        <div><label className={lblCls}>Outstanding Amount (₹)</label><input type="number" className={inpCls} value={loanForm.outstanding} onChange={e => setLoanForm(f => ({ ...f, outstanding: e.target.value }))} /></div>
        <div><label className={lblCls}>Paid Amount (₹)</label><input type="number" className={inpCls} value={loanForm.paid} onChange={e => setLoanForm(f => ({ ...f, paid: e.target.value }))} /></div>
      </Modal>
      <Modal open={salaryModal} title="Edit Salary Cashflow" saving={savingS} onClose={() => setSalaryModal(false)} onSave={saveSalary}>
        <div><label className={lblCls}>Total Salary Payable (₹)</label><input type="number" className={inpCls} value={salaryForm.total_payable} onChange={e => setSalaryForm(f => ({ ...f, total_payable: e.target.value }))} /></div>
        <div><label className={lblCls}>Salary Paid (₹)</label><input type="number" className={inpCls} value={salaryForm.salary_paid} onChange={e => setSalaryForm(f => ({ ...f, salary_paid: e.target.value }))} /></div>
        <div><label className={lblCls}>Salary Pending (₹)</label><input type="number" className={inpCls} value={salaryForm.salary_pending} onChange={e => setSalaryForm(f => ({ ...f, salary_pending: e.target.value }))} /></div>
        <div><label className={lblCls}>Next Payout Date</label><input type="date" className={inpCls} value={salaryForm.next_payout} onChange={e => setSalaryForm(f => ({ ...f, next_payout: e.target.value }))} /></div>
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CBD / INHOUSE TAB
════════════════════════════════════════════════════════════════════ */
function CbdTab() {
  const [rows, setRows]       = useState<Rec[]>([]);
  const [loadR, setLoadR]     = useState(true);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<Rec | null>(null);
  const [form, setForm]       = useState({ programme: '', frequency: '', target_students: '', achieved_students: '', fees_target: '', fees_received: '' });
  const [saving, setSaving]   = useState(false);

  const [fees, setFees]       = useState<Rec[]>([]);
  const [loadF, setLoadF]     = useState(true);
  const [feeModal, setFeeModal] = useState(false);
  const [editFee, setEditFee] = useState<Rec | null>(null);
  const [feeForm, setFeeForm] = useState({ student_name: '', batch: '', total_fees: '', paid: '', due_date: '' });
  const [savingF, setSavingF] = useState(false);

  const load = useCallback(async () => {
    setLoadR(true); try { const d = await apiFetch('/api/finance/cbd-performance'); setRows(d.rows ?? []); } catch {} setLoadR(false);
  }, []);
  const loadFees = useCallback(async () => {
    setLoadF(true); try { const d = await apiFetch('/api/finance/pending-fees'); setFees(d.rows ?? []); } catch {} setLoadF(false);
  }, []);
  useEffect(() => { load(); loadFees(); }, [load, loadFees]);

  function openAdd()        { setEditing(null); setForm({ programme: '', frequency: '', target_students: '', achieved_students: '', fees_target: '', fees_received: '' }); setModal(true); }
  function openEdit(r: Rec) { setEditing(r); setForm({ programme: r.programme, frequency: String(r.frequency), target_students: String(r.target_students), achieved_students: String(r.achieved_students), fees_target: String(r.fees_target), fees_received: String(r.fees_received) }); setModal(true); }
  async function save() {
    setSaving(true);
    try {
      const body = { programme: form.programme, frequency: Number(form.frequency), target_students: Number(form.target_students), achieved_students: Number(form.achieved_students), fees_target: Number(form.fees_target), fees_received: Number(form.fees_received) };
      if (editing) await apiFetch(`/api/finance/cbd-performance/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      else await apiFetch('/api/finance/cbd-performance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      await load(); setModal(false);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    setSaving(false);
  }
  async function del(id: number) { if (!confirm('Delete?')) return; await apiFetch(`/api/finance/cbd-performance/${id}`, { method: 'DELETE' }); await load(); }

  function openAddFee()       { setEditFee(null); setFeeForm({ student_name: '', batch: '', total_fees: '', paid: '', due_date: '' }); setFeeModal(true); }
  function openEditFee(r: Rec){ setEditFee(r); setFeeForm({ student_name: r.student_name, batch: r.batch, total_fees: String(r.total_fees), paid: String(r.paid), due_date: r.due_date ?? '' }); setFeeModal(true); }
  async function saveFee() {
    setSavingF(true);
    try {
      const body = { student_name: feeForm.student_name, batch: feeForm.batch, total_fees: Number(feeForm.total_fees), paid: Number(feeForm.paid), due_date: feeForm.due_date || null };
      if (editFee) await apiFetch(`/api/finance/pending-fees/${editFee.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      else await apiFetch('/api/finance/pending-fees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      await loadFees(); setFeeModal(false);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    setSavingF(false);
  }
  async function delFee(id: number) { if (!confirm('Delete?')) return; await apiFetch(`/api/finance/pending-fees/${id}`, { method: 'DELETE' }); await loadFees(); }

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
              {loadR ? <LoadingRow cols={8} /> : rows.length === 0 ? <EmptyRow cols={8} /> : rows.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                  <td className={tdCls}>{r.programme}</td>
                  <td className={tdNum}>{r.frequency}</td>
                  <td className={tdNum}>{r.target_students}</td>
                  <td className={tdNum}>{r.achieved_students}</td>
                  <td className={tdNum}>{fmt(r.fees_target)}</td>
                  <td className={tdNum}>{fmt(r.fees_received)}</td>
                  <td className={tdNum}>{pct(r.fees_received, r.fees_target)}</td>
                  <RowActions onEdit={() => openEdit(r)} onDelete={() => del(r.id)} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <TableHeader title="Pending Fees" onAdd={openAddFee} />
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead><tr className="bg-[#2E3093]">
              <th className={thCls}>Student Name</th>
              <th className={thCls}>Batch / Programme</th>
              <th className={`${thCls} text-center`}>Total Fees (₹)</th>
              <th className={`${thCls} text-center`}>Paid (₹)</th>
              <th className={`${thCls} text-center`}>Pending (₹)</th>
              <th className={`${thCls} text-center`}>Due Date</th>
              <th className={`${thCls} text-center`}>Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loadF ? <LoadingRow cols={7} /> : fees.length === 0 ? <EmptyRow cols={7} /> : fees.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                  <td className={tdCls}>{r.student_name}</td>
                  <td className={tdCls}>{r.batch}</td>
                  <td className={tdNum}>{fmt(r.total_fees)}</td>
                  <td className={tdNum}>{fmt(r.paid)}</td>
                  <td className={`${tdNum} text-red-600 font-medium`}>{fmt(Math.max(0, Number(r.total_fees) - Number(r.paid)))}</td>
                  <td className={tdNum}>{r.due_date || '—'}</td>
                  <RowActions onEdit={() => openEditFee(r)} onDelete={() => delFee(r.id)} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal open={modal} title={editing ? 'Edit Training Record' : 'Add Training Record'} saving={saving} onClose={() => setModal(false)} onSave={save}>
        <div><label className={lblCls}>Training Programme Name</label><input className={inpCls} value={form.programme} onChange={e => setForm(f => ({ ...f, programme: e.target.value }))} /></div>
        <div><label className={lblCls}>Frequency Conducted</label><input type="number" className={inpCls} value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Target Students</label><input type="number" className={inpCls} value={form.target_students} onChange={e => setForm(f => ({ ...f, target_students: e.target.value }))} /></div>
          <div><label className={lblCls}>Achieved Students</label><input type="number" className={inpCls} value={form.achieved_students} onChange={e => setForm(f => ({ ...f, achieved_students: e.target.value }))} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Fees Target (₹)</label><input type="number" className={inpCls} value={form.fees_target} onChange={e => setForm(f => ({ ...f, fees_target: e.target.value }))} /></div>
          <div><label className={lblCls}>Fees Received (₹)</label><input type="number" className={inpCls} value={form.fees_received} onChange={e => setForm(f => ({ ...f, fees_received: e.target.value }))} /></div>
        </div>
      </Modal>
      <Modal open={feeModal} title={editFee ? 'Edit Pending Fee' : 'Add Pending Fee'} saving={savingF} onClose={() => setFeeModal(false)} onSave={saveFee}>
        <div><label className={lblCls}>Student Name</label><input className={inpCls} value={feeForm.student_name} onChange={e => setFeeForm(f => ({ ...f, student_name: e.target.value }))} /></div>
        <div><label className={lblCls}>Batch / Programme</label><input className={inpCls} value={feeForm.batch} onChange={e => setFeeForm(f => ({ ...f, batch: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Total Fees (₹)</label><input type="number" className={inpCls} value={feeForm.total_fees} onChange={e => setFeeForm(f => ({ ...f, total_fees: e.target.value }))} /></div>
          <div><label className={lblCls}>Paid (₹)</label><input type="number" className={inpCls} value={feeForm.paid} onChange={e => setFeeForm(f => ({ ...f, paid: e.target.value }))} /></div>
        </div>
        <div><label className={lblCls}>Due Date</label><input type="date" className={inpCls} value={feeForm.due_date} onChange={e => setFeeForm(f => ({ ...f, due_date: e.target.value }))} /></div>
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CORPORATE TRAINING TAB
════════════════════════════════════════════════════════════════════ */
function CtTab() {
  const [rows, setRows]       = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<Rec | null>(null);
  const [form, setForm]       = useState({ month: '', training_name: '', count: '', cost: '', target: '' });
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true); try { const d = await apiFetch('/api/finance/ct-performance'); setRows(d.rows ?? []); } catch {} setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  function openAdd()        { setEditing(null); setForm({ month: '', training_name: '', count: '', cost: '', target: '' }); setModal(true); }
  function openEdit(r: Rec) { setEditing(r); setForm({ month: r.month, training_name: r.training_name, count: String(r.count), cost: String(r.cost), target: String(r.target) }); setModal(true); }
  async function save() {
    setSaving(true);
    try {
      const body = { month: form.month, training_name: form.training_name, count: Number(form.count), cost: Number(form.cost), target: Number(form.target) };
      if (editing) await apiFetch(`/api/finance/ct-performance/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      else await apiFetch('/api/finance/ct-performance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      await load(); setModal(false);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    setSaving(false);
  }
  async function del(id: number) { if (!confirm('Delete?')) return; await apiFetch(`/api/finance/ct-performance/${id}`, { method: 'DELETE' }); await load(); }

  return (
    <div className="space-y-4">
      <TableHeader title="Corporate Training — Monthly Performance" onAdd={openAdd} />
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full border-collapse">
          <thead><tr className="bg-[#2E3093]">
            <th className={thCls}>Month</th>
            <th className={thCls}>Training Name</th>
            <th className={`${thCls} text-center`}>Conducted (No.)</th>
            <th className={`${thCls} text-center`}>Conducted Cost (₹)</th>
            <th className={`${thCls} text-center`}>Conducted Target (₹)</th>
            <th className={`${thCls} text-center`}>%age</th>
            <th className={`${thCls} text-center`}>Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <LoadingRow cols={7} /> : rows.length === 0 ? <EmptyRow cols={7} /> : rows.map((r, i) => (
              <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                <td className={tdCls}>{r.month}</td>
                <td className={tdCls}>{r.training_name}</td>
                <td className={tdNum}>{r.count}</td>
                <td className={tdNum}>{fmt(r.cost)}</td>
                <td className={tdNum}>{fmt(r.target)}</td>
                <td className={tdNum}>{pct(r.cost, r.target)}</td>
                <RowActions onEdit={() => openEdit(r)} onDelete={() => del(r.id)} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={modal} title={editing ? 'Edit CT Record' : 'Add CT Record'} saving={saving} onClose={() => setModal(false)} onSave={save}>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Month</label><input className={inpCls} placeholder="e.g. April" value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} /></div>
          <div><label className={lblCls}>Trainings Conducted (No.)</label><input type="number" className={inpCls} value={form.count} onChange={e => setForm(f => ({ ...f, count: e.target.value }))} /></div>
        </div>
        <div><label className={lblCls}>Training Name</label><input className={inpCls} value={form.training_name} onChange={e => setForm(f => ({ ...f, training_name: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Conducted Cost (₹)</label><input type="number" className={inpCls} value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} /></div>
          <div><label className={lblCls}>Conducted Target (₹)</label><input type="number" className={inpCls} value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   REUSABLE: Monthly Actual vs Target (Deputation / Projects)
════════════════════════════════════════════════════════════════════ */
function MonthlyTab({ apiPath, title }: { apiPath: string; title: string }) {
  const [rows, setRows]       = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<Rec | null>(null);
  const [form, setForm]       = useState({ month: '', actual_cost: '', target_cost: '' });
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true); try { const d = await apiFetch(apiPath); setRows(d.rows ?? []); } catch {} setLoading(false);
  }, [apiPath]);
  useEffect(() => { load(); }, [load]);

  function openAdd()        { setEditing(null); setForm({ month: '', actual_cost: '', target_cost: '' }); setModal(true); }
  function openEdit(r: Rec) { setEditing(r); setForm({ month: r.month, actual_cost: String(r.actual_cost), target_cost: String(r.target_cost) }); setModal(true); }
  async function save() {
    setSaving(true);
    try {
      const body = { month: form.month, actual_cost: Number(form.actual_cost), target_cost: Number(form.target_cost) };
      if (editing) await apiFetch(`${apiPath}/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      else await apiFetch(apiPath, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      await load(); setModal(false);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    setSaving(false);
  }
  async function del(id: number) { if (!confirm('Delete?')) return; await apiFetch(`${apiPath}/${id}`, { method: 'DELETE' }); await load(); }

  const totalActual = rows.reduce((s, r) => s + Number(r.actual_cost), 0);
  const totalTarget = rows.reduce((s, r) => s + Number(r.target_cost), 0);

  return (
    <div className="space-y-4">
      <TableHeader title={title} onAdd={openAdd} />
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
            {loading ? <LoadingRow cols={5} /> : rows.length === 0 ? <EmptyRow cols={5} /> : rows.map((r, i) => (
              <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                <td className={tdCls}>{r.month}</td>
                <td className={tdNum}>{fmt(r.actual_cost)}</td>
                <td className={tdNum}>{fmt(r.target_cost)}</td>
                <td className={tdNum}>{pct(r.actual_cost, r.target_cost)}</td>
                <RowActions onEdit={() => openEdit(r)} onDelete={() => del(r.id)} />
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="bg-[#2E3093]/5 border-t-2 border-[#2E3093]/20 font-semibold">
                <td className="px-3 py-2 text-xs text-[#2E3093]">Total</td>
                <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{fmt(totalActual)}</td>
                <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{fmt(totalTarget)}</td>
                <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{pct(totalActual, totalTarget)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Modal open={modal} title={editing ? 'Edit Record' : 'Add Record'} saving={saving} onClose={() => setModal(false)} onSave={save}>
        <div><label className={lblCls}>Month</label><input className={inpCls} placeholder="e.g. April" value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Actual Cost (₹)</label><input type="number" className={inpCls} value={form.actual_cost} onChange={e => setForm(f => ({ ...f, actual_cost: e.target.value }))} /></div>
          <div><label className={lblCls}>Targeted Cost (₹)</label><input type="number" className={inpCls} value={form.target_cost} onChange={e => setForm(f => ({ ...f, target_cost: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

function DeputationTab() { return <MonthlyTab apiPath="/api/finance/deputation" title="Accent Deputation — Monthly Performance" />; }
function ProjectsTab()   { return <MonthlyTab apiPath="/api/finance/projects"   title="Accent Projects — Monthly Performance" />; }

/* ════════════════════════════════════════════════════════════════════
   DEBT REPAYMENT TAB
════════════════════════════════════════════════════════════════════ */
function DebtTab() {
  const [plans, setPlans]         = useState<Rec[]>([]);
  const [loadP, setLoadP]         = useState(true);
  const [planModal, setPlanModal] = useState(false);
  const [editPlan, setEditPlan]   = useState<Rec | null>(null);
  const [planForm, setPlanForm]   = useState({ bank_name: '', emi_amount: '', planned_date: '', actual_paid: '', actual_date: '', status: 'Pending' });
  const [savingP, setSavingP]     = useState(false);

  const [projRows, setProjRows]   = useState<Rec[]>([]);
  const [loadPr, setLoadPr]       = useState(true);
  const [projModal, setProjModal] = useState(false);
  const [editProj, setEditProj]   = useState<Rec | null>(null);
  const [projForm, setProjForm]   = useState({ month: '', revenue: '', expenses: '', loan_repayment: '' });
  const [savingPr, setSavingPr]   = useState(false);

  const loadPlans = useCallback(async () => {
    setLoadP(true); try { const d = await apiFetch('/api/finance/debt-plan'); setPlans(d.rows ?? []); } catch {} setLoadP(false);
  }, []);
  const loadProj = useCallback(async () => {
    setLoadPr(true); try { const d = await apiFetch('/api/finance/cashflow-projection'); setProjRows(d.rows ?? []); } catch {} setLoadPr(false);
  }, []);
  useEffect(() => { loadPlans(); loadProj(); }, [loadPlans, loadProj]);

  function openAddPlan()        { setEditPlan(null); setPlanForm({ bank_name: '', emi_amount: '', planned_date: '', actual_paid: '', actual_date: '', status: 'Pending' }); setPlanModal(true); }
  function openEditPlan(r: Rec) { setEditPlan(r); setPlanForm({ bank_name: r.bank_name, emi_amount: String(r.emi_amount), planned_date: r.planned_date ?? '', actual_paid: String(r.actual_paid), actual_date: r.actual_date ?? '', status: r.status }); setPlanModal(true); }
  async function savePlan() {
    setSavingP(true);
    try {
      const body = { bank_name: planForm.bank_name, emi_amount: Number(planForm.emi_amount), planned_date: planForm.planned_date || null, actual_paid: Number(planForm.actual_paid), actual_date: planForm.actual_date || null, status: planForm.status };
      if (editPlan) await apiFetch(`/api/finance/debt-plan/${editPlan.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      else await apiFetch('/api/finance/debt-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      await loadPlans(); setPlanModal(false);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    setSavingP(false);
  }
  async function delPlan(id: number) { if (!confirm('Delete?')) return; await apiFetch(`/api/finance/debt-plan/${id}`, { method: 'DELETE' }); await loadPlans(); }

  function openAddProj()        { setEditProj(null); setProjForm({ month: '', revenue: '', expenses: '', loan_repayment: '' }); setProjModal(true); }
  function openEditProj(r: Rec) { setEditProj(r); setProjForm({ month: r.month, revenue: String(r.revenue), expenses: String(r.expenses), loan_repayment: String(r.loan_repayment) }); setProjModal(true); }
  async function saveProj() {
    setSavingPr(true);
    try {
      const body = { month: projForm.month, revenue: Number(projForm.revenue), expenses: Number(projForm.expenses), loan_repayment: Number(projForm.loan_repayment) };
      if (editProj) await apiFetch(`/api/finance/cashflow-projection/${editProj.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      else await apiFetch('/api/finance/cashflow-projection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      await loadProj(); setProjModal(false);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    setSavingPr(false);
  }
  async function delProj(id: number) { if (!confirm('Delete?')) return; await apiFetch(`/api/finance/cashflow-projection/${id}`, { method: 'DELETE' }); await loadProj(); }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Upcoming Payment (30 days)', value: plans.filter(r => r.status === 'Pending').reduce((s,r) => s + Number(r.emi_amount), 0) },
          { label: 'Total Debt Remaining',        value: plans.reduce((s,r) => s + Math.max(0, Number(r.emi_amount) - Number(r.actual_paid)), 0) },
          { label: 'Total Paid (All Time)',        value: plans.reduce((s,r) => s + Number(r.actual_paid), 0) },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{c.label}</p>
            <p className="text-xl font-bold text-[#2E3093] mt-1">{c.value ? fmt(c.value) : '—'}</p>
          </div>
        ))}
      </div>

      <div>
        <TableHeader title="Debt Plan vs Actual" onAdd={openAddPlan} />
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead><tr className="bg-[#2E3093]">
              <th className={thCls}>Bank Name</th>
              <th className={`${thCls} text-center`}>EMI Amount (₹)</th>
              <th className={`${thCls} text-center`}>Planned Date</th>
              <th className={`${thCls} text-center`}>Actual Paid (₹)</th>
              <th className={`${thCls} text-center`}>Actual Date</th>
              <th className={`${thCls} text-center`}>Variance (₹)</th>
              <th className={`${thCls} text-center`}>Status</th>
              <th className={`${thCls} text-center`}>Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loadP ? <LoadingRow cols={8} /> : plans.length === 0 ? <EmptyRow cols={8} /> : plans.map((r, i) => {
                const variance = Number(r.actual_paid) - Number(r.emi_amount);
                return (
                  <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                    <td className={tdCls}>{r.bank_name}</td>
                    <td className={tdNum}>{fmt(r.emi_amount)}</td>
                    <td className={tdNum}>{r.planned_date || '—'}</td>
                    <td className={tdNum}>{fmt(r.actual_paid)}</td>
                    <td className={tdNum}>{r.actual_date || '—'}</td>
                    <td className={`${tdNum} ${variance < 0 ? 'text-red-600' : 'text-green-600'} font-medium`}>{r.actual_paid ? fmt(variance) : '—'}</td>
                    <td className={tdNum}>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${r.status === 'Paid' ? 'bg-green-100 text-green-700' : r.status === 'Overdue' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{r.status}</span>
                    </td>
                    <RowActions onEdit={() => openEditPlan(r)} onDelete={() => delPlan(r.id)} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <TableHeader title="Projected Cashflow — Upcoming Months" onAdd={openAddProj} />
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead><tr className="bg-[#2E3093]">
              <th className={thCls}>Month</th>
              <th className={`${thCls} text-center`}>Projected Revenue (₹)</th>
              <th className={`${thCls} text-center`}>Projected Expenses (₹)</th>
              <th className={`${thCls} text-center`}>Loan Repayment (₹)</th>
              <th className={`${thCls} text-center`}>Net Cashflow (₹)</th>
              <th className={`${thCls} text-center`}>Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loadPr ? <LoadingRow cols={6} /> : projRows.length === 0 ? <EmptyRow cols={6} /> : projRows.map((r, i) => {
                const net = Number(r.revenue) - Number(r.expenses) - Number(r.loan_repayment);
                return (
                  <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                    <td className={tdCls}>{r.month}</td>
                    <td className={tdNum}>{fmt(r.revenue)}</td>
                    <td className={tdNum}>{fmt(r.expenses)}</td>
                    <td className={tdNum}>{fmt(r.loan_repayment)}</td>
                    <td className={`${tdNum} ${net < 0 ? 'text-red-600' : 'text-green-700'} font-semibold`}>{fmt(net)}</td>
                    <RowActions onEdit={() => openEditProj(r)} onDelete={() => delProj(r.id)} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={planModal} title={editPlan ? 'Edit Debt Plan Record' : 'Add Debt Plan Record'} saving={savingP} onClose={() => setPlanModal(false)} onSave={savePlan}>
        <div><label className={lblCls}>Bank Name</label><input className={inpCls} value={planForm.bank_name} onChange={e => setPlanForm(f => ({ ...f, bank_name: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>EMI Amount (₹)</label><input type="number" className={inpCls} value={planForm.emi_amount} onChange={e => setPlanForm(f => ({ ...f, emi_amount: e.target.value }))} /></div>
          <div><label className={lblCls}>Planned Date</label><input type="date" className={inpCls} value={planForm.planned_date} onChange={e => setPlanForm(f => ({ ...f, planned_date: e.target.value }))} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Actual Paid (₹)</label><input type="number" className={inpCls} value={planForm.actual_paid} onChange={e => setPlanForm(f => ({ ...f, actual_paid: e.target.value }))} /></div>
          <div><label className={lblCls}>Actual Date</label><input type="date" className={inpCls} value={planForm.actual_date} onChange={e => setPlanForm(f => ({ ...f, actual_date: e.target.value }))} /></div>
        </div>
        <div><label className={lblCls}>Status</label>
          <select className={inpCls} value={planForm.status} onChange={e => setPlanForm(f => ({ ...f, status: e.target.value }))}>
            <option>Pending</option><option>Paid</option><option>Overdue</option>
          </select>
        </div>
      </Modal>
      <Modal open={projModal} title={editProj ? 'Edit Projection' : 'Add Projection'} saving={savingPr} onClose={() => setProjModal(false)} onSave={saveProj}>
        <div><label className={lblCls}>Month</label><input className={inpCls} placeholder="e.g. June 2026" value={projForm.month} onChange={e => setProjForm(f => ({ ...f, month: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Projected Revenue (₹)</label><input type="number" className={inpCls} value={projForm.revenue} onChange={e => setProjForm(f => ({ ...f, revenue: e.target.value }))} /></div>
          <div><label className={lblCls}>Projected Expenses (₹)</label><input type="number" className={inpCls} value={projForm.expenses} onChange={e => setProjForm(f => ({ ...f, expenses: e.target.value }))} /></div>
        </div>
        <div><label className={lblCls}>Loan Repayment (₹)</label><input type="number" className={inpCls} value={projForm.loan_repayment} onChange={e => setProjForm(f => ({ ...f, loan_repayment: e.target.value }))} /></div>
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CASHFLOW TAB
════════════════════════════════════════════════════════════════════ */
const CF_TYPES = ['Payment', 'Receipt'];
const CF_CATS  = ['Salary', 'Rent', 'Utilities', 'Fees', 'Vendor', 'Loan EMI', 'Miscellaneous'];

function CashflowTab() {
  const [rows, setRows]       = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<Rec | null>(null);
  const [form, setForm]       = useState({ date: '', type: 'Payment', category: 'Salary', description: '', payment: '', receipt: '', ref_no: '' });
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true); try { const d = await apiFetch('/api/finance/cashflow'); setRows(d.rows ?? []); } catch {} setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  function openAdd()        { setEditing(null); setForm({ date: '', type: 'Payment', category: 'Salary', description: '', payment: '', receipt: '', ref_no: '' }); setModal(true); }
  function openEdit(r: Rec) { setEditing(r); setForm({ date: r.date ?? '', type: r.type, category: r.category, description: r.description ?? '', payment: String(r.payment), receipt: String(r.receipt), ref_no: r.ref_no ?? '' }); setModal(true); }
  async function save() {
    setSaving(true);
    try {
      const body = { date: form.date, type: form.type, category: form.category, description: form.description, payment: Number(form.payment), receipt: Number(form.receipt), ref_no: form.ref_no };
      if (editing) await apiFetch(`/api/finance/cashflow/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      else await apiFetch('/api/finance/cashflow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      await load(); setModal(false);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Error'); }
    setSaving(false);
  }
  async function del(id: number) { if (!confirm('Delete this transaction?')) return; await apiFetch(`/api/finance/cashflow/${id}`, { method: 'DELETE' }); await load(); }

  const totalPayment = rows.reduce((s, r) => s + Number(r.payment), 0);
  const totalReceipt = rows.reduce((s, r) => s + Number(r.receipt), 0);

  const monthMap: Record<string, { payment: number; receipt: number }> = {};
  for (const r of rows) {
    const key = r.date ? new Date(r.date).toLocaleString('en-GB', { month: 'short', year: 'numeric' }) : 'Unknown';
    if (!monthMap[key]) monthMap[key] = { payment: 0, receipt: 0 };
    monthMap[key].payment += Number(r.payment);
    monthMap[key].receipt += Number(r.receipt);
  }
  const monthSummary = Object.entries(monthMap).map(([month, v]) => ({ month, ...v, profit: v.receipt - v.payment }));

  return (
    <div className="space-y-6">
      <div>
        <TableHeader title="Payments &amp; Receipts" onAdd={openAdd} />
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead><tr className="bg-[#2E3093]">
              <th className={thCls}>Date</th>
              <th className={thCls}>Type</th>
              <th className={thCls}>Category</th>
              <th className={thCls}>Description</th>
              <th className={`${thCls} text-center`}>Payment (₹)</th>
              <th className={`${thCls} text-center`}>Receipt (₹)</th>
              <th className={thCls}>Ref / Voucher</th>
              <th className={`${thCls} text-center`}>Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <LoadingRow cols={8} /> : rows.length === 0 ? <EmptyRow cols={8} /> : rows.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                  <td className={tdCls}>{r.date}</td>
                  <td className={tdCls}><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${r.type === 'Receipt' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.type}</span></td>
                  <td className={tdCls}>{r.category}</td>
                  <td className={tdCls}>{r.description}</td>
                  <td className={`${tdNum} text-red-600`}>{r.payment ? fmt(r.payment) : '—'}</td>
                  <td className={`${tdNum} text-green-700`}>{r.receipt ? fmt(r.receipt) : '—'}</td>
                  <td className={tdCls}>{r.ref_no || '—'}</td>
                  <RowActions onEdit={() => openEdit(r)} onDelete={() => del(r.id)} />
                </tr>
              ))}
              {rows.length > 0 && (
                <tr className="bg-[#2E3093]/5 border-t-2 border-[#2E3093]/20 font-semibold">
                  <td colSpan={4} className="px-3 py-2 text-xs text-[#2E3093]">Total</td>
                  <td className="px-3 py-2 text-xs text-center text-red-600">{fmt(totalPayment)}</td>
                  <td className="px-3 py-2 text-xs text-center text-green-700">{fmt(totalReceipt)}</td>
                  <td colSpan={2} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <SectionTitle>Month-wise Summary (auto-computed)</SectionTitle>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead><tr className="bg-[#2E3093]">
              <th className={thCls}>Month</th>
              <th className={`${thCls} text-center`}>Payment (₹)</th>
              <th className={`${thCls} text-center`}>Receipt (₹)</th>
              <th className={`${thCls} text-center`}>Profit (₹)</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {monthSummary.length === 0 ? (
                <tr><td colSpan={4} className="py-6 text-center text-xs text-gray-400 italic">Auto-computed from transactions above</td></tr>
              ) : monthSummary.map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                  <td className={tdCls}>{r.month}</td>
                  <td className={`${tdNum} text-red-600`}>{fmt(r.payment)}</td>
                  <td className={`${tdNum} text-green-700`}>{fmt(r.receipt)}</td>
                  <td className={`${tdNum} ${r.profit < 0 ? 'text-red-600' : 'text-green-700'} font-semibold`}>{fmt(r.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} title={editing ? 'Edit Transaction' : 'Add Transaction'} saving={saving} onClose={() => setModal(false)} onSave={save}>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Date</label><input type="date" className={inpCls} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
          <div><label className={lblCls}>Type</label>
            <select className={inpCls} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {CF_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div><label className={lblCls}>Category</label>
          <select className={inpCls} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {CF_CATS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div><label className={lblCls}>Description</label><input className={inpCls} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Payment (₹)</label><input type="number" className={inpCls} value={form.payment} onChange={e => setForm(f => ({ ...f, payment: e.target.value }))} /></div>
          <div><label className={lblCls}>Receipt (₹)</label><input type="number" className={inpCls} value={form.receipt} onChange={e => setForm(f => ({ ...f, receipt: e.target.value }))} /></div>
        </div>
        <div><label className={lblCls}>Ref / Voucher No.</label><input className={inpCls} value={form.ref_no} onChange={e => setForm(f => ({ ...f, ref_no: e.target.value }))} /></div>
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   FINANCE FULL DASHBOARD (embeddable component)
════════════════════════════════════════════════════════════════════ */
export default function FinanceFullDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const tabContent: Record<TabId, ReactNode> = {
    overview:   <OverviewTab />,
    cbd:        <CbdTab />,
    ct:         <CtTab />,
    deputation: <DeputationTab />,
    projects:   <ProjectsTab />,
    debt:       <DebtTab />,
    cashflow:   <CashflowTab />,
  };

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-xl font-bold text-[#2E3093]">Finance Dashboard</h1>
        <p className="text-xs text-gray-500 mt-0.5">Departments: CBD / Inhouse Training · Corporate Training · Deputation (Accent) · Accent Projects</p>
      </div>
      <div className="border-b border-gray-200">
        <div className="flex gap-0.5 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${activeTab === t.id ? 'border-[#2E3093] text-[#2E3093]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="form-card p-4">
        {tabContent[activeTab]}
      </div>
    </div>
  );
}
