/**
 * Single source of truth for hardcoded department turnover targets.
 * Shared by the Overview tab's Department-wise Breakdown table and the
 * Revenue by Department chart so both views always agree.
 */
export const DEPT_TURNOVER_TARGETS = {
  cbd:            { monthly: 5_621_667,  yearly: 67_460_000  }, // ₹56,21,667 / ₹6,74,60,000
  corporate:      { monthly: 2_500_000,  yearly: 30_000_000  }, // ₹25,00,000 / ₹3,00,00,000
  deputation:     { monthly: 2_083_333,  yearly: 25_000_000  }, // ₹20,83,333 / ₹2,50,00,000
  accentProjects: { monthly: 8_333_333,  yearly: 100_000_000 }, // ₹83,33,333 / ₹10,00,00,000
} as const;

/** Target Expense = Actual Turnover × this %, per department. */
export const TARGET_EXPENSE_PCT: Record<string, number> = {
  cbd: 0.70,
  deputation: 0.80,
  corporate: 0.50,
  accentProjects: 0.80,
};

/** Target Profit = Target Turnover × this %, per department. */
export const TARGET_PROFIT_PCT: Record<string, number> = {
  cbd: 0.30,
  deputation: 0.15,
  corporate: 0.40,
  accentProjects: 0.20,
};
