/**
 * MF Loan KPI Calculator
 * ─────────────────────────────────────────────────────────────────────────────
 * All formulas follow the workflow spec exactly:
 *
 *   totalAUM          = SUM(principalClosingBalance)
 *   totalCustomers    = COUNT DISTINCT(customerNumber)
 *   avgYield          = AVG(rateOfInterest)
 *
 *   mtdDisbursement   = SUM(disbursedAmount) WHERE issueDate >= Apr 1 AND <= snapshotDate
 *   ftdDisbursement   = SUM(disbursedAmount) WHERE issueDate = snapshotDate
 *
 *   overdueAccounts   = COUNT WHERE dpd > 0
 *   overdueAmount     = SUM(principalClosingBalance) WHERE dpd > 0
 *
 *   gnpaAmount        = SUM(principalClosingBalance) WHERE dpd > 90
 *   gnpaPct           = gnpaAmount / totalAUM * 100
 *
 *   loanClosureAmount = SUM(closingPrincipalReceived) WHERE closedOnDate = snapshotDate
 *
 *   ftdCollection     = SUM(totalReceived) WHERE transactionDate = snapshotDate  [Txn Stmt]
 *   mtdCollection     = SUM(totalReceived) WHERE transactionDate in same month   [Txn Stmt]
 *   ftdDisburseFromTxn= SUM(principalDr)  WHERE transactionDate = snapshotDate  [Txn Stmt]
 */

import type { MfLoanBalanceRow, MfLoanTransactionRow, MfLoanKPIs, BranchMfSummary } from './types';

// ── Date helpers ─────────────────────────────────────────────────────────────

function isSameDay(a: Date | null, b: Date): boolean {
  if (!a) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

function isSameMonth(a: Date | null, b: Date): boolean {
  if (!a) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** Financial Year start = 1 April of current or previous calendar year */
function fyStart(ref: Date): Date {
  const m = ref.getMonth(); // 0-indexed, April = 3
  const y = m >= 3 ? ref.getFullYear() : ref.getFullYear() - 1;
  return new Date(y, 3, 1, 0, 0, 0, 0); // April 1
}

// ── Main KPI calculator ───────────────────────────────────────────────────────

export function calculateMfLoanKPIs(
  balanceRows: MfLoanBalanceRow[],
  txnRows: MfLoanTransactionRow[],
  snapshotDate: Date,
): MfLoanKPIs {
  const fyStartDate = fyStart(snapshotDate);
  const CRORE = 1e7; // 1 Crore = 10,000,000

  // ── From Balance Statement ──────────────────────────────────────────────────
  const totalAUM_raw = balanceRows.reduce((s, r) => s + r.principalClosingBalance, 0);

  const uniqueCustomers = new Set(
    balanceRows.map((r) => r.customerNumber).filter(Boolean),
  );
  const totalCustomers = uniqueCustomers.size;

  const yieldRates = balanceRows
    .map((r) => r.rateOfInterest)
    .filter((v) => v > 0);
  const avgYield = yieldRates.length
    ? yieldRates.reduce((s, v) => s + v, 0) / yieldRates.length
    : 0;

  // MTD disbursement: Issue Date from FY start (Apr 1) to snapshotDate
  const mtdDisbursement_raw = balanceRows
    .filter(
      (r) =>
        r.issueDate &&
        r.issueDate >= fyStartDate &&
        r.issueDate <= snapshotDate,
    )
    .reduce((s, r) => s + r.disbursedAmount, 0);

  // FTD disbursement: Issue Date = snapshotDate
  const ftdDisbursement_raw = balanceRows
    .filter((r) => isSameDay(r.issueDate, snapshotDate))
    .reduce((s, r) => s + r.disbursedAmount, 0);

  // Overdue: DPD > 0
  const overdueRows  = balanceRows.filter((r) => r.dpd > 0);
  const overdueAccounts = overdueRows.length;
  const overdueAmount_raw = overdueRows.reduce(
    (s, r) => s + r.principalClosingBalance,
    0,
  );

  // GNPA: DPD > 90
  const gnpaRows   = balanceRows.filter((r) => r.dpd > 90);
  const gnpaAmount_raw = gnpaRows.reduce(
    (s, r) => s + r.principalClosingBalance,
    0,
  );
  const gnpaPct = totalAUM_raw > 0 ? (gnpaAmount_raw / totalAUM_raw) * 100 : 0;

  // Loan Closures: Closed On = snapshotDate
  const loanClosureAmount_raw = balanceRows
    .filter((r) => isSameDay(r.closedOnDate, snapshotDate))
    .reduce((s, r) => s + r.closingPrincipalReceived, 0);

  // ── From Transaction Statement ──────────────────────────────────────────────
  const ftdCollection_raw = txnRows
    .filter((r) => isSameDay(r.transactionDate, snapshotDate))
    .reduce((s, r) => s + r.totalReceived, 0);

  const mtdCollection_raw = txnRows
    .filter((r) => isSameMonth(r.transactionDate, snapshotDate))
    .reduce((s, r) => s + r.totalReceived, 0);

  const ftdDisburseFromTxn_raw = txnRows
    .filter((r) => isSameDay(r.transactionDate, snapshotDate))
    .reduce((s, r) => s + r.principalDr, 0);

  return {
    totalAUM:           totalAUM_raw          / CRORE,
    totalCustomers,
    avgYield,
    mtdDisbursement:    mtdDisbursement_raw   / CRORE,
    ftdDisbursement:    ftdDisbursement_raw   / CRORE,
    overdueAccounts,
    overdueAmount:      overdueAmount_raw     / CRORE,
    gnpaAmount:         gnpaAmount_raw        / CRORE,
    gnpaPct,
    loanClosureAmount:  loanClosureAmount_raw / CRORE,
    ftdCollection:      ftdCollection_raw     / CRORE,
    mtdCollection:      mtdCollection_raw     / CRORE,
    ftdDisburseFromTxn: ftdDisburseFromTxn_raw / CRORE,
  };
}

// ── Branch breakdown ─────────────────────────────────────────────────────────

export function calculateMfBranchBreakdown(
  balanceRows: MfLoanBalanceRow[],
): BranchMfSummary[] {
  const CRORE = 1e7;
  const map = new Map<string, BranchMfSummary>();

  for (const r of balanceRows) {
    const b    = r.branch || 'Unknown';
    const prev = map.get(b) ?? {
      branch: b,
      aum: 0,
      customers: 0,
      overdueAmount: 0,
      gnpaAmount: 0,
    };
    prev.aum           += r.principalClosingBalance / CRORE;
    if (r.customerNumber) prev.customers += 1;
    if (r.dpd > 0)  prev.overdueAmount += r.principalClosingBalance / CRORE;
    if (r.dpd > 90) prev.gnpaAmount    += r.principalClosingBalance / CRORE;
    map.set(b, prev);
  }

  return Array.from(map.values()).sort((a, b) => b.aum - a.aum);
}
