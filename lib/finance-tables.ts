/**
 * Centralised table DDL + validation rules for every finance resource.
 *
 * One config per table, both the route.ts (list/create) and [id]/route.ts
 * (update/delete) read from the same object — this guarantees the validation
 * logic and the column list never drift apart.
 */
import { numOrZero, nonNegNum, nullableString, safeString, nullableMonth, nullableDate, oneOf } from './finance-helpers';
import type { ResourceConfig } from './finance-resource';

const STATUS_VALUES    = ['Pending', 'Paid', 'Overdue'] as const;
const CASHFLOW_TYPES   = ['Payment', 'Receipt'] as const;
const CASHFLOW_ENTITIES = ['SIT', 'Accent'] as const;

export const FINANCE_LOANS: ResourceConfig = {
  table: 'finance_loans',
  ddl: `
    CREATE TABLE IF NOT EXISTS finance_loans (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      bank_name    VARCHAR(150) NOT NULL,
      outstanding  DECIMAL(14,2) NOT NULL DEFAULT 0,
      paid         DECIMAL(14,2) NOT NULL DEFAULT 0,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `,
  defaultOrder: 'id DESC',
  validate: (b) => {
    const bank = safeString(b.bank_name, 150);
    if (!bank) throw new Error('bank_name required');
    return [
      { col: 'bank_name',   val: bank },
      { col: 'outstanding', val: nonNegNum(b.outstanding) },
      { col: 'paid',        val: nonNegNum(b.paid) },
    ];
  },
};

export const FINANCE_DEPT_PERFORMANCE: ResourceConfig = {
  table: 'finance_dept_performance',
  ddl: `
    CREATE TABLE IF NOT EXISTS finance_dept_performance (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      month_year      CHAR(7) NOT NULL,
      department      VARCHAR(150) NOT NULL,
      amount_achieved DECIMAL(14,2) NOT NULL DEFAULT 0,
      target_amount   DECIMAL(14,2) NOT NULL DEFAULT 0,
      expense_actual  DECIMAL(14,2) NOT NULL DEFAULT 0,
      expense_target  DECIMAL(14,2) NOT NULL DEFAULT 0,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_month_year (month_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `,
  migrations: `
    ALTER TABLE finance_dept_performance
      ADD COLUMN IF NOT EXISTS expense_actual DECIMAL(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS expense_target DECIMAL(14,2) NOT NULL DEFAULT 0
  `,
  defaultOrder: 'month_year DESC, id ASC',
  filters: [{ param: 'month_year', column: 'month_year' }],
  validate: (b) => {
    const my = nullableMonth(b.month_year);
    if (!my) throw new Error('month_year must be YYYY-MM');
    const dept = safeString(b.department, 150);
    if (!dept) throw new Error('department required');
    return [
      { col: 'month_year',      val: my },
      { col: 'department',      val: dept },
      { col: 'amount_achieved', val: nonNegNum(b.amount_achieved) },
      { col: 'target_amount',   val: nonNegNum(b.target_amount) },
      { col: 'expense_actual',  val: nonNegNum(b.expense_actual) },
      { col: 'expense_target',  val: nonNegNum(b.expense_target) },
    ];
  },
};

export const FINANCE_CBD_PERFORMANCE: ResourceConfig = {
  table: 'finance_cbd_performance',
  ddl: `
    CREATE TABLE IF NOT EXISTS finance_cbd_performance (
      id                INT AUTO_INCREMENT PRIMARY KEY,
      programme         VARCHAR(200) NOT NULL,
      frequency         INT NOT NULL DEFAULT 0,
      target_students   INT NOT NULL DEFAULT 0,
      achieved_students INT NOT NULL DEFAULT 0,
      fees_target       DECIMAL(14,2) NOT NULL DEFAULT 0,
      fees_received     DECIMAL(14,2) NOT NULL DEFAULT 0,
      created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `,
  defaultOrder: 'id DESC',
  validate: (b) => {
    const prog = safeString(b.programme, 200);
    if (!prog) throw new Error('programme required');
    return [
      { col: 'programme',         val: prog },
      { col: 'frequency',         val: Math.trunc(nonNegNum(b.frequency)) },
      { col: 'target_students',   val: Math.trunc(nonNegNum(b.target_students)) },
      { col: 'achieved_students', val: Math.trunc(nonNegNum(b.achieved_students)) },
      { col: 'fees_target',       val: nonNegNum(b.fees_target) },
      { col: 'fees_received',     val: nonNegNum(b.fees_received) },
    ];
  },
};

export const FINANCE_PENDING_FEES: ResourceConfig = {
  table: 'finance_pending_fees',
  ddl: `
    CREATE TABLE IF NOT EXISTS finance_pending_fees (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      student_name VARCHAR(200) NOT NULL,
      batch        VARCHAR(150) NOT NULL DEFAULT '',
      total_fees   DECIMAL(14,2) NOT NULL DEFAULT 0,
      paid         DECIMAL(14,2) NOT NULL DEFAULT 0,
      due_date     DATE NULL,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_due_date (due_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `,
  defaultOrder: 'COALESCE(due_date, "9999-12-31") ASC, id DESC',
  validate: (b) => {
    const name = safeString(b.student_name, 200);
    if (!name) throw new Error('student_name required');
    return [
      { col: 'student_name', val: name },
      { col: 'batch',        val: safeString(b.batch, 150) },
      { col: 'total_fees',   val: nonNegNum(b.total_fees) },
      { col: 'paid',         val: nonNegNum(b.paid) },
      { col: 'due_date',     val: nullableDate(b.due_date) },
    ];
  },
};

export const FINANCE_CT_PERFORMANCE: ResourceConfig = {
  table: 'finance_ct_performance',
  ddl: `
    CREATE TABLE IF NOT EXISTS finance_ct_performance (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      month         CHAR(7) NULL,
      training_name VARCHAR(200) NOT NULL DEFAULT '',
      \`count\`     INT NOT NULL DEFAULT 0,
      cost          DECIMAL(14,2) NOT NULL DEFAULT 0,
      target        DECIMAL(14,2) NOT NULL DEFAULT 0,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `,
  defaultOrder: 'month DESC, id DESC',
  validate: (b) => [
    { col: 'month',         val: nullableMonth(b.month) ?? safeString(b.month, 20) },
    { col: 'training_name', val: safeString(b.training_name, 200) },
    { col: 'count',         val: Math.trunc(nonNegNum(b.count)) },
    { col: 'cost',          val: nonNegNum(b.cost) },
    { col: 'target',        val: nonNegNum(b.target) },
  ],
};

export const FINANCE_DEPUTATION: ResourceConfig = {
  table: 'finance_deputation',
  ddl: `
    CREATE TABLE IF NOT EXISTS finance_deputation (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      month       CHAR(7) NULL,
      actual_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
      target_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `,
  defaultOrder: 'month DESC, id DESC',
  validate: (b) => [
    { col: 'month',       val: nullableMonth(b.month) ?? safeString(b.month, 20) },
    { col: 'actual_cost', val: nonNegNum(b.actual_cost) },
    { col: 'target_cost', val: nonNegNum(b.target_cost) },
  ],
};

export const FINANCE_PROJECTS: ResourceConfig = {
  ...FINANCE_DEPUTATION,
  table: 'finance_projects',
  ddl: FINANCE_DEPUTATION.ddl.replace('finance_deputation', 'finance_projects'),
};

export const FINANCE_DEBT_PLAN: ResourceConfig = {
  table: 'finance_debt_plan',
  ddl: `
    CREATE TABLE IF NOT EXISTS finance_debt_plan (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      bank_name    VARCHAR(150) NOT NULL,
      emi_amount   DECIMAL(14,2) NOT NULL DEFAULT 0,
      planned_date DATE NULL,
      actual_paid  DECIMAL(14,2) NOT NULL DEFAULT 0,
      actual_date  DATE NULL,
      status       ENUM('Pending','Paid','Overdue') NOT NULL DEFAULT 'Pending',
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_planned_date (planned_date),
      KEY idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `,
  defaultOrder: 'COALESCE(planned_date, "9999-12-31") ASC, id ASC',
  validate: (b) => {
    const bank = safeString(b.bank_name, 150);
    if (!bank) throw new Error('bank_name required');
    return [
      { col: 'bank_name',    val: bank },
      { col: 'emi_amount',   val: nonNegNum(b.emi_amount) },
      { col: 'planned_date', val: nullableDate(b.planned_date) },
      { col: 'actual_paid',  val: nonNegNum(b.actual_paid) },
      { col: 'actual_date',  val: nullableDate(b.actual_date) },
      { col: 'status',       val: oneOf(b.status, STATUS_VALUES, 'Pending') },
    ];
  },
};

export const FINANCE_CASHFLOW_PROJECTION: ResourceConfig = {
  table: 'finance_cashflow_projection',
  ddl: `
    CREATE TABLE IF NOT EXISTS finance_cashflow_projection (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      month          CHAR(7) NULL,
      revenue        DECIMAL(14,2) NOT NULL DEFAULT 0,
      expenses       DECIMAL(14,2) NOT NULL DEFAULT 0,
      loan_repayment DECIMAL(14,2) NOT NULL DEFAULT 0,
      created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `,
  defaultOrder: 'month ASC, id ASC',
  validate: (b) => [
    { col: 'month',          val: nullableMonth(b.month) ?? safeString(b.month, 20) },
    { col: 'revenue',        val: nonNegNum(b.revenue) },
    { col: 'expenses',       val: nonNegNum(b.expenses) },
    { col: 'loan_repayment', val: nonNegNum(b.loan_repayment) },
  ],
};

export const FINANCE_CASHFLOW: ResourceConfig = {
  table: 'finance_cashflow',
  ddl: `
    CREATE TABLE IF NOT EXISTS finance_cashflow (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      date        DATE NULL,
      entity      ENUM('SIT','Accent') NOT NULL DEFAULT 'SIT',
      type        ENUM('Payment','Receipt') NOT NULL DEFAULT 'Payment',
      category    VARCHAR(100) NOT NULL DEFAULT 'Miscellaneous',
      description VARCHAR(500) NULL,
      payment     DECIMAL(14,2) NOT NULL DEFAULT 0,
      receipt     DECIMAL(14,2) NOT NULL DEFAULT 0,
      ref_no      VARCHAR(80) NULL,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_date (date),
      KEY idx_entity (entity),
      KEY idx_category (category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `,
  migrations: `
    ALTER TABLE finance_cashflow
      ADD COLUMN IF NOT EXISTS entity ENUM('SIT','Accent') NOT NULL DEFAULT 'SIT'
  `,
  defaultOrder: 'date DESC, id DESC',
  filters: [
    { param: 'entity',   column: 'entity' },
    { param: 'type',     column: 'type' },
    { param: 'category', column: 'category' },
  ],
  validate: (b) => [
    { col: 'date',        val: nullableDate(b.date) },
    { col: 'entity',      val: oneOf(b.entity, CASHFLOW_ENTITIES, 'SIT') },
    { col: 'type',        val: oneOf(b.type, CASHFLOW_TYPES, 'Payment') },
    { col: 'category',    val: safeString(b.category, 100) || 'Miscellaneous' },
    { col: 'description', val: nullableString(b.description, 500) },
    { col: 'payment',     val: nonNegNum(b.payment) },
    { col: 'receipt',     val: nonNegNum(b.receipt) },
    { col: 'ref_no',      val: nullableString(b.ref_no, 80) },
  ],
};

const BATCH_MARKETING_STATUS = ['Pending', 'Done'] as const;

function subtractMonths(dateStr: string | null, months: number): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

export const FINANCE_CBD_BATCH_MARKETING: ResourceConfig = {
  table: 'finance_cbd_batch_marketing',
  ddl: `
    CREATE TABLE IF NOT EXISTS finance_cbd_batch_marketing (
      id                      INT AUTO_INCREMENT PRIMARY KEY,
      batch_name              VARCHAR(200) NOT NULL DEFAULT '',
      training_name           VARCHAR(200) NOT NULL DEFAULT '',
      batch_start_date        DATE NULL,
      batch_announcement_date DATE NULL,
      meta_ads_date           DATE NULL,
      flyer_status            ENUM('Pending','Done') NOT NULL DEFAULT 'Pending',
      announcement_status     ENUM('Pending','Done') NOT NULL DEFAULT 'Pending',
      meta_ads_status         ENUM('Pending','Done') NOT NULL DEFAULT 'Pending',
      created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_batch_start (batch_start_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `,
  migrations: `
    ALTER TABLE finance_cbd_batch_marketing
      ADD COLUMN IF NOT EXISTS training_name VARCHAR(200) NOT NULL DEFAULT ''
  `,
  defaultOrder: 'COALESCE(batch_start_date, "9999-12-31") ASC, id ASC',
  validate: (b) => {
    const startDate = nullableDate(b.batch_start_date);
    return [
      { col: 'batch_name',              val: safeString(b.batch_name, 200) },
      { col: 'training_name',           val: safeString(b.training_name, 200) },
      { col: 'batch_start_date',        val: startDate },
      { col: 'batch_announcement_date', val: subtractMonths(startDate, 3) },
      { col: 'meta_ads_date',           val: subtractMonths(startDate, 1) },
      { col: 'flyer_status',            val: oneOf(b.flyer_status, BATCH_MARKETING_STATUS, 'Pending') },
      { col: 'announcement_status',     val: oneOf(b.announcement_status, BATCH_MARKETING_STATUS, 'Pending') },
      { col: 'meta_ads_status',         val: oneOf(b.meta_ads_status, BATCH_MARKETING_STATUS, 'Pending') },
    ];
  },
};

/* Utility wrappers used directly by salary-cashflow's bespoke route. */
export { numOrZero, nonNegNum, nullableString, safeString, nullableMonth, nullableDate, oneOf };
