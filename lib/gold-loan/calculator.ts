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
 */

import {
  calculateTransactionKPIs,
  type TransactionKPISnapshot,
} from './transaction-calculator';

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
  newDisbursements: number
  mtdDisbursements: number
  ytdDisbursements: number
  gnpaAmount: number
  gnpaPct: number
  nnpaPct: number
  totalOverdue: number
  overdueCollection: number
  collectionEfficiency: number
  overduePercent: number
  bucket0to30: number
  bucket31to60: number
  bucket61to90: number
  bucket90plus: number
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

function safe(n: unknown): number {
  const v = Number(n)
  return Number.isFinite(v) ? v : 0
}

function avg(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function isToday(date: Date | null): boolean {
  if (!date) return false
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth()    === now.getMonth() &&
    date.getDate()     === now.getDate()
  )
}

function isMTD(date: Date | null): boolean {
  if (!date) return false
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth()    === now.getMonth() &&
    date.getDate()     <= now.getDate()
  )
}

function isYTD(date: Date | null): boolean {
  if (!date) return false
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date <= now
  )
}

export function calculateKPIs(
  rows: Record<string, unknown>[],
  txnRows: Record<string, unknown>[] = [],
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

  const presentRates     = rows.map((r) => safe(r.presentRate)).filter((v) => v > 0)
  const avgPresentRate   = avg(presentRates)

  const goldValues = rows
    .filter((r) => safe(r.goldWeight) > 0 && safe(r.presentRate) > 0)
    .map((r) => safe(r.goldWeight) * safe(r.presentRate))
  const avgGoldValuePerLoan = avg(goldValues)

  // ── LTV ──────────────────────────────────────────────────────────────────
  const ltvValues = rows
    .filter((r) => safe(r.goldWeight) > 0 && safe(r.presentRate) > 0)
    .map((r) => {
      const goldValue = safe(r.goldWeight) * safe(r.presentRate)
      return goldValue > 0 ? (safe(r.closingBalance) / goldValue) * 100 : 0
    })
    .filter((v) => v > 0)
  const avgLTV = avg(ltvValues)

  // ── Disbursements (FTD / MTD / YTD) — from balance sheet ─────────────────
  // NOTE: if txnRows are provided, transactionKPIs.ftdDisbursement etc. are
  // more accurate (sourced from TranDate + Tran Mode = 'A').
  let newDisbursements = 0
  let mtdDisbursements = 0
  let ytdDisbursements = 0
  for (const r of rows) {
    const date = r.disbursementDate instanceof Date ? r.disbursementDate : null
    const amt  = safe(r.disbursedAmount)
    if (isToday(date)) newDisbursements += amt
    if (isMTD(date))   mtdDisbursements += amt
    if (isYTD(date))   ytdDisbursements += amt
  }

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

  const collectionEfficiency = totalOverdue > 0
    ? (overdueCollection / totalOverdue) * 100 : 0

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
      ftd: curr.ftd + (isToday(date) ? amt : 0),
      mtd: curr.mtd + (isMTD(date)   ? amt : 0),
      ytd: curr.ytd + (isYTD(date)   ? amt : 0),
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
    newDisbursements, mtdDisbursements, ytdDisbursements,
    gnpaAmount, gnpaPct, nnpaPct,
    totalOverdue, overdueCollection, collectionEfficiency, overduePercent,
    bucket0to30, bucket31to60, bucket61to90, bucket90plus,
    branchAUM, productAUM, branchDisbursement, branchNPA, branchGoldWeight,
    highLTVAccounts, goldValueMismatch, auctionCases,
    transactionKPIs: txnKPIs,
  }
}

function emptySnapshot(): KPISnapshot {
  return {
    totalAUM: 0, totalAccounts: 0, totalCustomers: 0, avgTicketSize: 0, avgYield: 0,
    totalGoldWeight: 0, avgGoldWeightPerLoan: 0, avgLTV: 0, avgPresentRate: 0, avgGoldValuePerLoan: 0,
    newDisbursements: 0, mtdDisbursements: 0, ytdDisbursements: 0,
    gnpaAmount: 0, gnpaPct: 0, nnpaPct: 0,
    totalOverdue: 0, overdueCollection: 0, collectionEfficiency: 0, overduePercent: 0,
    bucket0to30: 0, bucket31to60: 0, bucket61to90: 0, bucket90plus: 0,
    branchAUM: [], productAUM: [], branchDisbursement: [], branchNPA: [], branchGoldWeight: [],
    highLTVAccounts: 0, goldValueMismatch: 0, auctionCases: 0,
  }
}
