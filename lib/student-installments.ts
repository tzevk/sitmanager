import type { Pool } from 'mysql2/promise';

// admission_master.Payment_Type values that represent an installment/loan plan —
// these are the only modes that get the Installments tab on the student edit page.
export const INSTALLMENT_PAYMENT_TYPES = [
  '50% Installment',
  '2-Payment Plan',
  '3-Installment Plan',
  '6-Installment Plan',
  'Loan (0% Interest)',
] as const;

// How many installments to generate by default for each plan. "Loan (0% Interest)"
// has no count in its name, so it defaults to 2 (same as the other 2-part plans) —
// staff can add/remove rows after generating.
export function defaultInstallmentCount(paymentType: string | null | undefined): number {
  const m = String(paymentType ?? '').match(/(\d+)/);
  if (m) return Math.max(2, Math.min(12, Number(m[1])));
  return 2;
}

let tableReady = false;

export async function ensureInstallmentPlanTable(pool: Pool): Promise<void> {
  if (tableReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_installment_plan (
      Installment_Id INT NOT NULL AUTO_INCREMENT,
      Student_Id INT NOT NULL,
      Admission_Id INT NULL,
      Installment_No INT NOT NULL,
      Due_Date DATE NULL,
      Amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      Status VARCHAR(20) NOT NULL DEFAULT 'Pending',
      Paid_Date DATE NULL,
      Paid_Fees_Id INT NULL,
      Notes VARCHAR(255) NULL,
      IsDelete TINYINT NOT NULL DEFAULT 0,
      Created_Date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      Updated_Date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (Installment_Id),
      INDEX idx_installment_student (Student_Id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  tableReady = true;
}
