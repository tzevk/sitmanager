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

// How many installments to generate by default for each plan. An explicit lookup
// rather than parsing the leading number out of the label — "50% Installment" is a
// percentage (it's actually a 2-part plan, per the "Pay in 2 Installments" label
// used elsewhere for the same value), not a count, so naively regex-matching the
// first digit sequence in the string previously misread it as 50 installments.
const INSTALLMENT_COUNTS: Record<string, number> = {
  '50% Installment': 2,
  '2-Payment Plan': 2,
  '3-Installment Plan': 3,
  '6-Installment Plan': 6,
  'Loan (0% Interest)': 2,
};

export function defaultInstallmentCount(paymentType: string | null | undefined): number {
  return INSTALLMENT_COUNTS[String(paymentType ?? '').trim()] ?? 2;
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
