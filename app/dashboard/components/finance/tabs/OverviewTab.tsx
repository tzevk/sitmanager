'use client';

import { useCallback, useMemo, useState } from 'react';
import { useFinanceResource, useFinanceSingleton } from '../shared/useFinanceResource';
import { Modal, TableHeader, TableSkeleton, EmptyRow, RowActions, TotalRow, StatCard, SectionTitle, thCls, tdCls, tdNum, inpCls, lblCls, trCls, PctBar } from '../shared/primitives';
import { fmt, pct, MONTHS_FULL } from '../shared/format';
import type { Loan, DeptPerf, SalaryCashflow } from '../shared/types';

export default function OverviewTab() {
  const now = new Date();
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const year = now.getFullYear();
  const monthYear = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
  const monthLabel = MONTHS_FULL[monthIdx];

  const depts  = useFinanceResource<DeptPerf>('/api/finance/dept-performance', { query: `month_year=${monthYear}` });
  const loans  = useFinanceResource<Loan>('/api/finance/loans');
  const salary = useFinanceSingleton<SalaryCashflow>('/api/finance/salary-cashflow', `month_year=${monthYear}`);

  /* ── modals ─────────────────────────────────────────────── */
  const [deptModal, setDeptModal] = useState<{ open: boolean; editing: DeptPerf | null }>({ open: false, editing: null });
  const [deptForm, setDeptForm]   = useState({ department: '', amount_achieved: '', target_amount: '' });
  const [savingD, setSavingD]     = useState(false);

  const openAddDept = useCallback(() => {
    setDeptForm({ department: '', amount_achieved: '', target_amount: '' });
    setDeptModal({ open: true, editing: null });
  }, []);
  const openEditDept = useCallback((r: DeptPerf) => {
    setDeptForm({ department: r.department, amount_achieved: String(r.amount_achieved), target_amount: String(r.target_amount) });
    setDeptModal({ open: true, editing: r });
  }, []);
  const saveDept = useCallback(async () => {
    setSavingD(true);
    try {
      await depts.save({
        month_year: monthYear,
        department: deptForm.department.trim(),
        amount_achieved: Number(deptForm.amount_achieved),
        target_amount: Number(deptForm.target_amount),
      } as Partial<DeptPerf>, deptModal.editing);
      setDeptModal({ open: false, editing: null });
    } catch { /* toast already shown */ }
    setSavingD(false);
  }, [depts, monthYear, deptForm, deptModal.editing]);

  const [loanModal, setLoanModal] = useState<{ open: boolean; editing: Loan | null }>({ open: false, editing: null });
  const [loanForm, setLoanForm]   = useState({ bank_name: '', outstanding: '', paid: '' });
  const [savingL, setSavingL]     = useState(false);

  const openAddLoan = useCallback(() => {
    setLoanForm({ bank_name: '', outstanding: '', paid: '' });
    setLoanModal({ open: true, editing: null });
  }, []);
  const openEditLoan = useCallback((r: Loan) => {
    setLoanForm({ bank_name: r.bank_name, outstanding: String(r.outstanding), paid: String(r.paid) });
    setLoanModal({ open: true, editing: r });
  }, []);
  const saveLoan = useCallback(async () => {
    setSavingL(true);
    try {
      await loans.save({
        bank_name: loanForm.bank_name.trim(),
        outstanding: Number(loanForm.outstanding),
        paid: Number(loanForm.paid),
      } as Partial<Loan>, loanModal.editing);
      setLoanModal({ open: false, editing: null });
    } catch { /* toast */ }
    setSavingL(false);
  }, [loans, loanForm, loanModal.editing]);

  const [salaryModal, setSalaryModal] = useState(false);
  const [salaryForm, setSalaryForm] = useState({ total_payable: '', salary_paid: '', salary_pending: '', next_payout: '' });
  const [savingS, setSavingS] = useState(false);

  const openSalary = useCallback(() => {
    setSalaryForm({
      total_payable: salary.row?.total_payable != null ? String(salary.row.total_payable) : '',
      salary_paid:   salary.row?.salary_paid   != null ? String(salary.row.salary_paid)   : '',
      salary_pending: salary.row?.salary_pending != null ? String(salary.row.salary_pending) : '',
      next_payout:   salary.row?.next_payout ?? '',
    });
    setSalaryModal(true);
  }, [salary.row]);

  const saveSalary = useCallback(async () => {
    setSavingS(true);
    try {
      await salary.save({
        month_year: monthYear,
        total_payable:  Number(salaryForm.total_payable),
        salary_paid:    Number(salaryForm.salary_paid),
        salary_pending: Number(salaryForm.salary_pending),
        next_payout:    salaryForm.next_payout || null,
      });
      setSalaryModal(false);
    } catch { /* toast */ }
    setSavingS(false);
  }, [salary, monthYear, salaryForm]);

  /* ── memoised totals ────────────────────────────────────── */
  const deptTotals = useMemo(() => {
    const a = depts.rows.reduce((s, r) => s + Number(r.amount_achieved || 0), 0);
    const t = depts.rows.reduce((s, r) => s + Number(r.target_amount || 0), 0);
    return { achieved: a, target: t };
  }, [depts.rows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-gray-600">Month:</label>
        <select
          value={monthIdx}
          onChange={e => setMonthIdx(Number(e.target.value))}
          className="text-xs rounded-lg border border-gray-200 bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
        >
          {MONTHS_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <span className="text-xs text-gray-400">FY {year}–{String(year + 1).slice(-2)}</span>
      </div>

      {/* Dept Performance */}
      <div>
        <TableHeader title={`Department Performance — ${monthLabel}`} onAdd={openAddDept} />
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
              {depts.loading ? <TableSkeleton cols={5} /> :
               depts.rows.length === 0 ? <EmptyRow cols={5} /> :
               depts.rows.map((r, i) => (
                <tr key={r.id} className={trCls(i)}>
                  <td className={tdCls}>{r.department}</td>
                  <td className={tdNum}>{fmt(r.amount_achieved)}</td>
                  <td className={tdNum}>{fmt(r.target_amount)}</td>
                  <td className={tdNum}><PctBar value={r.amount_achieved} denominator={r.target_amount} /></td>
                  <RowActions onEdit={() => openEditDept(r)} onDelete={() => depts.remove(r.id)} />
                </tr>
              ))}
              {depts.rows.length > 1 && (
                <TotalRow>
                  <td className="px-3 py-2 text-xs text-[#2E3093]">Total</td>
                  <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{fmt(deptTotals.achieved)}</td>
                  <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{fmt(deptTotals.target)}</td>
                  <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{pct(deptTotals.achieved, deptTotals.target)}</td>
                  <td />
                </TotalRow>
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
              {loans.loading ? <TableSkeleton cols={5} /> :
               loans.rows.length === 0 ? <EmptyRow cols={5} /> :
               loans.rows.map((r, i) => (
                <tr key={r.id} className={trCls(i)}>
                  <td className={tdCls}>{r.bank_name}</td>
                  <td className={tdNum}>{fmt(r.outstanding)}</td>
                  <td className={tdNum}>{fmt(r.paid)}</td>
                  <td className={tdNum}><PctBar value={r.paid} denominator={r.outstanding} /></td>
                  <RowActions onEdit={() => openEditLoan(r)} onDelete={() => loans.remove(r.id)} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Salary Cashflow */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionTitle>Salary Cashflow — {monthLabel}</SectionTitle>
          <button onClick={openSalary} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#2E3093] text-[#2E3093] hover:bg-[#2E3093]/5 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            Edit
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Salary Payable" value={fmt(salary.row?.total_payable)} />
          <StatCard label="Salary Paid"          value={fmt(salary.row?.salary_paid)} />
          <StatCard label="Salary Pending"       value={fmt(salary.row?.salary_pending)} accent="text-red-600" />
          <StatCard label="Next Payout Date"     value={salary.row?.next_payout || '—'} />
        </div>
      </div>

      <Modal
        open={deptModal.open}
        title={deptModal.editing ? 'Edit Department Record' : 'Add Department Record'}
        saving={savingD}
        onClose={() => setDeptModal({ open: false, editing: null })}
        onSave={saveDept}
      >
        <div><label className={lblCls}>Department Name</label>
          <input className={inpCls} placeholder="e.g. CBD / Inhouse Training" value={deptForm.department} onChange={e => setDeptForm(f => ({ ...f, department: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lblCls}>Amount Achieved (₹)</label><input type="number" min="0" className={inpCls} value={deptForm.amount_achieved} onChange={e => setDeptForm(f => ({ ...f, amount_achieved: e.target.value }))} /></div>
          <div><label className={lblCls}>Target Amount (₹)</label><input type="number" min="0" className={inpCls} value={deptForm.target_amount} onChange={e => setDeptForm(f => ({ ...f, target_amount: e.target.value }))} /></div>
        </div>
      </Modal>

      <Modal
        open={loanModal.open}
        title={loanModal.editing ? 'Edit Loan' : 'Add Loan'}
        saving={savingL}
        onClose={() => setLoanModal({ open: false, editing: null })}
        onSave={saveLoan}
      >
        <div><label className={lblCls}>Bank Name</label><input className={inpCls} value={loanForm.bank_name} onChange={e => setLoanForm(f => ({ ...f, bank_name: e.target.value }))} /></div>
        <div><label className={lblCls}>Outstanding Amount (₹)</label><input type="number" min="0" className={inpCls} value={loanForm.outstanding} onChange={e => setLoanForm(f => ({ ...f, outstanding: e.target.value }))} /></div>
        <div><label className={lblCls}>Paid Amount (₹)</label><input type="number" min="0" className={inpCls} value={loanForm.paid} onChange={e => setLoanForm(f => ({ ...f, paid: e.target.value }))} /></div>
      </Modal>

      <Modal open={salaryModal} title="Edit Salary Cashflow" saving={savingS} onClose={() => setSalaryModal(false)} onSave={saveSalary}>
        <div><label className={lblCls}>Total Salary Payable (₹)</label><input type="number" min="0" className={inpCls} value={salaryForm.total_payable} onChange={e => setSalaryForm(f => ({ ...f, total_payable: e.target.value }))} /></div>
        <div><label className={lblCls}>Salary Paid (₹)</label><input type="number" min="0" className={inpCls} value={salaryForm.salary_paid} onChange={e => setSalaryForm(f => ({ ...f, salary_paid: e.target.value }))} /></div>
        <div><label className={lblCls}>Salary Pending (₹)</label><input type="number" min="0" className={inpCls} value={salaryForm.salary_pending} onChange={e => setSalaryForm(f => ({ ...f, salary_pending: e.target.value }))} /></div>
        <div><label className={lblCls}>Next Payout Date</label><input type="date" className={inpCls} value={salaryForm.next_payout} onChange={e => setSalaryForm(f => ({ ...f, next_payout: e.target.value }))} /></div>
      </Modal>
    </div>
  );
}
