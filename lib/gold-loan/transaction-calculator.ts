/**
 * Transaction Statement KPI Calculator
 * ─────────────────────────────────────────────────────────────────────────────
 * Processes rows from the "Transactions During Period" Excel file.
 *
 * Tran Mode codes:
 *   'A' = Disbursement (outflow)  — Principal Debit > 0
 *   'C' = Cash collection         — Amount Received, Principal Credit, Interest
 *   'B' = Bank collection          — same columns as C
 *
 * Usage:
 *   const txnKPIs = calculateTransactionKPIs(txnRows, balanceRows);
 *
 * Cross-reference (requires balanceRows):
 *   overdueAccountNumbers = set of account numbers where DPD > 0 in balance sheet
 *   overdueCollection     = totalCollected filtered to those accounts only
 */

export type TranMode = 'A' | 'C' | 'B' | string | null;

/** Per-day disbursement rolled up for trend charts */
export type DailyDisbursement = {
  date: string;         // 'YYYY-MM-DD'
  totalDisbursed: number;
  accountCount: number;
};

/** Per-branch disbursement */
export type BranchDisbursementTxn = {
  branch: string;
  ftd: number;
  mtd: number;
  ytd: number;
  totalDisbursed: number;
  disbursementCount: number;
};

/** Segregated collection — split from Amount Received */
export type CollectionBreakdown = {
  principalReceived: number;
  interestReceived: number;
  otherCharges: number;          // Amount Received − Principal − Interest
  totalCollected: number;
};

/** Per-branch collection */
export type BranchCollection = {
  branch: string;
  principalReceived: number;
  interestReceived: number;
  otherCharges: number;
  totalCollected: number;
  accountCount: number;
};

/** Full output of calculateTransactionKPIs */
export type TransactionKPISnapshot = {
  // ── Collection efficiency ──────────────────────────────────────────────
  principalCollected: number;    // SUM principal credit (C + B rows)
  interestCollected: number;     // SUM tot. intr. amount (C + B rows)
  totalCollected: number;        // SUM amount received (C + B rows)
  overdueCollection: number;     // totalCollected filtered to DPD>0 accounts
  collectionEfficiencyTxn: number; // overdueCollection / totalOverdue * 100
                                   // (totalOverdue injected from balance sheet)

  // ── Segregated collection breakdown ───────────────────────────────────
  collection: CollectionBreakdown;

  // ── Disbursements ──────────────────────────────────────────────────────
  ftdDisbursement: number;       // today
  mtdDisbursement: number;       // month-to-date
  ytdDisbursement: number;       // year-to-date
  disbursementCount: number;     // number of disbursement transactions

  // ── Breakdowns ────────────────────────────────────────────────────────
  dailyDisbursements: DailyDisbursement[];
  branchDisbursements: BranchDisbursementTxn[];
  branchCollections: BranchCollection[];

  // ── Convenience flags ──────────────────────────────────────────────────
  totalTransactions: number;
  collectionTransactions: number;
  disbursementTransactions: number;
  newCustomerFromTxn: number;
};

// ─── helpers ────────────────────────────────────────────────────────────────

function safe(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function toDateKey(date: Date | null): string | null {
  if (!date) return null;
  const y  = date.getFullYear();
  const m  = String(date.getMonth() + 1).padStart(2, '0');
  const d  = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isToday(date: Date | null, asOnDate: Date): boolean {
  if (!date) return false;
  return (
    date.getFullYear() === asOnDate.getFullYear() &&
    date.getMonth()    === asOnDate.getMonth()    &&
    date.getDate()     === asOnDate.getDate()
  );
}

function isMTD(date: Date | null, asOnDate: Date): boolean {
  if (!date) return false;
  return (
    date.getFullYear() === asOnDate.getFullYear() &&
    date.getMonth()    === asOnDate.getMonth()    &&
    date.getDate()     <= asOnDate.getDate()
  );
}

function getYtdStart(asOnDate: Date): Date {
  const year = asOnDate.getFullYear();
  const month = asOnDate.getMonth();
  const fyStartYear = month < 3 ? year - 1 : year;
  return new Date(fyStartYear, 3, 1);
}

function isYTD(date: Date | null, asOnDate: Date): boolean {
  if (!date) return false;
  const start = getYtdStart(asOnDate);
  return date >= start && date <= asOnDate;
}

function isCollection(mode: TranMode): boolean {
  const m = String(mode ?? '').trim().toUpperCase();
  return m === 'C' || m === 'B';
}

function isDisbursement(mode: TranMode): boolean {
  const m = String(mode ?? '').trim().toUpperCase();
  return m === 'A';
}

// ─── main export ────────────────────────────────────────────────────────────

/**
 * @param txnRows      - parsed rows from the transaction statement Excel
 * @param balanceRows  - (optional) parsed rows from the balance sheet Excel;
 *                       used to identify overdue account numbers (DPD > 0)
 * @param totalOverdue - (optional) totalOverdue amount from balance KPIs,
 *                       used as the denominator for collectionEfficiencyTxn
 */
export function calculateTransactionKPIs(
  txnRows: Record<string, unknown>[],
  balanceRows: Record<string, unknown>[] = [],
  totalOverdue = 0,
  asOnDate: Date = new Date(),
): TransactionKPISnapshot {
  if (!txnRows.length) return emptyTransactionSnapshot();

  // Build set of overdue account numbers from balance sheet
  const overdueAccountSet = new Set<string>();
  for (const r of balanceRows) {
    if (safe(r.dpd) > 0) {
      const acct = String(r.loanAccountNumber ?? '').trim();
      if (acct) overdueAccountSet.add(acct);
    }
  }

  // ── Partition rows ────────────────────────────────────────────────────────
  // Collection rows: Tran Mode = C (Cash) or B (Bank) — per spec
  const collectionRows   = txnRows.filter((r) => isCollection(r.tranMode as TranMode));
  // Disbursement rows: Tran Mode = A — per spec
  // Fallback: if tranMode is missing/unknown, treat principalDr > 0 rows as disbursements
  const disbursementRows = txnRows.filter((r) => {
    if (isDisbursement(r.tranMode as TranMode)) return true;
    // Fallback for rows without a valid Tran Mode
    const mode = String(r.tranMode ?? '').trim().toUpperCase();
    return !mode && safe(r.principalDr) > 0;
  });

  // ── A. Collection KPIs ───────────────────────────────────────────────────
  let principalCollected = 0;
  let interestCollected  = 0;
  let totalCollected     = 0;
  let overdueCollection  = 0;

  const branchCollMap = new Map<string, {
    principalReceived: number;
    interestReceived: number;
    otherCharges: number;
    totalCollected: number;
    accountCount: number;
  }>();

  for (const r of collectionRows) {
    const principal   = safe(r.principalCr);
    const interest    = safe(r.interestRcvd);
    const totalRcvd   = safe(r.totalAmountReceived);
    const otherChg    = Math.max(0, totalRcvd - principal - interest);

    principalCollected += principal;
    interestCollected  += interest;
    totalCollected     += totalRcvd;

    // Cross-reference: is this account overdue?
    const acct = String(r.loanAccountNumber ?? '').trim();
    if (overdueAccountSet.has(acct)) {
      overdueCollection += totalRcvd;
    }

    // Per-branch breakdown
    const branch = String(r.branchName ?? 'Unknown');
    const bc = branchCollMap.get(branch) ?? {
      principalReceived: 0, interestReceived: 0,
      otherCharges: 0, totalCollected: 0, accountCount: 0,
    };
    branchCollMap.set(branch, {
      principalReceived: bc.principalReceived + principal,
      interestReceived:  bc.interestReceived  + interest,
      otherCharges:      bc.otherCharges      + otherChg,
      totalCollected:    bc.totalCollected    + totalRcvd,
      accountCount:      bc.accountCount      + 1,
    });
  }

  const collectionEfficiencyTxn =
    totalOverdue > 0 ? (overdueCollection / totalOverdue) * 100 : 0;

  const otherChargesTotal = Math.max(
    0,
    totalCollected - principalCollected - interestCollected,
  );

  const collection: CollectionBreakdown = {
    principalReceived: principalCollected,
    interestReceived:  interestCollected,
    otherCharges:      otherChargesTotal,
    totalCollected,
  };

  const branchCollections: BranchCollection[] = Array.from(branchCollMap.entries())
    .map(([branch, v]) => ({ branch, ...v }))
    .sort((a, b) => b.totalCollected - a.totalCollected);

  // ── B. Disbursement KPIs ─────────────────────────────────────────────────
  let ftdDisbursement   = 0;
  let mtdDisbursement   = 0;
  let ytdDisbursement   = 0;
  const disbursementCount = disbursementRows.length;

  // Daily trend map
  const dailyMap = new Map<string, { totalDisbursed: number; accountCount: number }>();
  // Branch disbursement map
  const branchDisbMap = new Map<string, {
    ftd: number; mtd: number; ytd: number;
    totalDisbursed: number; disbursementCount: number;
  }>();

  const newCustomerAccounts = new Set<string>();
  for (const r of disbursementRows) {
    const date   = r.transactionDate instanceof Date ? r.transactionDate : null;
    // disbursedAmount maps to "Issue Amount" column; fall back to principalDr if missing
    const amt    = safe(r.disbursedAmount) || safe(r.principalDr);
    const branch = String(r.branchName ?? 'Unknown');
    const isFtd = date != null && date.getFullYear() === asOnDate.getFullYear() && date.getMonth() === asOnDate.getMonth() && date.getDate() === asOnDate.getDate();

    if (isFtd) {
      ftdDisbursement += amt;
      const account = String(r.loanAccountNumber ?? '').trim();
      if (account) newCustomerAccounts.add(account);
    }
    if (isMTD(date, asOnDate))   mtdDisbursement += amt;
    if (isYTD(date, asOnDate))   ytdDisbursement += amt;

    // Daily trend
    const dateKey = toDateKey(date);
    if (dateKey) {
      const entry = dailyMap.get(dateKey) ?? { totalDisbursed: 0, accountCount: 0 };
      dailyMap.set(dateKey, {
        totalDisbursed: entry.totalDisbursed + amt,
        accountCount:   entry.accountCount   + 1,
      });
    }

    // Branch disbursement
    const bd = branchDisbMap.get(branch) ?? {
      ftd: 0, mtd: 0, ytd: 0, totalDisbursed: 0, disbursementCount: 0,
    };
    branchDisbMap.set(branch, {
      ftd:               bd.ftd               + (isFtd ? amt : 0),
      mtd:               bd.mtd               + (isMTD(date, asOnDate) ? amt : 0),
      ytd:               bd.ytd               + (isYTD(date, asOnDate) ? amt : 0),
      totalDisbursed:    bd.totalDisbursed    + amt,
      disbursementCount: bd.disbursementCount + 1,
    });
  }

  const dailyDisbursements: DailyDisbursement[] = Array.from(dailyMap.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const branchDisbursements: BranchDisbursementTxn[] = Array.from(branchDisbMap.entries())
    .map(([branch, v]) => ({ branch, ...v }))
    .sort((a, b) => b.totalDisbursed - a.totalDisbursed);

  return {
    principalCollected,
    interestCollected,
    totalCollected,
    overdueCollection,
    collectionEfficiencyTxn,
    collection,
    ftdDisbursement,
    mtdDisbursement,
    ytdDisbursement,
    disbursementCount,
    dailyDisbursements,
    branchDisbursements,
    branchCollections,
    totalTransactions:        txnRows.length,
    collectionTransactions:   collectionRows.length,
    disbursementTransactions: disbursementRows.length,
    newCustomerFromTxn:       newCustomerAccounts.size,
  };
}

function emptyTransactionSnapshot(): TransactionKPISnapshot {
  return {
    principalCollected: 0, interestCollected: 0, totalCollected: 0,
    overdueCollection: 0, collectionEfficiencyTxn: 0,
    collection: { principalReceived: 0, interestReceived: 0, otherCharges: 0, totalCollected: 0 },
    ftdDisbursement: 0, mtdDisbursement: 0, ytdDisbursement: 0, disbursementCount: 0,
    dailyDisbursements: [], branchDisbursements: [], branchCollections: [],
    totalTransactions: 0, collectionTransactions: 0, disbursementTransactions: 0,
    newCustomerFromTxn: 0,
  };
}
