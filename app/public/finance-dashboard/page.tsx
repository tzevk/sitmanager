'use client';

import { useEffect, useRef, useState } from 'react';
import FinanceFullDashboard from '../../dashboard/components/FinanceFullDashboard';

type AnyRow = Record<string, unknown> & { id: number };

function createMockDb() {
  return {
    loans: [
      { id: 1, bank_name: 'HDFC OD', outstanding: 1200000, paid: 420000 },
      { id: 2, bank_name: 'ICICI Term Loan', outstanding: 850000, paid: 310000 },
      { id: 3, bank_name: 'NBFC Bridge', outstanding: 460000, paid: 120000 },
    ],
    deptPerformance: [
      { id: 1, month_year: '2026-01', department: 'CBD / Inhouse', amount_achieved: 642000, target_amount: 700000, expense_actual: 310000, expense_target: 350000 },
      { id: 2, month_year: '2026-01', department: 'Corporate Training', amount_achieved: 395000, target_amount: 420000, expense_actual: 210000, expense_target: 220000 },
      { id: 3, month_year: '2026-01', department: 'Accent Deputation', amount_achieved: 210000, target_amount: 240000, expense_actual: 139000, expense_target: 160000 },
      { id: 4, month_year: '2026-01', department: 'Accent Projects', amount_achieved: 320000, target_amount: 360000, expense_actual: 190000, expense_target: 220000 },
      { id: 5, month_year: '2026-02', department: 'CBD / Inhouse', amount_achieved: 618500, target_amount: 700000, expense_actual: 304000, expense_target: 350000 },
      { id: 6, month_year: '2026-02', department: 'Corporate Training', amount_achieved: 286000, target_amount: 420000, expense_actual: 170000, expense_target: 220000 },
      { id: 7, month_year: '2026-02', department: 'Accent Deputation', amount_achieved: 196000, target_amount: 240000, expense_actual: 132000, expense_target: 160000 },
      { id: 8, month_year: '2026-02', department: 'Accent Projects', amount_achieved: 245000, target_amount: 360000, expense_actual: 156000, expense_target: 220000 },
      { id: 9, month_year: '2026-03', department: 'CBD / Inhouse', amount_achieved: 701000, target_amount: 700000, expense_actual: 328000, expense_target: 350000 },
      { id: 10, month_year: '2026-03', department: 'Corporate Training', amount_achieved: 231000, target_amount: 420000, expense_actual: 144000, expense_target: 220000 },
      { id: 11, month_year: '2026-03', department: 'Accent Deputation', amount_achieved: 222000, target_amount: 240000, expense_actual: 146000, expense_target: 160000 },
      { id: 12, month_year: '2026-03', department: 'Accent Projects', amount_achieved: 188000, target_amount: 360000, expense_actual: 136000, expense_target: 220000 },
      { id: 13, month_year: '2026-04', department: 'CBD / Inhouse', amount_achieved: 655000, target_amount: 700000, expense_actual: 315000, expense_target: 350000 },
      { id: 14, month_year: '2026-04', department: 'Corporate Training', amount_achieved: 178000, target_amount: 420000, expense_actual: 118000, expense_target: 220000 },
      { id: 15, month_year: '2026-04', department: 'Accent Deputation', amount_achieved: 208000, target_amount: 240000, expense_actual: 140000, expense_target: 160000 },
      { id: 16, month_year: '2026-04', department: 'Accent Projects', amount_achieved: 270000, target_amount: 360000, expense_actual: 165000, expense_target: 220000 },
      { id: 17, month_year: '2026-05', department: 'CBD / Inhouse', amount_achieved: 672000, target_amount: 700000, expense_actual: 320000, expense_target: 350000 },
      { id: 18, month_year: '2026-05', department: 'Corporate Training', amount_achieved: 258000, target_amount: 420000, expense_actual: 156000, expense_target: 220000 },
      { id: 19, month_year: '2026-05', department: 'Accent Deputation', amount_achieved: 214000, target_amount: 240000, expense_actual: 143000, expense_target: 160000 },
      { id: 20, month_year: '2026-05', department: 'Accent Projects', amount_achieved: 284000, target_amount: 360000, expense_actual: 172000, expense_target: 220000 },
      { id: 21, month_year: '2026-06', department: 'CBD / Inhouse', amount_achieved: 688000, target_amount: 700000, expense_actual: 326000, expense_target: 350000 },
      { id: 22, month_year: '2026-06', department: 'Corporate Training', amount_achieved: 302000, target_amount: 420000, expense_actual: 182000, expense_target: 220000 },
      { id: 23, month_year: '2026-06', department: 'Accent Deputation', amount_achieved: 219000, target_amount: 240000, expense_actual: 145000, expense_target: 160000 },
      { id: 24, month_year: '2026-06', department: 'Accent Projects', amount_achieved: 298000, target_amount: 360000, expense_actual: 178000, expense_target: 220000 },
    ],
    ctPerformance: [
      { id: 1, month_year: '2026-01', training_name: 'Piping Orientation', company: 'L&T Process', cost_from_company: 395000, trainer_cost: 210000, travelling_expenses: 38000 },
      { id: 2, month_year: '2026-02', training_name: 'BIM Fundamentals', company: 'Atlas Copco', cost_from_company: 286000, trainer_cost: 162000, travelling_expenses: 26000 },
      { id: 3, month_year: '2026-03', training_name: 'P&ID Discipline', company: 'Thermax', cost_from_company: 231000, trainer_cost: 136000, travelling_expenses: 22000 },
      { id: 4, month_year: '2026-04', training_name: 'Drafting Refresh', company: 'Cummins', cost_from_company: 178000, trainer_cost: 103000, travelling_expenses: 18000 },
      { id: 5, month_year: '2026-05', training_name: 'Process Safety Advanced', company: 'Laurus', cost_from_company: 258000, trainer_cost: 148000, travelling_expenses: 19000 },
      { id: 6, month_year: '2026-06', training_name: 'Piping Bootcamp', company: 'Worley', cost_from_company: 302000, trainer_cost: 171000, travelling_expenses: 21000 },
    ],
    deputation: [
      { id: 1, month: '2026-01', actual_cost: 210000, target_cost: 240000 },
      { id: 2, month: '2026-02', actual_cost: 196000, target_cost: 240000 },
      { id: 3, month: '2026-03', actual_cost: 222000, target_cost: 240000 },
      { id: 4, month: '2026-04', actual_cost: 208000, target_cost: 240000 },
      { id: 5, month: '2026-05', actual_cost: 214000, target_cost: 240000 },
      { id: 6, month: '2026-06', actual_cost: 219000, target_cost: 240000 },
    ],
    projects: [
      { id: 1, month: '2026-01', actual_cost: 320000, target_cost: 360000 },
      { id: 2, month: '2026-02', actual_cost: 245000, target_cost: 360000 },
      { id: 3, month: '2026-03', actual_cost: 188000, target_cost: 360000 },
      { id: 4, month: '2026-04', actual_cost: 270000, target_cost: 360000 },
      { id: 5, month: '2026-05', actual_cost: 284000, target_cost: 360000 },
      { id: 6, month: '2026-06', actual_cost: 298000, target_cost: 360000 },
    ],
    cbdMonthly: [
      { id: 1, month: '2026-01', actual_cost: 642000, target_cost: 700000 },
      { id: 2, month: '2026-02', actual_cost: 618500, target_cost: 700000 },
      { id: 3, month: '2026-03', actual_cost: 701000, target_cost: 700000 },
      { id: 4, month: '2026-04', actual_cost: 655000, target_cost: 700000 },
      { id: 5, month: '2026-05', actual_cost: 672000, target_cost: 700000 },
      { id: 6, month: '2026-06', actual_cost: 688000, target_cost: 700000 },
    ],
    ctMonthly: [
      { id: 1, month: '2026-01', actual_cost: 395000, target_cost: 420000 },
      { id: 2, month: '2026-02', actual_cost: 286000, target_cost: 420000 },
      { id: 3, month: '2026-03', actual_cost: 231000, target_cost: 420000 },
      { id: 4, month: '2026-04', actual_cost: 178000, target_cost: 420000 },
      { id: 5, month: '2026-05', actual_cost: 258000, target_cost: 420000 },
      { id: 6, month: '2026-06', actual_cost: 302000, target_cost: 420000 },
    ],
    debtPlan: [
      { id: 1, bank_name: 'HDFC OD', emi_amount: 118000, planned_date: '2026-06-15', actual_paid: 118000, actual_date: '2026-06-15', status: 'Paid' },
      { id: 2, bank_name: 'ICICI Term Loan', emi_amount: 76000, planned_date: '2026-06-21', actual_paid: 0, actual_date: null, status: 'Pending' },
      { id: 3, bank_name: 'NBFC Bridge', emi_amount: 58000, planned_date: '2026-06-10', actual_paid: 0, actual_date: null, status: 'Overdue' },
      { id: 4, bank_name: 'HDFC OD', emi_amount: 118000, planned_date: '2026-07-15', actual_paid: 0, actual_date: null, status: 'Pending' },
      { id: 5, bank_name: 'ICICI Term Loan', emi_amount: 76000, planned_date: '2026-07-21', actual_paid: 0, actual_date: null, status: 'Pending' },
      { id: 6, bank_name: 'NBFC Bridge', emi_amount: 58000, planned_date: '2026-07-10', actual_paid: 0, actual_date: null, status: 'Pending' },
    ],
    cashflowProjection: [
      { id: 1, month: '2026-01', revenue: 1540000, expenses: 980000, loan_repayment: 176000 },
      { id: 2, month: '2026-02', revenue: 1480000, expenses: 955000, loan_repayment: 176000 },
      { id: 3, month: '2026-03', revenue: 1620000, expenses: 1010000, loan_repayment: 176000 },
      { id: 4, month: '2026-04', revenue: 1510000, expenses: 992000, loan_repayment: 176000 },
      { id: 5, month: '2026-05', revenue: 1580000, expenses: 998000, loan_repayment: 176000 },
      { id: 6, month: '2026-06', revenue: 1640000, expenses: 1035000, loan_repayment: 176000 },
    ],
    pendingInvoices: [
      { id: 1, client_name: 'L&T Process', invoice_no: 'INV-CT-1001', amount: 75000, invoice_date: '2026-04-10', due_date: '2026-05-10', status: 'Overdue', description: 'Balance after phase-1', department: 'Corporate Training' },
      { id: 2, client_name: 'Atlas Copco', invoice_no: 'INV-CT-1002', amount: 42000, invoice_date: '2026-04-15', due_date: '2026-05-20', status: 'Pending', description: 'Pending clearance', department: 'Corporate Training' },
      { id: 3, client_name: 'Accent Client A', invoice_no: 'INV-DEP-201', amount: 38000, invoice_date: '2026-04-20', due_date: '2026-05-25', status: 'Pending', description: 'Staff deputation cycle', department: 'Deputation' },
      { id: 4, client_name: 'Accent Client B', invoice_no: 'INV-PROJ-301', amount: 95000, invoice_date: '2026-04-12', due_date: '2026-05-12', status: 'Overdue', description: 'Milestone 2', department: 'Projects' },
      { id: 5, client_name: 'Thermax', invoice_no: 'INV-CT-1003', amount: 41000, invoice_date: '2026-04-26', due_date: '2026-05-30', status: 'Paid', description: 'Final settlement', department: 'Corporate Training' },
      { id: 6, client_name: 'Worley', invoice_no: 'INV-CT-1004', amount: 53000, invoice_date: '2026-05-14', due_date: '2026-06-14', status: 'Pending', description: 'Batch-2 balance amount', department: 'Corporate Training' },
      { id: 7, client_name: 'Accent Client C', invoice_no: 'INV-DEP-202', amount: 46000, invoice_date: '2026-05-16', due_date: '2026-06-16', status: 'Pending', description: 'Extended deputation effort', department: 'Deputation' },
      { id: 8, client_name: 'Accent Client D', invoice_no: 'INV-PROJ-302', amount: 67000, invoice_date: '2026-05-18', due_date: '2026-06-18', status: 'Pending', description: 'Milestone 3 invoicing', department: 'Projects' },
    ],
    cashflow: [
      { id: 1, date: '2026-01-03', type: 'Receipt', category: 'Tution Fees', description: 'Admissions receipts', payment: 0, receipt: 186000, ref_no: 'RCPT-1', company: 'Suvidya', department: 'CBD' },
      { id: 2, date: '2026-01-05', type: 'Payment', category: 'Employee Salary', description: 'Monthly salaries', payment: 126000, receipt: 0, ref_no: 'PAY-1', company: 'Suvidya', department: 'ADMIN ACCOUNTS' },
      { id: 3, date: '2026-01-12', type: 'Payment', category: 'CBD', description: 'CBD operating cost', payment: 310000, receipt: 0, ref_no: 'PAY-CBD-1', company: 'Suvidya', department: 'CBD' },
      { id: 4, date: '2026-01-15', type: 'Payment', category: 'Corporate Training', description: 'CT execution costs', payment: 210000, receipt: 0, ref_no: 'PAY-CT-1', company: 'Accent', department: 'CORPORATE TRAINING' },
      { id: 5, date: '2026-01-19', type: 'Payment', category: 'Deputation', description: 'Deputation cycle cost', payment: 139000, receipt: 0, ref_no: 'PAY-DEP-1', company: 'Accent', department: 'DEPUTATION ACCENT' },
      { id: 6, date: '2026-01-22', type: 'Payment', category: 'Projects', description: 'Projects cycle cost', payment: 190000, receipt: 0, ref_no: 'PAY-PROJ-1', company: 'Accent', department: 'PROJECT ACCENT' },
      { id: 34, date: '2026-02-07', type: 'Receipt', category: 'Corporate Training', description: 'Invoice receipt', payment: 0, receipt: 92000, ref_no: 'RCPT-2', company: 'Accent', department: 'CORPORATE TRAINING' },
      { id: 35, date: '2026-02-09', type: 'Payment', category: 'Marketing - Accent', description: 'Ads spend', payment: 98000, receipt: 0, ref_no: 'PAY-2', company: 'Accent', department: 'MARKETING - ACCENT' },
      { id: 7, date: '2026-02-12', type: 'Payment', category: 'CBD', description: 'CBD operating cost', payment: 304000, receipt: 0, ref_no: 'PAY-CBD-2', company: 'Suvidya', department: 'CBD' },
      { id: 8, date: '2026-02-16', type: 'Payment', category: 'Corporate Training', description: 'CT execution costs', payment: 170000, receipt: 0, ref_no: 'PAY-CT-2', company: 'Accent', department: 'CORPORATE TRAINING' },
      { id: 9, date: '2026-02-20', type: 'Payment', category: 'Deputation', description: 'Deputation cycle cost', payment: 132000, receipt: 0, ref_no: 'PAY-DEP-2', company: 'Accent', department: 'DEPUTATION ACCENT' },
      { id: 10, date: '2026-02-24', type: 'Payment', category: 'Projects', description: 'Projects cycle cost', payment: 156000, receipt: 0, ref_no: 'PAY-PROJ-2', company: 'Accent', department: 'PROJECT ACCENT' },
      { id: 11, date: '2026-03-04', type: 'Payment', category: 'Trainers Payment', description: 'Trainer payout', payment: 83000, receipt: 0, ref_no: 'PAY-3', company: 'Suvidya', department: 'TRAINERS' },
      { id: 12, date: '2026-03-10', type: 'Payment', category: 'CBD', description: 'CBD operating cost', payment: 328000, receipt: 0, ref_no: 'PAY-CBD-3', company: 'Suvidya', department: 'CBD' },
      { id: 13, date: '2026-03-13', type: 'Payment', category: 'Corporate Training', description: 'CT execution costs', payment: 144000, receipt: 0, ref_no: 'PAY-CT-3', company: 'Accent', department: 'CORPORATE TRAINING' },
      { id: 14, date: '2026-03-17', type: 'Payment', category: 'Deputation', description: 'Deputation cycle cost', payment: 146000, receipt: 0, ref_no: 'PAY-DEP-3', company: 'Accent', department: 'DEPUTATION ACCENT' },
      { id: 15, date: '2026-03-22', type: 'Payment', category: 'Projects', description: 'Projects cycle cost', payment: 136000, receipt: 0, ref_no: 'PAY-PROJ-3', company: 'Accent', department: 'PROJECT ACCENT' },
      { id: 16, date: '2026-04-12', type: 'Payment', category: 'Projects', description: 'Projects cycle cost', payment: 165000, receipt: 0, ref_no: 'PAY-5', company: 'Accent', department: 'PROJECT ACCENT' },
      { id: 17, date: '2026-04-15', type: 'Payment', category: 'OD Interest / Loan EMI', description: 'Loan servicing', payment: 176000, receipt: 0, ref_no: 'PAY-6', company: 'Suvidya', department: 'LOAN REPAYMENT' },
      { id: 18, date: '2026-04-18', type: 'Receipt', category: 'Deputation', description: 'Client release', payment: 0, receipt: 110000, ref_no: 'RCPT-3', company: 'Accent', department: 'DEPUTATION ACCENT' },
      { id: 19, date: '2026-04-20', type: 'Receipt', category: 'Projects', description: 'Milestone receipt', payment: 0, receipt: 140000, ref_no: 'RCPT-4', company: 'Accent', department: 'PROJECT ACCENT' },
      { id: 20, date: '2026-04-23', type: 'Payment', category: 'Corporate Training', description: 'CT execution costs', payment: 118000, receipt: 0, ref_no: 'PAY-7', company: 'Accent', department: 'CORPORATE TRAINING' },
      { id: 21, date: '2026-04-28', type: 'Payment', category: 'CBD', description: 'CBD operating cost', payment: 315000, receipt: 0, ref_no: 'PAY-8', company: 'Suvidya', department: 'CBD' },
      { id: 22, date: '2026-05-04', type: 'Receipt', category: 'Tution Fees', description: 'Admissions receipts', payment: 0, receipt: 205000, ref_no: 'RCPT-5', company: 'Suvidya', department: 'CBD' },
      { id: 23, date: '2026-05-10', type: 'Payment', category: 'CBD', description: 'CBD operating cost', payment: 320000, receipt: 0, ref_no: 'PAY-CBD-5', company: 'Suvidya', department: 'CBD' },
      { id: 24, date: '2026-05-13', type: 'Payment', category: 'Corporate Training', description: 'CT execution costs', payment: 156000, receipt: 0, ref_no: 'PAY-CT-5', company: 'Accent', department: 'CORPORATE TRAINING' },
      { id: 25, date: '2026-05-17', type: 'Payment', category: 'Deputation', description: 'Deputation cycle cost', payment: 143000, receipt: 0, ref_no: 'PAY-DEP-5', company: 'Accent', department: 'DEPUTATION ACCENT' },
      { id: 26, date: '2026-05-22', type: 'Payment', category: 'Projects', description: 'Projects cycle cost', payment: 172000, receipt: 0, ref_no: 'PAY-PROJ-5', company: 'Accent', department: 'PROJECT ACCENT' },
      { id: 27, date: '2026-06-03', type: 'Receipt', category: 'Corporate Training', description: 'Batch completion receipt', payment: 0, receipt: 168000, ref_no: 'RCPT-6', company: 'Accent', department: 'CORPORATE TRAINING' },
      { id: 28, date: '2026-06-08', type: 'Payment', category: 'CBD', description: 'CBD operating cost', payment: 326000, receipt: 0, ref_no: 'PAY-CBD-6', company: 'Suvidya', department: 'CBD' },
      { id: 29, date: '2026-06-12', type: 'Payment', category: 'Corporate Training', description: 'CT execution costs', payment: 182000, receipt: 0, ref_no: 'PAY-CT-6', company: 'Accent', department: 'CORPORATE TRAINING' },
      { id: 30, date: '2026-06-16', type: 'Payment', category: 'Deputation', description: 'Deputation cycle cost', payment: 145000, receipt: 0, ref_no: 'PAY-DEP-6', company: 'Accent', department: 'DEPUTATION ACCENT' },
      { id: 31, date: '2026-06-20', type: 'Payment', category: 'Projects', description: 'Projects cycle cost', payment: 178000, receipt: 0, ref_no: 'PAY-PROJ-6', company: 'Accent', department: 'PROJECT ACCENT' },
      { id: 32, date: '2026-06-24', type: 'Payment', category: 'OD Interest / Loan EMI', description: 'Loan servicing', payment: 176000, receipt: 0, ref_no: 'PAY-EMI-6', company: 'Suvidya', department: 'LOAN REPAYMENT' },
      { id: 33, date: '2026-06-26', type: 'Receipt', category: 'Projects', description: 'Milestone receipt', payment: 0, receipt: 154000, ref_no: 'RCPT-7', company: 'Accent', department: 'PROJECT ACCENT' },
    ],
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getCollection(db: ReturnType<typeof createMockDb>, resource: string): AnyRow[] | null {
  if (resource === 'loans') return db.loans as AnyRow[];
  if (resource === 'dept-performance') return db.deptPerformance as AnyRow[];
  if (resource === 'ct-performance') return db.ctPerformance as AnyRow[];
  if (resource === 'deputation') return db.deputation as AnyRow[];
  if (resource === 'projects') return db.projects as AnyRow[];
  if (resource === 'cbd-monthly') return db.cbdMonthly as AnyRow[];
  if (resource === 'ct-monthly') return db.ctMonthly as AnyRow[];
  if (resource === 'debt-plan') return db.debtPlan as AnyRow[];
  if (resource === 'cashflow-projection') return db.cashflowProjection as AnyRow[];
  if (resource === 'pending-invoices') return db.pendingInvoices as AnyRow[];
  if (resource === 'cashflow') return db.cashflow as AnyRow[];
  return null;
}

export default function PublicFinanceDashboardPage() {
  const [ready, setReady] = useState(false);
  const originalFetchRef = useRef<typeof fetch | null>(null);
  const dbRef = useRef(createMockDb());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!originalFetchRef.current) originalFetchRef.current = window.fetch.bind(window);
    const realFetch = originalFetchRef.current;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const urlString = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method || 'GET').toUpperCase();

      const normalized = (() => {
        try {
          return new URL(urlString, window.location.origin);
        } catch {
          return null;
        }
      })();

      if (!normalized) return realFetch(input, init);
      const { pathname, searchParams } = normalized;
      const db = dbRef.current;

      if (pathname === '/api/masters/annual-batch/plan') {
        return jsonResponse({
          rows: [
            { Plan_Id: 1, Training_Program_Name: 'Piping Design and Drafting', Target_Frequency: 4, Min_Students_Per_Batch: 25, Students_Admitted: 88, Yearly_Students_Target: 100, Frequency_Conducted: 4, Percentage: 88, Fees: 75000 },
            { Plan_Id: 2, Training_Program_Name: 'Engineering Design and Drafting', Target_Frequency: 4, Min_Students_Per_Batch: 20, Students_Admitted: 72, Yearly_Students_Target: 80, Frequency_Conducted: 4, Percentage: 90, Fees: 75000 },
            { Plan_Id: 3, Training_Program_Name: 'Process Engineering Weekend', Target_Frequency: 6, Min_Students_Per_Batch: 18, Students_Admitted: 95, Yearly_Students_Target: 108, Frequency_Conducted: 6, Percentage: 88, Fees: 50000 },
          ],
        });
      }

      if (pathname === '/api/finance/pending-fees-live') {
        const q = (searchParams.get('q') || '').toLowerCase().trim();
        const rows = [
          { id: 1, student_name: 'Aarav Patil', batch: 'PDD-2026-WE-04', total_fees: 75000, paid: 62500, due_date: '2026-06-20' },
          { id: 2, student_name: 'Neha Ghadge', batch: 'EDD-2026-FT-07', total_fees: 75000, paid: 57000, due_date: '2026-06-28' },
          { id: 3, student_name: 'Pranav Kulkarni', batch: 'PE-2026-WE-02', total_fees: 50000, paid: 40500, due_date: '2026-06-18' },
          { id: 4, student_name: 'Sakshi Jadhav', batch: 'PDD-2026-FT-06', total_fees: 75000, paid: 54000, due_date: '2026-07-02' },
        ].filter((r) => !q || `${r.student_name} ${r.batch}`.toLowerCase().includes(q));
        return jsonResponse({ rows });
      }

      if (pathname === '/api/finance/salary-cashflow') {
        const monthYear = searchParams.get('month_year') || '2026-06';
        return jsonResponse({
          row: {
            id: 1,
            month_year: monthYear,
            total_payable: 482000,
            salary_paid: 426000,
            salary_pending: 56000,
            next_payout: '2026-06-30',
          },
        });
      }

      if (pathname.startsWith('/api/finance/')) {
        const afterBase = pathname.replace('/api/finance/', '');
        const [resource, idPart] = afterBase.split('/');
        const collection = getCollection(db, resource);

        if (!collection) {
          return jsonResponse({ error: `Unknown mock resource: ${resource}` }, 404);
        }

        if (method === 'GET') {
          let rows = [...collection];
          if (resource === 'dept-performance') {
            const monthYear = searchParams.get('month_year');
            const year = searchParams.get('year');
            if (monthYear) rows = rows.filter((r) => String(r.month_year || '').startsWith(monthYear));
            if (year) rows = rows.filter((r) => String(r.month_year || '').startsWith(`${year}-`));
          }
          if (resource === 'pending-invoices') {
            const dept = searchParams.get('department');
            if (dept) rows = rows.filter((r) => String(r.department || '') === dept);
          }
          if (resource === 'cashflow') {
            const type = searchParams.get('type');
            const category = searchParams.get('category');
            const department = searchParams.get('department');
            const company = searchParams.get('company');
            const dateFrom = searchParams.get('dateFrom');
            const dateTo = searchParams.get('dateTo');
            rows = rows.filter((r) => {
              if (type && String(r.type || '') !== type) return false;
              if (category && String(r.category || '') !== category) return false;
              if (department && String(r.department || '') !== department) return false;
              if (company && String(r.company || '') !== company) return false;
              if (dateFrom && String(r.date || '') < dateFrom) return false;
              if (dateTo && String(r.date || '') > dateTo) return false;
              return true;
            });
          }
          if (idPart) {
            const id = Number(idPart);
            const row = rows.find((r) => Number(r.id) === id) || null;
            return jsonResponse({ row });
          }
          return jsonResponse({ rows });
        }

        if (method === 'POST') {
          const payload = init?.body ? JSON.parse(String(init.body)) : {};
          const nextId = collection.length ? Math.max(...collection.map((r) => Number(r.id))) + 1 : 1;
          const row = { id: nextId, ...payload } as AnyRow;
          collection.push(row);
          return jsonResponse({ row }, 201);
        }

        if (method === 'PUT') {
          const payload = init?.body ? JSON.parse(String(init.body)) : {};
          if (idPart) {
            const id = Number(idPart);
            const idx = collection.findIndex((r) => Number(r.id) === id);
            if (idx < 0) return jsonResponse({ error: 'Not found' }, 404);
            collection[idx] = { ...collection[idx], ...payload, id };
            return jsonResponse({ row: collection[idx] });
          }
          // Singleton update path (salary-cashflow style fallback)
          const row = { id: 1, ...payload } as AnyRow;
          return jsonResponse({ row });
        }

        if (method === 'DELETE' && idPart) {
          const id = Number(idPart);
          const idx = collection.findIndex((r) => Number(r.id) === id);
          if (idx < 0) return jsonResponse({ error: 'Not found' }, 404);
          collection.splice(idx, 1);
          return jsonResponse({ success: true });
        }
      }

      return realFetch(input, init);
    };

    setReady(true);

    return () => {
      if (originalFetchRef.current) {
        window.fetch = originalFetchRef.current;
      }
    };
  }, []);

  if (!ready) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="h-5 w-56 bg-slate-200 rounded animate-pulse" />
            <div className="mt-3 h-4 w-80 bg-slate-100 rounded animate-pulse" />
          </div>
        </div>
      </main>
    );
  }

  return <FinanceFullDashboard />;
}
