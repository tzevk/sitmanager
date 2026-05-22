export interface Loan {
  id: number;
  bank_name: string;
  outstanding: number;
  paid: number;
}

export interface DeptPerf {
  id: number;
  month_year: string;
  department: string;
  amount_achieved: number;
  target_amount: number;
  expense_actual: number;
  expense_target: number;
}

export interface SalaryCashflow {
  id?: number;
  month_year: string;
  total_payable: number | null;
  salary_paid: number | null;
  salary_pending: number | null;
  next_payout: string | null;
}

export interface CbdRow {
  id: number;
  programme: string;
  frequency: number;
  target_students: number;
  achieved_students: number;
  fees_target: number;
  fees_received: number;
}

export interface PendingFee {
  id: number;
  student_name: string;
  batch: string;
  total_fees: number;
  paid: number;
  due_date: string | null;
}

export interface CtRow {
  id: number;
  month_year: string;
  training_name: string;
  company: string;
  cost_from_company: number;
  trainer_cost: number;
  travelling_expenses: number;
}

export interface MonthlyRow {
  id: number;
  month: string;
  actual_cost: number;
  target_cost: number;
}

export type DebtPlanStatus = 'Pending' | 'Paid' | 'Overdue';

export interface DebtPlan {
  id: number;
  bank_name: string;
  emi_amount: number;
  planned_date: string | null;
  actual_paid: number;
  actual_date: string | null;
  status: DebtPlanStatus;
}

export interface CashflowProjection {
  id: number;
  month: string;
  revenue: number;
  expenses: number;
  loan_repayment: number;
}

export type InvoiceStatus = 'Pending' | 'Paid' | 'Overdue';

export interface PendingInvoice {
  id: number;
  client_name: string;
  invoice_no: string | null;
  amount: number;
  invoice_date: string | null;
  due_date: string | null;
  status: InvoiceStatus;
  description: string | null;
  department: string;
}

export type CashflowType   = 'Payment' | 'Receipt';

export interface CashflowTxn {
  id: number;
  date: string | null;
  type: CashflowType;
  category: string;
  description: string | null;
  payment: number;
  receipt: number;
  ref_no: string | null;
  company: string | null;
  department: string | null;
}
