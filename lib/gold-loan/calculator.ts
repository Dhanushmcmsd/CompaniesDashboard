/**
 * Gold Loan KPI Calculator
 * ─────────────────────────────────────────────────────────────────────────────
 * Takes parsed Excel rows (in memory only — never stored)
 * and returns a fully calculated KPI snapshot ready for DB insert.
 *
 * ALL formulas are based on the exact spec provided:
 *   Total AUM          = SUM(closingBalance)
 *   Total Customers    = COUNT DISTINCT customerId
 *   Yield              = AVG(interestRate)
 *   GNPA               = SUM(closingBalance WHERE dpd > 90)
 *   GNPA%              = GNPA / AUM * 100
 *   Avg ticket size    = AUM / totalAccounts
 *   DPD buckets        = closingBalance filtered by dpd range
 *   Collection eff.    = overdueCollection / totalOverdue * 100
 *   Avg LTV            = AVG(closingBalance / (goldWeight * presentRate) * 100)
 *
 * v2 — accepts optional txnRows for cross-referenced collection efficiency
 * v3 — adds calculateKPIsFromTransaction() for transaction-statement-first workflows
 */

import {
  calculateTransactionKPIs,
  type TransactionKPISnapshot,
} from './transaction-calculator';

// ─── TransactionKPIs ─────────────────────────────────────────────────────────
// Lightweight output type for calculateKPIsFromTransaction().
// Mirrors the fields your API/dashboard consumers expect directly,
// without exposing the full TransactionKPISnapshot internals.

export type TransactionKPIs = {
  /** SUM of principalDebit (disbursement rows: principalDebit > 0) */
  totalDisbursed: number;
  /** SUM of principalCr on collection rows */
  totalPrincipalCollected: number;
  /** SUM of interestRcvd on collection rows */
  totalInterestCollected: number;
  /** SUM of totalAmountReceived on collection rows */
  totalCollected: number;
  /** SUM of totalAmountReceived on collection rows for DPD>0 accounts only */
  overdueCollectionFromTxn: number;
  /** Distinct new customers from disbursement rows in the current day */
  newCustomerFromTxn: number;
  /** Per-branch disbursement totals derived purely from the transaction file */
  branchDisbursementFromTxn: BranchDisbFromTxn[];
};

export type BranchDisbFromTxn = {
  branch: string;
  totalDisbursed: number;
  disbursementCount: number;
};

// ─── KPISnapshot ─────────────────────────────────────────────────────────────

export type KPISnapshot = {
  totalAUM: number
  totalAccounts: number
  totalCustomers: number
  avgTicketSize: number
  avgYield: number
  totalGoldWeight: number
  avgGoldWeightPerLoan: number
  avgLTV: number
  avgPresentRate: number
  avgGoldValuePerLoan: number
  avgRatePerGram: number
  newCustomerFromLoanBalance: number
  newDisbursements: number
  mtdDisbursements: number
  ytdDisbursements: number
  gnpaAmount: number
  gnpaPct: number
  nnpaPct: number
  totalOverdue: number
  overdueCollection: number
  collectionEfficiency: number | null
  overduePercent: number
  bucket0to30: number
  bucket31to60: number
  bucket61to90: number
  bucket90plus: number
  sma0Amount: number
  sma1Amount: number
  sma2Amount: number
  sma0Count: number
  sma1Count: number
  sma2Count: number
  highRiskAmount: number
  highRiskCount: number
  branchAUM: BranchAUM[]
  productAUM: ProductAUM[]
  branchDisbursement: BranchDisb[]
  branchNPA: BranchNPA[]
  branchGoldWeight: BranchGold[]
  highLTVAccounts: number
  goldValueMismatch: number
  auctionCases: number
  /** Present only when a transaction statement is also uploaded */
  transactionKPIs?: TransactionKPISnapshot
}

export type BranchAUM   = { branch: string; aum: number; accounts: number }
export type ProductAUM  = { scheme: string; aum: number; accounts: number }
export type BranchDisb  = { branch: string; ftd: number; mtd: number; ytd: number }
export type BranchNPA   = { branch: string; gnpaAmount: number; gnpaPct: number }
export type BranchGold  = { branch: string; totalGoldWeight: number; avgPerLoan: number }

// ─── Shared helpers ───────────────────────────────────────────────────────────

function safe(n: unknown): number {
  const v = Number(n)
  return Number.isFinite(v) ? v : 0
}

function avg(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** SUM a numeric field across an array of rows */
function sum(rows: Record<string, unknown>[], field: string): number {
  return rows.reduce((s, r) => s + safe(r[field]), 0);
}

/** Group disbursement rows by branch and sum totalDisbursed */
function groupByBranch(rows: Record<string, unknown>[]): BranchDisbFromTxn[] {
  const map = new Map<string, { totalDisbursed: number; disbursementCount: number }>();
  for (const r of rows) {
    const branch = String(r.branchName ?? 'Unknown');
    const existing = map.get(branch) ?? { totalDisbursed: 0, disbursementCount: 0 };
    map.set(branch, {
      totalDisbursed:    existing.totalDisbursed    + safe(r.disbursedAmount),
      disbursementCount: existing.disbursementCount + 1,
    });
  }
  return Array.from(map.entries())
    .map(([branch, v]) => ({ branch, ...v }))
    .sort((a, b) => b.totalDisbursed - a.totalDisbursed);
}

function isSameDay(date: Date | null, other: Date): boolean {
  if (!date) return false
  return (
    date.getFullYear() === other.getFullYear() &&
    date.getMonth()    === other.getMonth() &&
    date.getDate()     === other.getDate()
  )
}

function isToday(date: Date | null): boolean {
  return isSameDay(date, new Date())
}

function isMTD(date: Date | null, asOnDate: Date): boolean {
  if (!date) return false
  return (
    date.getFullYear() === asOnDate.getFullYear() &&
    date.getMonth()    === asOnDate.getMonth() &&
    date.getDate()     <= asOnDate.getDate()
  )
}

function getYtdStart(asOnDate: Date): Date {
  const month = asOnDate.getMonth()
  const year = asOnDate.getFullYear()
  const fyStartYear = month < 3 ? year - 1 : year
  return new Date(fyStartYear, 3, 1)
}

function isYTD(date: Date | null, asOnDate: Date): boolean {
  if (!date) return false
  const start = getYtdStart(asOnDate)
  return date >= start && date <= asOnDate
}

// ─── calculateKPIsFromTransaction ────────────────────────────────────────────
/**
 * Transaction-statement-first KPI extraction.
 *
 * Call this when you have the transaction file but may not have the balance
 * sheet (or want the transaction file's numbers independently).
 *
 * Disbursement rows  = principalDebit > 0  (covers Tran Mode A and any row
 *                      where the bank debited principal, regardless of mode)
 * Collection rows    = principalCr > 0 OR interestRcvd > 0
 *
 * @param txnRows               Parsed rows from the transaction statement Excel
 * @param overdueAccountNumbers Set of account numbers with DPD > 0 from the
 *                              balance sheet. Pass an empty Set when running
 *                              without a balance sheet — overdueCollectionFromTxn
 *                              will be 0 in that case.
 */
export function calculateKPIsFromTransaction(
  txnRows: Record<string, unknown>[],
  overdueAccountNumbers: Set<string>,
  asOnDate: Date = new Date(),
): TransactionKPIs {
  if (!txnRows.length) {
    return {
      totalDisbursed: 0,
      totalPrincipalCollected: 0,
      totalInterestCollected: 0,
      totalCollected: 0,
      overdueCollectionFromTxn: 0,
      newCustomerFromTxn: 0,
      branchDisbursementFromTxn: [],
    };
  }

  // Split disbursements vs collections using Tran Mode (per spec):
  //   Tran Mode A = Disbursement
  //   Tran Mode C or B = Collection (Cash or Bank)
  // Fallback: if tranMode is absent, use principal debit/credit signals.
  const disbRows = txnRows.filter((r) => {
    const mode = String(r.tranMode ?? '').trim().toUpperCase();
    if (mode === 'A') return true;
    if (mode === 'C' || mode === 'B') return false;
    return safe(r.disbursedAmount) > 0 || safe(r.principalDr) > 0;
  });

  const collRows = txnRows.filter((r) => {
    const mode = String(r.tranMode ?? '').trim().toUpperCase();
    if (mode === 'C' || mode === 'B') return true;
    if (mode === 'A') return false;
    return safe(r.principalCr) > 0 || safe(r.interestRcvd) > 0;
  });

  // Overdue collection: filter collection rows to DPD>0 accounts only
  const overdueCollRows = collRows.filter((r) =>
    overdueAccountNumbers.has(String(r.loanAccountNumber ?? '').trim()),
  );

  const disbursementAccounts = new Set<string>();
  for (const r of disbRows) {
    const txnDate = r.transactionDate instanceof Date ? r.transactionDate : null;
    if (txnDate && isSameDay(txnDate, asOnDate)) {
      const account = String(r.loanAccountNumber ?? '').trim();
      if (account) disbursementAccounts.add(account);
    }
  }

  return {
    totalDisbursed:           disbRows.reduce((s, r) => s + (safe(r.disbursedAmount) || safe(r.principalDr)), 0),
    totalPrincipalCollected:  sum(collRows,        'principalCr'),
    totalInterestCollected:   sum(collRows,        'interestRcvd'),
    totalCollected:           sum(collRows,        'totalAmountReceived'),
    overdueCollectionFromTxn: sum(overdueCollRows, 'totalAmountReceived'),
    newCustomerFromTxn:       disbursementAccounts.size,
    branchDisbursementFromTxn: groupByBranch(disbRows),
  };
}

// ─── calculateKPIs ───────────────────────────────────────────────────────────

export function calculateKPIs(
  rows: Record<string, unknown>[],
  txnRows: Record<string, unknown>[] = [],
  asOnDate: Date = new Date(),
): KPISnapshot {
  const n = rows.length
  if (!n) {
    return emptySnapshot()
  }

  // ── Core aggregates ──────────────────────────────────────────────────────
  const totalAUM        = rows.reduce((s, r) => s + safe(r.closingBalance), 0)
  const totalAccounts   = n
  const uniqueCustomers = new Set(rows.map((r) => String(r.customerId ?? "")).filter(Boolean))
  const totalCustomers  = uniqueCustomers.size
  const avgTicketSize   = totalAccounts ? totalAUM / totalAccounts : 0

  // ── Yield ────────────────────────────────────────────────────────────────
  const yieldRates = rows.map((r) => safe(r.interestRate)).filter((v) => v > 0)
  const avgYield   = avg(yieldRates)

  // ── Gold ─────────────────────────────────────────────────────────────────
  const totalGoldWeight    = rows.reduce((s, r) => s + safe(r.goldWeight), 0)
  const avgGoldWeightPerLoan = totalAccounts ? totalGoldWeight / totalAccounts : 0

  const avgRatePerGram = totalGoldWeight > 0 ? totalAUM / totalGoldWeight : 0

  const presentRates     = rows.map((r) => safe(r.presentRate)).filter((v) => v > 0)
  const avgPresentRate   = avg(presentRates)

  const totalGoldCollateralValue = rows.reduce(
    (s, r) => s + safe(r.goldWeight) * safe(r.presentRate),
    0,
  )
  const avgGoldValuePerLoan = totalAccounts ? totalGoldCollateralValue / totalAccounts : 0

  const HIGH_RISK_LTV_THRESHOLD = 75

  // ── LTV ──────────────────────────────────────────────────────────────────
  const ltvRows = rows.filter((r) => safe(r.goldWeight) > 0 && safe(r.presentRate) > 0)
  const ltvValues = ltvRows
    .map((r) => {
      const goldValue = safe(r.goldWeight) * safe(r.presentRate)
      return goldValue > 0 ? (safe(r.closingBalance) / goldValue) * 100 : 0
    })
    .filter((v) => v > 0)
  const avgLTV = avg(ltvValues)

  const highRiskRows = ltvRows.filter((r) => {
    const goldValue = safe(r.goldWeight) * safe(r.presentRate)
    const ltv = goldValue > 0 ? (safe(r.closingBalance) / goldValue) * 100 : 0
    return ltv > HIGH_RISK_LTV_THRESHOLD
  })
  const highRiskAmount = highRiskRows.reduce((s, r) => s + safe(r.closingBalance), 0)
  const highRiskCount = highRiskRows.length

  // ── Disbursements (FTD / MTD / YTD) — from balance sheet ─────────────────
  // NOTE: if txnRows are provided, transactionKPIs.ftdDisbursement etc. are
  // more accurate (sourced from TranDate + Tran Mode = 'A').
  // Balance-sheet fallback: uses Issue Date / Disbursement Date column.
  // MTD = current calendar month (same month as today).
  // YTD = Indian financial year starting April 1.
  const periodStart = new Date(asOnDate.getFullYear(), asOnDate.getMonth(), 1)
  const ytdStart = getYtdStart(asOnDate)

  let newDisbursements = 0
  let mtdDisbursements = 0
  let ytdDisbursements = 0
  const newCustomerAccounts = new Set<string>()
  for (const r of rows) {
    const date = r.disbursementDate instanceof Date ? r.disbursementDate : null
    const amt  = safe(r.disbursedAmount)
    if (isSameDay(date, asOnDate)) {
      newDisbursements += amt
      const account = String(r.loanAccountNumber ?? '').trim()
      if (account) newCustomerAccounts.add(account)
    }
    if (isMTD(date, asOnDate))   mtdDisbursements += amt
    if (isYTD(date, asOnDate))   ytdDisbursements += amt
  }
  const newCustomerFromLoanBalance = newCustomerAccounts.size

  // ── GNPA (DPD > 90) ───────────────────────────────────────────────────────
  const gnpaRows    = rows.filter((r) => safe(r.dpd) > 90)
  const gnpaAmount  = gnpaRows.reduce((s, r) => s + safe(r.closingBalance), 0)
  const gnpaPct     = totalAUM > 0 ? (gnpaAmount / totalAUM) * 100 : 0
  const nnpaPct     = gnpaPct * 0.65 // approximation until NNPA source available

  // ── Overdue (DPD > 0) ────────────────────────────────────────────────────
  const overdueRows   = rows.filter((r) => safe(r.dpd) > 0)
  const totalOverdue  = overdueRows.reduce((s, r) => s + safe(r.closingBalance), 0)
  const overduePercent = totalAUM > 0 ? (totalOverdue / totalAUM) * 100 : 0

  // Overdue collection: prefer transaction-file cross-reference when available,
  // fall back to balance-sheet principalCr + interestRcvd columns.
  const txnKPIs = txnRows.length
    ? calculateTransactionKPIs(txnRows, rows, totalOverdue)
    : undefined;

  const overdueCollection = txnKPIs
    ? txnKPIs.overdueCollection
    : overdueRows.reduce((s, r) => s + safe(r.principalCr) + safe(r.interestRcvd), 0);

  const openingOverdueBalance = rows
    .filter((r) => {
      const disbDate = r.disbursementDate instanceof Date ? r.disbursementDate : null
      return safe(r.dpd) > 0 && disbDate != null && disbDate < periodStart
    })
    .reduce((s, r) => s + safe(r.closingBalance), 0)

  const freshOverdueInPeriod = rows
    .filter((r) => {
      const disbDate = r.disbursementDate instanceof Date ? r.disbursementDate : null
      return (
        safe(r.dpd) > 0 &&
        disbDate != null &&
        disbDate >= periodStart &&
        disbDate <= asOnDate
      )
    })
    .reduce((s, r) => s + safe(r.closingBalance), 0)

  const overdueDenominator = openingOverdueBalance + freshOverdueInPeriod
  const collectionEfficiency = overdueDenominator > 0
    ? (overdueCollection / overdueDenominator) * 100
    : null

  // ── DPD Buckets ──────────────────────────────────────────────────────────
  const bucket0to30  = rows
    .filter((r) => { const d = safe(r.dpd); return d >= 1  && d <= 30 })
    .reduce((s, r) => s + safe(r.closingBalance), 0)
  const bucket31to60 = rows
    .filter((r) => { const d = safe(r.dpd); return d >= 31 && d <= 60 })
    .reduce((s, r) => s + safe(r.closingBalance), 0)
  const bucket61to90 = rows
    .filter((r) => { const d = safe(r.dpd); return d >= 61 && d <= 90 })
    .reduce((s, r) => s + safe(r.closingBalance), 0)
  const bucket90plus = gnpaAmount

  const sma0Count = rows.filter((r) => { const d = safe(r.dpd); return d >= 1 && d <= 30 }).length
  const sma1Count = rows.filter((r) => { const d = safe(r.dpd); return d >= 31 && d <= 60 }).length
  const sma2Count = rows.filter((r) => { const d = safe(r.dpd); return d >= 61 && d <= 90 }).length
  const sma0Amount = bucket0to30
  const sma1Amount = bucket31to60
  const sma2Amount = bucket61to90

  // ── Branch AUM ───────────────────────────────────────────────────────────
  const branchMap = new Map<string, { aum: number; accounts: number }>()
  for (const r of rows) {
    const b = String(r.branchName ?? "Unknown")
    const existing = branchMap.get(b) ?? { aum: 0, accounts: 0 }
    branchMap.set(b, { aum: existing.aum + safe(r.closingBalance), accounts: existing.accounts + 1 })
  }
  const branchAUM: BranchAUM[] = Array.from(branchMap.entries())
    .map(([branch, v]) => ({ branch, ...v }))
    .sort((a, b) => b.aum - a.aum)

  // ── Product AUM ──────────────────────────────────────────────────────────
  const productMap = new Map<string, { aum: number; accounts: number }>()
  for (const r of rows) {
    const s = String(r.schemeName ?? "Unknown")
    const existing = productMap.get(s) ?? { aum: 0, accounts: 0 }
    productMap.set(s, { aum: existing.aum + safe(r.closingBalance), accounts: existing.accounts + 1 })
  }
  const productAUM: ProductAUM[] = Array.from(productMap.entries())
    .map(([scheme, v]) => ({ scheme, ...v }))
    .sort((a, b) => b.aum - a.aum)

  // ── Branch Disbursement ───────────────────────────────────────────────────
  const disbMap = new Map<string, { ftd: number; mtd: number; ytd: number }>()
  for (const r of rows) {
    const b    = String(r.branchName ?? "Unknown")
    const date = r.disbursementDate instanceof Date ? r.disbursementDate : null
    const amt  = safe(r.disbursedAmount)
    const curr = disbMap.get(b) ?? { ftd: 0, mtd: 0, ytd: 0 }
    disbMap.set(b, {
      ftd: curr.ftd + (isSameDay(date, asOnDate) ? amt : 0),
      mtd: curr.mtd + (isMTD(date, asOnDate)   ? amt : 0),
      ytd: curr.ytd + (isYTD(date, asOnDate)   ? amt : 0),
    })
  }
  const branchDisbursement: BranchDisb[] = Array.from(disbMap.entries())
    .map(([branch, v]) => ({ branch, ...v }))

  // ── Branch NPA ────────────────────────────────────────────────────────────
  const bnpaMap = new Map<string, { gnpaAmount: number; totalAUM: number }>()
  for (const r of rows) {
    const b    = String(r.branchName ?? "Unknown")
    const curr = bnpaMap.get(b) ?? { gnpaAmount: 0, totalAUM: 0 }
    bnpaMap.set(b, {
      gnpaAmount: curr.gnpaAmount + (safe(r.dpd) > 90 ? safe(r.closingBalance) : 0),
      totalAUM:   curr.totalAUM   + safe(r.closingBalance),
    })
  }
  const branchNPA: BranchNPA[] = Array.from(bnpaMap.entries()).map(([branch, v]) => ({
    branch,
    gnpaAmount: v.gnpaAmount,
    gnpaPct:    v.totalAUM > 0 ? (v.gnpaAmount / v.totalAUM) * 100 : 0,
  }))

  // ── Branch Gold Weight ────────────────────────────────────────────────────
  const bgMap = new Map<string, { totalGoldWeight: number; accounts: number }>()
  for (const r of rows) {
    const b    = String(r.branchName ?? "Unknown")
    const curr = bgMap.get(b) ?? { totalGoldWeight: 0, accounts: 0 }
    bgMap.set(b, {
      totalGoldWeight: curr.totalGoldWeight + safe(r.goldWeight),
      accounts:        curr.accounts + 1,
    })
  }
  const branchGoldWeight: BranchGold[] = Array.from(bgMap.entries()).map(([branch, v]) => ({
    branch,
    totalGoldWeight: v.totalGoldWeight,
    avgPerLoan:      v.accounts ? v.totalGoldWeight / v.accounts : 0,
  }))

  // ── Alerts ────────────────────────────────────────────────────────────────
  const highLTVAccounts = rows.filter((r) => {
    const gv = safe(r.goldWeight) * safe(r.presentRate)
    return gv > 0 && (safe(r.closingBalance) / gv) > 0.85
  }).length

  const goldValueMismatch = rows.filter((r) => {
    const gv = safe(r.goldWeight) * safe(r.presentRate)
    return gv > 0 && safe(r.closingBalance) > gv
  }).length

  const auctionCases = gnpaRows.length

  return {
    totalAUM, totalAccounts, totalCustomers, avgTicketSize, avgYield,
    totalGoldWeight, avgGoldWeightPerLoan, avgLTV, avgPresentRate, avgGoldValuePerLoan,
    avgRatePerGram, newCustomerFromLoanBalance, newDisbursements, mtdDisbursements, ytdDisbursements,
    gnpaAmount, gnpaPct, nnpaPct,
    totalOverdue, overdueCollection, collectionEfficiency, overduePercent,
    bucket0to30, bucket31to60, bucket61to90, bucket90plus,
    sma0Amount, sma1Amount, sma2Amount, sma0Count, sma1Count, sma2Count,
    highRiskAmount, highRiskCount,
    branchAUM, productAUM, branchDisbursement, branchNPA, branchGoldWeight,
    highLTVAccounts, goldValueMismatch, auctionCases,
    transactionKPIs: txnKPIs,
  }
}

function emptySnapshot(): KPISnapshot {
  return {
    totalAUM: 0, totalAccounts: 0, totalCustomers: 0, avgTicketSize: 0, avgYield: 0,
    totalGoldWeight: 0, avgGoldWeightPerLoan: 0, avgLTV: 0, avgPresentRate: 0, avgGoldValuePerLoan: 0,
    avgRatePerGram: 0, newCustomerFromLoanBalance: 0, newDisbursements: 0, mtdDisbursements: 0, ytdDisbursements: 0,
    gnpaAmount: 0, gnpaPct: 0, nnpaPct: 0,
    totalOverdue: 0, overdueCollection: 0, collectionEfficiency: null, overduePercent: 0,
    bucket0to30: 0, bucket31to60: 0, bucket61to90: 0, bucket90plus: 0,
    sma0Amount: 0, sma1Amount: 0, sma2Amount: 0, sma0Count: 0, sma1Count: 0, sma2Count: 0,
    highRiskAmount: 0, highRiskCount: 0,
    branchAUM: [], productAUM: [], branchDisbursement: [], branchNPA: [], branchGoldWeight: [],
    highLTVAccounts: 0, goldValueMismatch: 0, auctionCases: 0,
  }
}
