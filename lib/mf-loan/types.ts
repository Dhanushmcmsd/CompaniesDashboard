/**
 * MF Loan (Micro Finance) — TypeScript types
 * Column mappings follow the workflow spec exactly.
 */

export type Period = 'FTD' | 'MTD' | 'YTD';

// ── KPI shape returned by the API to the dashboard ───────────────────────────
export interface MfLoanKPIs {
  // From Balance Statement
  totalAUM: number;           // ₹ Crore — SUM(Principal Closing Balance)
  totalCustomers: number;     // COUNT DISTINCT(Customer Number)
  avgYield: number;           // % — AVG(Rate of Interest)

  mtdDisbursement: number;    // ₹ Crore — SUM(Disbursed Amount) Apr 1 to today
  ftdDisbursement: number;    // ₹ Crore — SUM(Disbursed Amount) today only

  overdueAccounts: number;    // COUNT WHERE DPD > 0
  overdueAmount: number;      // ₹ Crore — SUM(Principal Closing Balance) WHERE DPD > 0

  gnpaAmount: number;         // ₹ Crore — SUM(Principal Closing Balance) WHERE DPD > 90
  gnpaPct: number;            // % — gnpaAmount / totalAUM * 100

  loanClosureAmount: number;  // ₹ Crore — SUM(Closing Principal Received) WHERE Closed On = today

  // From Transaction Statement
  ftdCollection: number;      // ₹ Crore — SUM(Total Received) WHERE Txn Date = today
  mtdCollection: number;      // ₹ Crore — SUM(Total Received) WHERE Txn Date in current month
  ftdDisburseFromTxn: number; // ₹ Crore — SUM(Principal Dr) WHERE Txn Date = today
}

// ── Raw row parsed from the Balance Statement Excel ──────────────────────────
export interface MfLoanBalanceRow {
  customerNumber: string;
  loanAccountNumber: string;
  principalClosingBalance: number;
  rateOfInterest: number;
  disbursedAmount: number;
  issueDate: Date | null;
  dpd: number;
  closingPrincipalReceived: number;
  closedOnDate: Date | null;
  branch: string;
}

// ── Raw row parsed from the Transaction Statement Excel ──────────────────────
export interface MfLoanTransactionRow {
  loanAccountNumber: string;
  transactionDate: Date | null;
  principalDr: number;
  principalCr: number;
  totalReceived: number; // maps to production column "Total Rcvd"
  interestRcvd: number;
  tranMode: string;
  branch: string;
}

// ── Per-branch summary stored in branchAUM JSON column ───────────────────────
export interface BranchMfSummary {
  branch: string;
  aum: number;           // ₹ Crore
  customers: number;
  overdueAmount: number; // ₹ Crore
  gnpaAmount: number;    // ₹ Crore
}
