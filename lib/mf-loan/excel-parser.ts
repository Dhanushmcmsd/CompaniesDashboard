/**
 * MF Loan Excel Parser
 *
 * Parses two file types:
 *   1. Loan Balance Statement — columns per spec:
 *      Customer Number, Principal Closing Balance, Rate of Interest,
 *      Disbursed Amount, Issue Date, DPD, Closing Principal Received, Closed On, Branch
 *
 *   2. Transaction Statement — columns per spec:
 *      Loan Account Number, Transaction Date, Principal Dr, Total Received, Branch
 *
 * Column name matching is fuzzy (multiple aliases per field + partial-match fallback)
 * so minor header variations in actual Excel exports don’t break the parse.
 *
 * File type detection checks BOTH filename AND sheet headers — so even if
 * a file is named generically (e.g. “Report.xlsx”) it will detect correctly.
 */

import * as XLSX from 'xlsx';
import type { MfLoanBalanceRow, MfLoanTransactionRow } from './types';

// ── Helpers ─────────────────────────────────────────────────────────────────────────────

/** Looks up a value in a row by trying multiple key aliases (case-insensitive + trimmed) */
function col(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    // Exact match first
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
    // Case-insensitive + trim match
    const match = Object.keys(row).find(
      (rk) => rk.trim().toLowerCase() === k.trim().toLowerCase(),
    );
    if (match && row[match] !== undefined && row[match] !== null && row[match] !== '') {
      return row[match];
    }
  }
  // Partial match fallback — e.g. 'Principal Closing' matches 'Principal Closing Balance (INR)'
  for (const k of keys) {
    const kLower = k.trim().toLowerCase();
    const partialMatch = Object.keys(row).find(
      (rk) => rk.trim().toLowerCase().includes(kLower) || kLower.includes(rk.trim().toLowerCase()),
    );
    if (partialMatch && row[partialMatch] !== undefined && row[partialMatch] !== null && row[partialMatch] !== '') {
      return row[partialMatch];
    }
  }
  return undefined;
}

function toNum(v: unknown): number {
  if (v == null || v === '') return 0;
  // Strip commas/spaces from numbers like "1,23,456.78"
  const cleaned = String(v).replace(/[, ]/g, '');
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    try {
      const parsed = XLSX.SSF.parse_date_code(v);
      if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d);
    } catch {
      return null;
    }
  }
  // Handle DD/MM/YYYY format common in Indian Excel exports
  const str = String(v).trim();
  const dmyMatch = str.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(str);
  return isNaN(date.getTime()) ? null : date;
}

// ── Balance Statement ──────────────────────────────────────────────────────────────────────────

export function parseMfLoanBalanceStatement(buffer: Buffer): MfLoanBalanceRow[] {
  const wb  = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws  = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

  return raw
    .filter((r) => Object.values(r).some((v) => v !== '' && v !== null))
    .map((r) => ({
      customerNumber: String(
        col(r,
          'Customer Number', 'CustomerNumber', 'customer_number', 'Cust No',
          'Customer No', 'Customer ID', 'Borrower No', 'Borrower Number',
        ) ?? '',
      ),
      principalClosingBalance: toNum(
        col(r,
          'Principal Closing Balance', 'Principal Closing Bal', 'Closing Balance',
          'Closing Bal', 'Principal Outstanding', 'Outstanding Principal',
          'OS Principal', 'Principal O/S', 'Outstanding Amount',
        )
      ),
      rateOfInterest: toNum(
        col(r,
          'Rate of Interest', 'ROI', 'Interest Rate', 'Rate', 'Rate Of Interest',
          'Interest %', 'Annual Rate', 'Rate(%)',
        )
      ),
      disbursedAmount: toNum(
        col(r,
          'Disbursed Amount', 'Disburse Amount', 'Loan Amount', 'Sanctioned Amount',
          'Disbursement Amount', 'Loan Sanctioned', 'Amount Disbursed', 'Disbursal Amt',
        )
      ),
      issueDate: toDate(
        col(r,
          'Issue Date', 'Disbursement Date', 'IssueDate', 'Loan Date', 'Disbursal Date',
          'Date of Issue', 'Loan Issue Date', 'Date of Disbursement',
        )
      ),
      dpd: toNum(
        col(r,
          'DPD', 'Days Past Due', 'Overdue Days', 'Days Overdue', 'DPD Days',
          'Overdue Day', 'No of DPD', 'DPD (Days)', 'Past Due Days',
        )
      ),
      closingPrincipalReceived: toNum(
        col(r,
          'Closing Principal Received', 'Principal Received', 'Closure Amount',
          'Closing Amt', 'Principal Collected', 'Closure Principal',
        )
      ),
      closedOnDate: toDate(
        col(r,
          'Closed On', 'Closure Date', 'ClosedDate', 'Closed Date', 'Closing Date',
          'Date of Closure', 'Date Closed', 'Closure On',
        )
      ),
      branch: String(
        col(r,
          'Branch', 'Branch Name', 'BranchName', 'Branch Code',
          'Office', 'Centre', 'Center', 'Location',
        ) ?? '',
      ),
    }));
}

// ── Transaction Statement ─────────────────────────────────────────────────────────────────────

export function parseMfLoanTransactionStatement(buffer: Buffer): MfLoanTransactionRow[] {
  const wb  = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws  = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

  return raw
    .filter((r) => Object.values(r).some((v) => v !== '' && v !== null))
    .map((r) => ({
      loanAccountNumber: String(
        col(r,
          'Loan Account Number', 'Account No', 'LoanNo', 'Loan No', 'Account Number',
          'Loan Account No', 'Account', 'Loan ID', 'Loan Acc No',
        ) ?? '',
      ),
      transactionDate: toDate(
        col(r,
          'Transaction Date', 'Txn Date', 'Date', 'Trans Date',
          'Transaction Dt', 'Txn Dt', 'Value Date',
        )
      ),
      principalDr: toNum(
        col(r,
          'Principal Dr', 'Principal Debit', 'Disbursement', 'Loan Dr',
          'Principal(Dr)', 'Principal (Dr)', 'Prin Dr', 'Principal Disbursed',
        )
      ),
      totalReceived: toNum(
        col(r,
          'Total Received', 'Amount Received', 'Collection', 'Total Amount Received',
          'Amt Received', 'Total Collection', 'Total Cr', 'Total Credit',
          'Amount Collected', 'Receipt Amount',
        )
      ),
      branch: String(
        col(r,
          'Branch', 'Branch Name', 'BranchName', 'Branch Code',
          'Office', 'Centre', 'Center', 'Location',
        ) ?? '',
      ),
    }));
}

// ── File type detection (filename + header sniff) ───────────────────────────────────────

/**
 * Detects file type from filename first, then falls back to sniffing
 * the first row headers of the Excel file itself.
 */
export function detectMfFileType(
  filename: string,
  buffer?: Buffer,
): 'Balance Statement' | 'Transaction Statement' | 'Unknown' {
  const n = filename.toLowerCase();

  // Filename-based detection
  if (n.includes('balance') || n.includes('loan balance') || n.includes('bal stmt') || n.includes('balstmt')) {
    return 'Balance Statement';
  }
  if (n.includes('transaction') || n.includes('txn') || n.includes('trans stmt') || n.includes('transstmt')) {
    return 'Transaction Statement';
  }

  // Header sniff fallback — read the first row of the Excel
  if (buffer) {
    try {
      const wb      = XLSX.read(buffer, { type: 'buffer', sheetRows: 2 });
      const ws      = wb.Sheets[wb.SheetNames[0]];
      const [first] = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      if (first) {
        const headers = Object.keys(first).join(' ').toLowerCase();
        if (
          headers.includes('principal closing') ||
          headers.includes('disbursed amount')  ||
          headers.includes('rate of interest')  ||
          headers.includes('dpd')
        ) return 'Balance Statement';
        if (
          headers.includes('transaction date') ||
          headers.includes('txn date')         ||
          headers.includes('principal dr')     ||
          headers.includes('total received')
        ) return 'Transaction Statement';
      }
    } catch {
      // ignore parse errors during sniffing
    }
  }

  return 'Unknown';
}
