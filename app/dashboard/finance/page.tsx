'use client';

import { useState, ReactNode } from 'react';

/* ─────────────────────────── Tab config ─────────────────────────── */
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

/* ─────────────────────────── Row types ──────────────────────────── */
interface LoanRow        { id: number; bankName: string; outstanding: number; paid: number }
interface SalaryCashflow { totalPayable: number; salaryPaid: number; salaryPending: number; nextPayout: string }
interface CbdRow         { id: number; programme: string; frequency: number; targetStudents: number; achievedStudents: number; feesTarget: number; feesReceived: number }
interface PendingFeeRow  { id: number; studentName: string; batch: string; totalFees: number; paid: number; dueDate: string }
interface CtRow          { id: number; month: string; trainingName: string; count: number; cost: number; target: number }
interface DeputationRow  { id: number; month: string; actualCost: number; targetCost: number }
interface ProjectRow     { id: number; month: string; actualCost: number; targetCost: number }
interface DebtPlanRow    { id: number; bankName: string; emiAmount: number; plannedDate: string; actualPaid: number; actualDate: string; status: string }
interface ProjectionRow  { id: number; month: string; revenue: number; expenses: number; loanRepayment: number }
interface CashflowRow    { id: number; date: string; type: string; category: string; description: string; payment: number; receipt: number; ref: string }

/* ─────────────────────────── Style constants ────────────────────── */
const thCls  = 'px-3 py-2 text-left text-[10px] font-semibold text-white uppercase tracking-wide whitespace-nowrap';
const tdCls  = 'px-3 py-2 text-xs text-gray-700';
const tdNum  = 'px-3 py-2 text-xs text-center text-gray-700';
const inpCls = 'w-full text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]';
const lblCls = 'block text-[10px] font-medium text-gray-600 mb-0.5';

function fmt(n: number) { return n === 0 ? '—' : `₹${n.toLocaleString('en-IN')}`; }
function pct(a: number, b: number) { return b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '—'; }
let nextId = 1;
function uid() { return nextId++; }

/* ─────────────────────────── Generic components ─────────────────── */
function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-bold text-[#2E3093] border-b border-[#2E3093]/20 pb-1 mb-3">{children}</h2>;
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="py-6 text-center text-xs text-gray-400 italic">
        No records yet — click &quot;+ Add&quot; to add the first entry
      </td>
    </tr>
  );
}

function TableHeader({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <SectionTitle>{title}</SectionTitle>
      <button
        onClick={onAdd}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#2E3093] text-white hover:bg-[#252880] transition-colors"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
        Add
      </button>
    </div>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <td className="px-2 py-1.5 text-center whitespace-nowrap">
      <button
        onClick={onEdit}
        title="Edit"
        className="inline-flex items-center justify-center w-6 h-6 rounded text-blue-600 hover:bg-blue-50 transition-colors mr-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
      <button
        onClick={onDelete}
        title="Delete"
        className="inline-flex items-center justify-center w-6 h-6 rounded text-red-500 hover:bg-red-50 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </td>
  );
}

function Modal({ open, title, onClose, onSave, children }: {
  open: boolean; title: string; onClose: () => void; onSave: () => void; children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-[#2E3093] text-white">
          <h3 className="text-sm font-bold">{title}</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">{children}</div>
        <div className="flex justify-end gap-2 px-5 pb-4">
          <button onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={onSave}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#2E3093] text-white hover:bg-[#252880] transition-colors">
            Save
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
  const [month, setMonth] = useState(new Date().getMonth());

  /* --- Loans --- */
  const [loans, setLoans]         = useState<LoanRow[]>([]);
  const [loanModal, setLoanModal] = useState(false);
  const [editLoan, setEditLoan]   = useState<LoanRow | null>(null);
  const [loanForm, setLoanForm]   = useState({ bankName: '', outstanding: '', paid: '' });

  function openAddLoan()            { setEditLoan(null); setLoanForm({ bankName: '', outstanding: '', paid: '' }); setLoanModal(true); }
  function openEditLoan(r: LoanRow) { setEditLoan(r); setLoanForm({ bankName: r.bankName, outstanding: String(r.outstanding), paid: String(r.paid) }); setLoanModal(true); }
  function saveLoan() {
    const row: LoanRow = { id: editLoan?.id ?? uid(), bankName: loanForm.bankName, outstanding: Number(loanForm.outstanding), paid: Number(loanForm.paid) };
    setLoans(prev => editLoan ? prev.map(r => r.id === editLoan.id ? row : r) : [...prev, row]);
    setLoanModal(false);
  }

  /* --- Salary cashflow --- */
  const [salary, setSalary]           = useState<SalaryCashflow>({ totalPayable: 0, salaryPaid: 0, salaryPending: 0, nextPayout: '' });
  const [salaryModal, setSalaryModal] = useState(false);
  const [salaryForm, setSalaryForm]   = useState({ totalPayable: '', salaryPaid: '', salaryPending: '', nextPayout: '' });

  function openSalary() { setSalaryForm({ totalPayable: String(salary.totalPayable), salaryPaid: String(salary.salaryPaid), salaryPending: String(salary.salaryPending), nextPayout: salary.nextPayout }); setSalaryModal(true); }
  function saveSalary() { setSalary({ totalPayable: Number(salaryForm.totalPayable), salaryPaid: Number(salaryForm.salaryPaid), salaryPending: Number(salaryForm.salaryPending), nextPayout: salaryForm.nextPayout }); setSalaryModal(false); }

  const salaryCards = [
    { label: 'Total Salary Payable', value: salary.totalPayable ? fmt(salary.totalPayable) : '—' },
    { label: 'Salary Paid',          value: salary.salaryPaid   ? fmt(salary.salaryPaid)   : '—' },
    { label: 'Salary Pending',       value: salary.salaryPending ? fmt(salary.salaryPending) : '—' },
    { label: 'Next Payout Date',     value: salary.nextPayout   || '—' },
  ];

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-gray-600">Month:</label>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="text-xs rounded-lg border border-gray-200 bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]">
          {MONTHS_SELECT.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <span className="text-xs text-gray-400">FY 2025–26</span>
      </div>

      {/* Department summary — read-only aggregate */}
      <div>
        <SectionTitle>Department Performance — {MONTHS_SELECT[month]}</SectionTitle>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#2E3093]">
                <th className={thCls}>Department</th>
                <th className={`${thCls} text-center`}>Amount Achieved (₹)</th>
                <th className={`${thCls} text-center`}>Target Amount (₹)</th>
                <th className={`${thCls} text-center`}>%age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <EmptyRow cols={4} />
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Auto-aggregated from department tabs once data is entered.</p>
      </div>

      {/* Outstanding Loans */}
      <div>
        <TableHeader title="Outstanding Loans" onAdd={openAddLoan} />
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#2E3093]">
                <th className={thCls}>Bank Name</th>
                <th className={`${thCls} text-center`}>Outstanding Amount (₹)</th>
                <th className={`${thCls} text-center`}>Paid Amount (₹)</th>
                <th className={`${thCls} text-center`}>%age Paid</th>
                <th className={`${thCls} text-center`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loans.length === 0 ? <EmptyRow cols={5} /> : loans.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                  <td className={tdCls}>{r.bankName}</td>
                  <td className={tdNum}>{fmt(r.outstanding)}</td>
                  <td className={tdNum}>{fmt(r.paid)}</td>
                  <td className={tdNum}>{pct(r.paid, r.outstanding)}</td>
                  <RowActions onEdit={() => openEditLoan(r)} onDelete={() => setLoans(prev => prev.filter(x => x.id !== r.id))} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Salary Cashflow */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionTitle>Salary Cashflow</SectionTitle>
          <button onClick={openSalary}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#2E3093] text-[#2E3093] hover:bg-[#2E3093]/5 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {salaryCards.map(c => (
            <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{c.label}</p>
              <p className="text-xl font-bold text-[#2E3093] mt-1">{c.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Loan modal */}
      <Modal open={loanModal} title={editLoan ? 'Edit Loan' : 'Add Loan'} onClose={() => setLoanModal(false)} onSave={saveLoan}>
        <div><label className={lblCls}>Bank Name</label><input className={inpCls} value={loanForm.bankName} onChange={e => setLoanForm(f => ({ ...f, bankName: e.target.value }))} /></div>
        <div><label className={lblCls}>Outstanding Amount (₹)</label><input type="number" className={inpCls} value={loanForm.outstanding} onChange={e => setLoanForm(f => ({ ...f, outstanding: e.target.value }))} /></div>
        <div><label className={lblCls}>Paid Amount (₹)</label><input type="number" className={inpCls} value={loanForm.paid} onChange={e => setLoanForm(f => ({ ...f, paid: e.target.value }))} /></div>
      </Modal>

      {/* Salary modal */}
      <Modal open={salaryModal} title="Edit Salary Cashflow" onClose={() => setSalaryModal(false)} onSave={saveSalary}>
        <div><label className={lblCls}>Total Salary Payable (₹)</label><input type="number" className={inpCls} value={salaryForm.totalPayable} onChange={e => setSalaryForm(f => ({ ...f, totalPayable: e.target.value }))} /></div>
        <div><label className={lblCls}>Salary Paid (₹)</label><input type="number" className={inpCls} value={salaryForm.salaryPaid} onChange={e => setSalaryForm(f => ({ ...f, salaryPaid: e.target.value }))} /></div>
        <div><label className={lblCls}>Salary Pending (₹)</label><input type="number" className={inpCls} value={salaryForm.salaryPending} onChange={e => setSalaryForm(f => ({ ...f, salaryPending: e.target.value }))} /></div>
        <div><label className={lblCls}>Next Payout Date</label><input type="date" className={inpCls} value={salaryForm.nextPayout} onChange={e => setSalaryForm(f => ({ ...f, nextPayout: e.target.value }))} /></div>
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CBD / INHOUSE TAB
════════════════════════════════════════════════════════════════════ */
function CbdTab() {
  /* --- Yearly performance --- */
  const [rows, setRows]       = useState<CbdRow[]>([]);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<CbdRow | null>(null);
  const [form, setForm]       = useState({ programme: '', frequency: '', targetStudents: '', achievedStudents: '', feesTarget: '', feesReceived: '' });

  function openAdd()           { setEditing(null); setForm({ programme: '', frequency: '', targetStudents: '', achievedStudents: '', feesTarget: '', feesReceived: '' }); setModal(true); }
  function openEdit(r: CbdRow) { setEditing(r); setForm({ programme: r.programme, frequency: String(r.frequency), targetStudents: String(r.targetStudents), achievedStudents: String(r.achievedStudents), feesTarget: String(r.feesTarget), feesReceived: String(r.feesReceived) }); setModal(true); }
  function save() {
    const row: CbdRow = { id: editing?.id ?? uid(), programme: form.programme, frequency: Number(form.frequency), targetStudents: Number(form.targetStudents), achievedStudents: Number(form.achievedStudents), feesTarget: Number(form.feesTarget), feesReceived: Number(form.feesReceived) };
    setRows(prev => editing ? prev.map(r => r.id === editing.id ? row : r) : [...prev, row]);
    setModal(false);
  }

  /* --- Pending fees --- */
  const [fees, setFees]           = useState<PendingFeeRow[]>([]);
  const [feeModal, setFeeModal]   = useState(false);
  const [editFee, setEditFee]     = useState<PendingFeeRow | null>(null);
  const [feeForm, setFeeForm]     = useState({ studentName: '', batch: '', totalFees: '', paid: '', dueDate: '' });

  function openAddFee()                  { setEditFee(null); setFeeForm({ studentName: '', batch: '', totalFees: '', paid: '', dueDate: '' }); setFeeModal(true); }
  function openEditFee(r: PendingFeeRow) { setEditFee(r); setFeeForm({ studentName: r.studentName, batch: r.batch, totalFees: String(r.totalFees), paid: String(r.paid), dueDate: r.dueDate }); setFeeModal(true); }
  function saveFee() {
    const row: PendingFeeRow = { id: editFee?.id ?? uid(), studentName: feeForm.studentName, batch: feeForm.batch, totalFees: Number(feeForm.totalFees), paid: Number(feeForm.paid), dueDate: feeForm.dueDate };
    setFees(prev => editFee ? prev.map(r => r.id === editFee.id ? row : r) : [...prev, row]);
    setFeeModal(false);
  }

  return (
    <div className="space-y-6">
      {/* Yearly performance table */}
      <div>
        <TableHeader title="CBD / Inhouse Training — Yearly Performance" onAdd={openAdd} />
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#2E3093]">
                <th className={thCls}>Training Programme Name</th>
                <th className={`${thCls} text-center`}>Frequency</th>
                <th className={`${thCls} text-center`}>Target Students</th>
                <th className={`${thCls} text-center`}>Achieved Students</th>
                <th className={`${thCls} text-center`}>Fees Target (₹)</th>
                <th className={`${thCls} text-center`}>Fees Received (₹)</th>
                <th className={`${thCls} text-center`}>%age</th>
                <th className={`${thCls} text-center`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? <EmptyRow cols={8} /> : rows.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                  <td className={tdCls}>{r.programme}</td>
                  <td className={tdNum}>{r.frequency}</td>
                  <td className={tdNum}>{r.targetStudents}</td>
                  <td className={tdNum}>{r.achievedStudents}</td>
                  <td className={tdNum}>{fmt(r.feesTarget)}</td>
                  <td className={tdNum}>{fmt(r.feesReceived)}</td>
                  <td className={tdNum}>{pct(r.feesReceived, r.feesTarget)}</td>
                  <RowActions onEdit={() => openEdit(r)} onDelete={() => setRows(p => p.filter(x => x.id !== r.id))} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending fees table */}
      <div>
        <TableHeader title="Pending Fees" onAdd={openAddFee} />
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#2E3093]">
                <th className={thCls}>Student Name</th>
                <th className={thCls}>Batch / Programme</th>
                <th className={`${thCls} text-center`}>Total Fees (₹)</th>
                <th className={`${thCls} text-center`}>Paid (₹)</th>
                <th className={`${thCls} text-center`}>Pending (₹)</th>
                <th className={`${thCls} text-center`}>Due Date</th>
                <th className={`${thCls} text-center`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fees.length === 0 ? <EmptyRow cols={7} /> : fees.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                  <td className={tdCls}>{r.studentName}</td>
                  <td className={tdCls}>{r.batch}</td>
                  <td className={tdNum}>{fmt(r.totalFees)}</td>
                  <td className={tdNum}>{fmt(r.paid)}</td>
                  <td className={`${tdNum} text-red-600 font-medium`}>{fmt(Math.max(0, r.totalFees - r.paid))}</td>
                  <td className={tdNum}>{r.dueDate}</td>
                  <RowActions onEdit={() => openEditFee(r)} onDelete={() => setFees(p => p.filter(x => x.id !== r.id))} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <Modal open={modal} title={editing ? 'Edit Training Record' : 'Add Training Record'} onClose={() => setModal(false)} onSave={save}>
        <div><label className={lblCls}>Training Programme Name</label><input className={inpCls} value={form.programme} onChange={e => setForm(f => ({ ...f, programme: e.target.value }))} /></div>
        <div><label className={lblCls}>Frequency Conducted</label><input type="number" className={inpCls} value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Target Students</label><input type="number" className={inpCls} value={form.targetStudents} onChange={e => setForm(f => ({ ...f, targetStudents: e.target.value }))} /></div>
          <div><label className={lblCls}>Achieved Students</label><input type="number" className={inpCls} value={form.achievedStudents} onChange={e => setForm(f => ({ ...f, achievedStudents: e.target.value }))} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Fees Target (₹)</label><input type="number" className={inpCls} value={form.feesTarget} onChange={e => setForm(f => ({ ...f, feesTarget: e.target.value }))} /></div>
          <div><label className={lblCls}>Fees Received (₹)</label><input type="number" className={inpCls} value={form.feesReceived} onChange={e => setForm(f => ({ ...f, feesReceived: e.target.value }))} /></div>
        </div>
      </Modal>

      <Modal open={feeModal} title={editFee ? 'Edit Pending Fee' : 'Add Pending Fee'} onClose={() => setFeeModal(false)} onSave={saveFee}>
        <div><label className={lblCls}>Student Name</label><input className={inpCls} value={feeForm.studentName} onChange={e => setFeeForm(f => ({ ...f, studentName: e.target.value }))} /></div>
        <div><label className={lblCls}>Batch / Programme</label><input className={inpCls} value={feeForm.batch} onChange={e => setFeeForm(f => ({ ...f, batch: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Total Fees (₹)</label><input type="number" className={inpCls} value={feeForm.totalFees} onChange={e => setFeeForm(f => ({ ...f, totalFees: e.target.value }))} /></div>
          <div><label className={lblCls}>Paid (₹)</label><input type="number" className={inpCls} value={feeForm.paid} onChange={e => setFeeForm(f => ({ ...f, paid: e.target.value }))} /></div>
        </div>
        <div><label className={lblCls}>Due Date</label><input type="date" className={inpCls} value={feeForm.dueDate} onChange={e => setFeeForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CORPORATE TRAINING TAB
════════════════════════════════════════════════════════════════════ */
function CtTab() {
  const [rows, setRows]       = useState<CtRow[]>([]);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<CtRow | null>(null);
  const [form, setForm]       = useState({ month: '', trainingName: '', count: '', cost: '', target: '' });

  function openAdd()          { setEditing(null); setForm({ month: '', trainingName: '', count: '', cost: '', target: '' }); setModal(true); }
  function openEdit(r: CtRow) { setEditing(r); setForm({ month: r.month, trainingName: r.trainingName, count: String(r.count), cost: String(r.cost), target: String(r.target) }); setModal(true); }
  function save() {
    const row: CtRow = { id: editing?.id ?? uid(), month: form.month, trainingName: form.trainingName, count: Number(form.count), cost: Number(form.cost), target: Number(form.target) };
    setRows(prev => editing ? prev.map(r => r.id === editing.id ? row : r) : [...prev, row]);
    setModal(false);
  }

  return (
    <div className="space-y-4">
      <TableHeader title="Corporate Training — Monthly Performance" onAdd={openAdd} />
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#2E3093]">
              <th className={thCls}>Month</th>
              <th className={thCls}>Training Name</th>
              <th className={`${thCls} text-center`}>Conducted (No.)</th>
              <th className={`${thCls} text-center`}>Conducted Cost (₹)</th>
              <th className={`${thCls} text-center`}>Conducted Target (₹)</th>
              <th className={`${thCls} text-center`}>%age</th>
              <th className={`${thCls} text-center`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? <EmptyRow cols={7} /> : rows.map((r, i) => (
              <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                <td className={tdCls}>{r.month}</td>
                <td className={tdCls}>{r.trainingName}</td>
                <td className={tdNum}>{r.count}</td>
                <td className={tdNum}>{fmt(r.cost)}</td>
                <td className={tdNum}>{fmt(r.target)}</td>
                <td className={tdNum}>{pct(r.cost, r.target)}</td>
                <RowActions onEdit={() => openEdit(r)} onDelete={() => setRows(p => p.filter(x => x.id !== r.id))} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal} title={editing ? 'Edit CT Record' : 'Add CT Record'} onClose={() => setModal(false)} onSave={save}>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Month</label><input className={inpCls} placeholder="e.g. April" value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} /></div>
          <div><label className={lblCls}>Trainings Conducted (No.)</label><input type="number" className={inpCls} value={form.count} onChange={e => setForm(f => ({ ...f, count: e.target.value }))} /></div>
        </div>
        <div><label className={lblCls}>Training Name</label><input className={inpCls} value={form.trainingName} onChange={e => setForm(f => ({ ...f, trainingName: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Conducted Cost (₹)</label><input type="number" className={inpCls} value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} /></div>
          <div><label className={lblCls}>Conducted Target (₹)</label><input type="number" className={inpCls} value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   DEPUTATION TAB
════════════════════════════════════════════════════════════════════ */
function DeputationTab() {
  const [rows, setRows]       = useState<DeputationRow[]>([]);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<DeputationRow | null>(null);
  const [form, setForm]       = useState({ month: '', actualCost: '', targetCost: '' });

  function openAdd()                { setEditing(null); setForm({ month: '', actualCost: '', targetCost: '' }); setModal(true); }
  function openEdit(r: DeputationRow) { setEditing(r); setForm({ month: r.month, actualCost: String(r.actualCost), targetCost: String(r.targetCost) }); setModal(true); }
  function save() {
    const row: DeputationRow = { id: editing?.id ?? uid(), month: form.month, actualCost: Number(form.actualCost), targetCost: Number(form.targetCost) };
    setRows(prev => editing ? prev.map(r => r.id === editing.id ? row : r) : [...prev, row]);
    setModal(false);
  }

  const totalActual = rows.reduce((s, r) => s + r.actualCost, 0);
  const totalTarget = rows.reduce((s, r) => s + r.targetCost, 0);

  return (
    <div className="space-y-4">
      <TableHeader title="Accent Deputation — Monthly Performance" onAdd={openAdd} />
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#2E3093]">
              <th className={thCls}>Month</th>
              <th className={`${thCls} text-center`}>Actual Cost (₹)</th>
              <th className={`${thCls} text-center`}>Targeted Cost (₹)</th>
              <th className={`${thCls} text-center`}>%age</th>
              <th className={`${thCls} text-center`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? <EmptyRow cols={5} /> : rows.map((r, i) => (
              <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                <td className={tdCls}>{r.month}</td>
                <td className={tdNum}>{fmt(r.actualCost)}</td>
                <td className={tdNum}>{fmt(r.targetCost)}</td>
                <td className={tdNum}>{pct(r.actualCost, r.targetCost)}</td>
                <RowActions onEdit={() => openEdit(r)} onDelete={() => setRows(p => p.filter(x => x.id !== r.id))} />
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

      <Modal open={modal} title={editing ? 'Edit Deputation Record' : 'Add Deputation Record'} onClose={() => setModal(false)} onSave={save}>
        <div><label className={lblCls}>Month</label><input className={inpCls} placeholder="e.g. April" value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Actual Cost (₹)</label><input type="number" className={inpCls} value={form.actualCost} onChange={e => setForm(f => ({ ...f, actualCost: e.target.value }))} /></div>
          <div><label className={lblCls}>Targeted Cost (₹)</label><input type="number" className={inpCls} value={form.targetCost} onChange={e => setForm(f => ({ ...f, targetCost: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   ACCENT PROJECTS TAB
════════════════════════════════════════════════════════════════════ */
function ProjectsTab() {
  const [rows, setRows]       = useState<ProjectRow[]>([]);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<ProjectRow | null>(null);
  const [form, setForm]       = useState({ month: '', actualCost: '', targetCost: '' });

  function openAdd()              { setEditing(null); setForm({ month: '', actualCost: '', targetCost: '' }); setModal(true); }
  function openEdit(r: ProjectRow) { setEditing(r); setForm({ month: r.month, actualCost: String(r.actualCost), targetCost: String(r.targetCost) }); setModal(true); }
  function save() {
    const row: ProjectRow = { id: editing?.id ?? uid(), month: form.month, actualCost: Number(form.actualCost), targetCost: Number(form.targetCost) };
    setRows(prev => editing ? prev.map(r => r.id === editing.id ? row : r) : [...prev, row]);
    setModal(false);
  }

  const totalActual = rows.reduce((s, r) => s + r.actualCost, 0);
  const totalTarget = rows.reduce((s, r) => s + r.targetCost, 0);

  return (
    <div className="space-y-4">
      <TableHeader title="Accent Projects — Monthly Performance" onAdd={openAdd} />
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#2E3093]">
              <th className={thCls}>Month</th>
              <th className={`${thCls} text-center`}>Actual Cost (₹)</th>
              <th className={`${thCls} text-center`}>Targeted Cost (₹)</th>
              <th className={`${thCls} text-center`}>%age</th>
              <th className={`${thCls} text-center`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? <EmptyRow cols={5} /> : rows.map((r, i) => (
              <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                <td className={tdCls}>{r.month}</td>
                <td className={tdNum}>{fmt(r.actualCost)}</td>
                <td className={tdNum}>{fmt(r.targetCost)}</td>
                <td className={tdNum}>{pct(r.actualCost, r.targetCost)}</td>
                <RowActions onEdit={() => openEdit(r)} onDelete={() => setRows(p => p.filter(x => x.id !== r.id))} />
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

      <Modal open={modal} title={editing ? 'Edit Project Record' : 'Add Project Record'} onClose={() => setModal(false)} onSave={save}>
        <div><label className={lblCls}>Month</label><input className={inpCls} placeholder="e.g. April" value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Actual Cost (₹)</label><input type="number" className={inpCls} value={form.actualCost} onChange={e => setForm(f => ({ ...f, actualCost: e.target.value }))} /></div>
          <div><label className={lblCls}>Targeted Cost (₹)</label><input type="number" className={inpCls} value={form.targetCost} onChange={e => setForm(f => ({ ...f, targetCost: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   DEBT REPAYMENT TAB
════════════════════════════════════════════════════════════════════ */
function DebtTab() {
  /* --- Debt plan vs actual --- */
  const [plans, setPlans]         = useState<DebtPlanRow[]>([]);
  const [planModal, setPlanModal] = useState(false);
  const [editPlan, setEditPlan]   = useState<DebtPlanRow | null>(null);
  const [planForm, setPlanForm]   = useState({ bankName: '', emiAmount: '', plannedDate: '', actualPaid: '', actualDate: '', status: 'Pending' });

  function openAddPlan()                { setEditPlan(null); setPlanForm({ bankName: '', emiAmount: '', plannedDate: '', actualPaid: '', actualDate: '', status: 'Pending' }); setPlanModal(true); }
  function openEditPlan(r: DebtPlanRow) { setEditPlan(r); setPlanForm({ bankName: r.bankName, emiAmount: String(r.emiAmount), plannedDate: r.plannedDate, actualPaid: String(r.actualPaid), actualDate: r.actualDate, status: r.status }); setPlanModal(true); }
  function savePlan() {
    const row: DebtPlanRow = { id: editPlan?.id ?? uid(), bankName: planForm.bankName, emiAmount: Number(planForm.emiAmount), plannedDate: planForm.plannedDate, actualPaid: Number(planForm.actualPaid), actualDate: planForm.actualDate, status: planForm.status };
    setPlans(prev => editPlan ? prev.map(r => r.id === editPlan.id ? row : r) : [...prev, row]);
    setPlanModal(false);
  }

  /* --- Projected cashflow --- */
  const [projRows, setProjRows]   = useState<ProjectionRow[]>([]);
  const [projModal, setProjModal] = useState(false);
  const [editProj, setEditProj]   = useState<ProjectionRow | null>(null);
  const [projForm, setProjForm]   = useState({ month: '', revenue: '', expenses: '', loanRepayment: '' });

  function openAddProj()                  { setEditProj(null); setProjForm({ month: '', revenue: '', expenses: '', loanRepayment: '' }); setProjModal(true); }
  function openEditProj(r: ProjectionRow) { setEditProj(r); setProjForm({ month: r.month, revenue: String(r.revenue), expenses: String(r.expenses), loanRepayment: String(r.loanRepayment) }); setProjModal(true); }
  function saveProj() {
    const row: ProjectionRow = { id: editProj?.id ?? uid(), month: projForm.month, revenue: Number(projForm.revenue), expenses: Number(projForm.expenses), loanRepayment: Number(projForm.loanRepayment) };
    setProjRows(prev => editProj ? prev.map(r => r.id === editProj.id ? row : r) : [...prev, row]);
    setProjModal(false);
  }

  return (
    <div className="space-y-6">
      {/* Stat widgets */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Upcoming Payment (30 days)', value: plans.filter(r => r.status === 'Pending').reduce((s, r) => s + r.emiAmount, 0) },
          { label: 'Total Debt Remaining',        value: plans.reduce((s, r) => s + Math.max(0, r.emiAmount - r.actualPaid), 0) },
          { label: 'Total Paid (All Time)',        value: plans.reduce((s, r) => s + r.actualPaid, 0) },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{c.label}</p>
            <p className="text-xl font-bold text-[#2E3093] mt-1">{c.value ? fmt(c.value) : '—'}</p>
          </div>
        ))}
      </div>

      {/* Pie chart placeholder */}
      <div>
        <SectionTitle>Debt by Bank (Pie Chart)</SectionTitle>
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center h-40 text-gray-400 text-sm">
          Chart will render here once loan data is entered
        </div>
      </div>

      {/* Revenue by dept chart placeholder */}
      <div>
        <SectionTitle>Revenue by Department (Bar Chart)</SectionTitle>
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center h-40 text-gray-400 text-sm">
          Monthly revenue chart will render here
        </div>
      </div>

      {/* Debt plan vs actual */}
      <div>
        <TableHeader title="Debt Plan vs Actual" onAdd={openAddPlan} />
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#2E3093]">
                <th className={thCls}>Bank Name</th>
                <th className={`${thCls} text-center`}>EMI Amount (₹)</th>
                <th className={`${thCls} text-center`}>Planned Date</th>
                <th className={`${thCls} text-center`}>Actual Paid (₹)</th>
                <th className={`${thCls} text-center`}>Actual Date</th>
                <th className={`${thCls} text-center`}>Variance (₹)</th>
                <th className={`${thCls} text-center`}>Status</th>
                <th className={`${thCls} text-center`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {plans.length === 0 ? <EmptyRow cols={8} /> : plans.map((r, i) => {
                const variance = r.actualPaid - r.emiAmount;
                return (
                  <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                    <td className={tdCls}>{r.bankName}</td>
                    <td className={tdNum}>{fmt(r.emiAmount)}</td>
                    <td className={tdNum}>{r.plannedDate}</td>
                    <td className={tdNum}>{fmt(r.actualPaid)}</td>
                    <td className={tdNum}>{r.actualDate || '—'}</td>
                    <td className={`${tdNum} ${variance < 0 ? 'text-red-600' : 'text-green-600'} font-medium`}>{r.actualPaid ? fmt(variance) : '—'}</td>
                    <td className={tdNum}>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${r.status === 'Paid' ? 'bg-green-100 text-green-700' : r.status === 'Overdue' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {r.status}
                      </span>
                    </td>
                    <RowActions onEdit={() => openEditPlan(r)} onDelete={() => setPlans(p => p.filter(x => x.id !== r.id))} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Projected cashflow */}
      <div>
        <TableHeader title="Projected Cashflow — Upcoming Months" onAdd={openAddProj} />
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#2E3093]">
                <th className={thCls}>Month</th>
                <th className={`${thCls} text-center`}>Projected Revenue (₹)</th>
                <th className={`${thCls} text-center`}>Projected Expenses (₹)</th>
                <th className={`${thCls} text-center`}>Loan Repayment (₹)</th>
                <th className={`${thCls} text-center`}>Net Cashflow (₹)</th>
                <th className={`${thCls} text-center`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {projRows.length === 0 ? <EmptyRow cols={6} /> : projRows.map((r, i) => {
                const net = r.revenue - r.expenses - r.loanRepayment;
                return (
                  <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                    <td className={tdCls}>{r.month}</td>
                    <td className={tdNum}>{fmt(r.revenue)}</td>
                    <td className={tdNum}>{fmt(r.expenses)}</td>
                    <td className={tdNum}>{fmt(r.loanRepayment)}</td>
                    <td className={`${tdNum} ${net < 0 ? 'text-red-600' : 'text-green-700'} font-semibold`}>{fmt(net)}</td>
                    <RowActions onEdit={() => openEditProj(r)} onDelete={() => setProjRows(p => p.filter(x => x.id !== r.id))} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <Modal open={planModal} title={editPlan ? 'Edit Debt Plan Record' : 'Add Debt Plan Record'} onClose={() => setPlanModal(false)} onSave={savePlan}>
        <div><label className={lblCls}>Bank Name</label><input className={inpCls} value={planForm.bankName} onChange={e => setPlanForm(f => ({ ...f, bankName: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>EMI Amount (₹)</label><input type="number" className={inpCls} value={planForm.emiAmount} onChange={e => setPlanForm(f => ({ ...f, emiAmount: e.target.value }))} /></div>
          <div><label className={lblCls}>Planned Date</label><input type="date" className={inpCls} value={planForm.plannedDate} onChange={e => setPlanForm(f => ({ ...f, plannedDate: e.target.value }))} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Actual Paid (₹)</label><input type="number" className={inpCls} value={planForm.actualPaid} onChange={e => setPlanForm(f => ({ ...f, actualPaid: e.target.value }))} /></div>
          <div><label className={lblCls}>Actual Date</label><input type="date" className={inpCls} value={planForm.actualDate} onChange={e => setPlanForm(f => ({ ...f, actualDate: e.target.value }))} /></div>
        </div>
        <div>
          <label className={lblCls}>Status</label>
          <select className={inpCls} value={planForm.status} onChange={e => setPlanForm(f => ({ ...f, status: e.target.value }))}>
            <option>Pending</option><option>Paid</option><option>Overdue</option>
          </select>
        </div>
      </Modal>

      <Modal open={projModal} title={editProj ? 'Edit Projection' : 'Add Projection'} onClose={() => setProjModal(false)} onSave={saveProj}>
        <div><label className={lblCls}>Month</label><input className={inpCls} placeholder="e.g. June 2026" value={projForm.month} onChange={e => setProjForm(f => ({ ...f, month: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Projected Revenue (₹)</label><input type="number" className={inpCls} value={projForm.revenue} onChange={e => setProjForm(f => ({ ...f, revenue: e.target.value }))} /></div>
          <div><label className={lblCls}>Projected Expenses (₹)</label><input type="number" className={inpCls} value={projForm.expenses} onChange={e => setProjForm(f => ({ ...f, expenses: e.target.value }))} /></div>
        </div>
        <div><label className={lblCls}>Loan Repayment (₹)</label><input type="number" className={inpCls} value={projForm.loanRepayment} onChange={e => setProjForm(f => ({ ...f, loanRepayment: e.target.value }))} /></div>
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
  const [rows, setRows]       = useState<CashflowRow[]>([]);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<CashflowRow | null>(null);
  const [form, setForm]       = useState({ date: '', type: 'Payment', category: 'Salary', description: '', payment: '', receipt: '', ref: '' });

  function openAdd()                { setEditing(null); setForm({ date: '', type: 'Payment', category: 'Salary', description: '', payment: '', receipt: '', ref: '' }); setModal(true); }
  function openEdit(r: CashflowRow) { setEditing(r); setForm({ date: r.date, type: r.type, category: r.category, description: r.description, payment: String(r.payment), receipt: String(r.receipt), ref: r.ref }); setModal(true); }
  function save() {
    const row: CashflowRow = { id: editing?.id ?? uid(), date: form.date, type: form.type, category: form.category, description: form.description, payment: Number(form.payment), receipt: Number(form.receipt), ref: form.ref };
    setRows(prev => editing ? prev.map(r => r.id === editing.id ? row : r) : [...prev, row]);
    setModal(false);
  }

  const totalPayment = rows.reduce((s, r) => s + r.payment, 0);
  const totalReceipt = rows.reduce((s, r) => s + r.receipt, 0);

  /* Month-wise summary — auto-computed */
  const monthMap: Record<string, { payment: number; receipt: number }> = {};
  for (const r of rows) {
    const key = r.date ? new Date(r.date).toLocaleString('en-GB', { month: 'short', year: 'numeric' }) : 'Unknown';
    if (!monthMap[key]) monthMap[key] = { payment: 0, receipt: 0 };
    monthMap[key].payment += r.payment;
    monthMap[key].receipt += r.receipt;
  }
  const monthSummary = Object.entries(monthMap).map(([month, v]) => ({ month, ...v, profit: v.receipt - v.payment }));

  return (
    <div className="space-y-6">
      {/* Payments & Receipts table */}
      <div>
        <TableHeader title="Payments &amp; Receipts" onAdd={openAdd} />
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#2E3093]">
                <th className={thCls}>Date</th>
                <th className={thCls}>Type</th>
                <th className={thCls}>Category</th>
                <th className={thCls}>Description</th>
                <th className={`${thCls} text-center`}>Payment (₹)</th>
                <th className={`${thCls} text-center`}>Receipt (₹)</th>
                <th className={thCls}>Ref / Voucher</th>
                <th className={`${thCls} text-center`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? <EmptyRow cols={8} /> : rows.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                  <td className={tdCls}>{r.date}</td>
                  <td className={tdCls}>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${r.type === 'Receipt' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.type}</span>
                  </td>
                  <td className={tdCls}>{r.category}</td>
                  <td className={tdCls}>{r.description}</td>
                  <td className={`${tdNum} text-red-600`}>{r.payment ? fmt(r.payment) : '—'}</td>
                  <td className={`${tdNum} text-green-700`}>{r.receipt ? fmt(r.receipt) : '—'}</td>
                  <td className={tdCls}>{r.ref || '—'}</td>
                  <RowActions onEdit={() => openEdit(r)} onDelete={() => setRows(p => p.filter(x => x.id !== r.id))} />
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

      {/* Category-wise chart placeholder */}
      <div>
        <SectionTitle>Category-wise Column Chart</SectionTitle>
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center h-40 text-gray-400 text-sm">
          Chart renders once transaction data is entered above
        </div>
      </div>

      {/* Month-wise summary */}
      <div>
        <SectionTitle>Month-wise Summary (auto-computed)</SectionTitle>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#2E3093]">
                <th className={thCls}>Month</th>
                <th className={`${thCls} text-center`}>Payment (₹)</th>
                <th className={`${thCls} text-center`}>Receipt (₹)</th>
                <th className={`${thCls} text-center`}>Profit (₹)</th>
              </tr>
            </thead>
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

      {/* Modal */}
      <Modal open={modal} title={editing ? 'Edit Transaction' : 'Add Transaction'} onClose={() => setModal(false)} onSave={save}>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Date</label><input type="date" className={inpCls} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
          <div>
            <label className={lblCls}>Type</label>
            <select className={inpCls} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {CF_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={lblCls}>Category</label>
          <select className={inpCls} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {CF_CATS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div><label className={lblCls}>Description</label><input className={inpCls} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Payment (₹)</label><input type="number" className={inpCls} value={form.payment} onChange={e => setForm(f => ({ ...f, payment: e.target.value }))} /></div>
          <div><label className={lblCls}>Receipt (₹)</label><input type="number" className={inpCls} value={form.receipt} onChange={e => setForm(f => ({ ...f, receipt: e.target.value }))} /></div>
        </div>
        <div><label className={lblCls}>Ref / Voucher No.</label><input className={inpCls} value={form.ref} onChange={e => setForm(f => ({ ...f, ref: e.target.value }))} /></div>
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   PAGE ROOT
════════════════════════════════════════════════════════════════════ */
export default function FinanceDashboardPage() {
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
        <p className="text-xs text-gray-500 mt-0.5">
          Departments: CBD / Inhouse Training · Corporate Training · Deputation (Accent) · Accent Projects
        </p>
      </div>

      <div className="border-b border-gray-200">
        <div className="flex gap-0.5 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === t.id
                  ? 'border-[#2E3093] text-[#2E3093]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
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
