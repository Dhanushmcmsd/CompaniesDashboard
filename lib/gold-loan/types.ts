// ─────────────────────────────────────────────
// Shared TypeScript types for Gold Loan Dashboard
// ─────────────────────────────────────────────

export type Period = "FTD" | "MTD" | "YTD";

// ── Executive Summary KPIs (12 fields) ──────
export interface GoldLoanKPIs {
  /** Total Assets Under Management (₹ Cr) */
  totalAUM: number;
  /** Total loan amount disbursed in period (₹ Cr) */
  totalDisbursement: number;
  /** Total amount collected in period (₹ Cr) */
  totalCollection: number;
  /** Number of active loan accounts */
  activeLoanAccounts: number;
  /** Total overdue outstanding amount (₹ Cr) */
  overdueAmount: number;
  /** Overdue as % of AUM */
  overduePct: number;
  /** NPA outstanding amount (₹ Cr) */
  npaAmount: number;
  /** NPA as % of AUM */
  npaPct: number;
  /** New customers acquired in period */
  newCustomers: number;
  /** Weighted average interest rate (%) */
  avgInterestRate: number;
  /** Total gold weight pledged (grams) */
  goldWeightGrams: number;
  /** Average Loan-to-Value ratio (%) */
  avgLTV: number;
}

// ── Disbursement Record ──────────────────────
export interface DisbursementRecord {
  date: string; // ISO date string
  branch: string;
  amount: number; // ₹ Cr
  target: number; // ₹ Cr
}

// ── Overdue Bucket ───────────────────────────
export interface OverdueBucket {
  bucket: "0-30" | "31-60" | "61-90" | "90+";
  amount: number; // ₹ Cr
  pct: number; // % of total overdue
}

// ── Branch Performance ───────────────────────
export interface BranchPerformance {
  branch: string;
  aum: number; // ₹ Cr
  disbursement: number; // ₹ Cr
  target: number; // ₹ Cr
  collectionEff: number; // % collection efficiency
  npa: number; // ₹ Cr
  avgGoldWeight: number; // grams per loan
}

// ── High Risk Customer ───────────────────────
export interface HighRiskCustomer {
  customerId: string;
  name: string;
  branch: string;
  outstanding: number; // ₹ Cr — current loan outstanding
  goldWeight: number; // grams pledged
  currentGoldValue: number; // ₹ Cr — market value of pledged gold
  excess: number; // outstanding − currentGoldValue (negative = under-collateralised)
}
