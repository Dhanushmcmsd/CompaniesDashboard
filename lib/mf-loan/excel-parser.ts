/**
 * MF Loan Excel Parser — Smart Auto-Detection
 *
 * File type is detected PURELY from column headers — filename is irrelevant.
 * Works even if the file is named "Report.xlsx" or "May2026.xlsx".
 *
 * Detection logic:
 *   - Scores each file type by how many of its required columns it can match
 *   - Uses fuzzy matching: exact → case-insensitive → partial substring
 *   - Returns the type with the highest score (must match ≥3 required columns)
 *   - Also returns which columns were matched and which are missing —
 *     shown to the employee on upload so they know what was parsed
 */

import * as XLSX from 'xlsx';
import type { MfLoanBalanceRow, MfLoanTransactionRow } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Column alias map — canonical name → all known variations
// ─────────────────────────────────────────────────────────────────────────────

const BALANCE_ALIASES: Record<string, string[]> = {
  customerNumber: [
    'Customer Number', 'CustomerNumber', 'customer_number', 'Cust No', 'Customer No',
    'Customer ID', 'Borrower No', 'Borrower Number', 'Member No', 'Client No',
  ],
  principalClosingBalance: [
    'Principal Closing Balance', 'Principal Closing Bal', 'Closing Balance', 'Closing Bal',
    'Principal Outstanding', 'Outstanding Principal', 'OS Principal', 'Principal O/S',
    'Outstanding Amount', 'Principal Balance', 'Closing Principal',
  ],
  rateOfInterest: [
    'Rate of Interest', 'ROI', 'Interest Rate', 'Rate', 'Rate Of Interest',
    'Interest %', 'Annual Rate', 'Rate(%)', 'Rate of Int', 'Int Rate',
  ],
  disbursedAmount: [
    'Disbursed Amount', 'Disburse Amount', 'Loan Amount', 'Sanctioned Amount',
    'Disbursement Amount', 'Loan Sanctioned', 'Amount Disbursed', 'Disbursal Amt',
    'Loan Disbursal Amount', 'Loan Value',
  ],
  issueDate: [
    'Issue Date', 'Disbursement Date', 'IssueDate', 'Loan Date', 'Disbursal Date',
    'Date of Issue', 'Loan Issue Date', 'Date of Disbursement', 'Disbursal Dt',
  ],
  dpd: [
    'DPD', 'Days Past Due', 'Overdue Days', 'Days Overdue', 'DPD Days',
    'Overdue Day', 'No of DPD', 'DPD (Days)', 'Past Due Days', 'Days Delay',
  ],
  closingPrincipalReceived: [
    'Closing Principal Received', 'Principal Received', 'Closure Amount', 'Closing Amt',
    'Principal Collected', 'Closure Principal', 'Principal Repaid',
  ],
  closedOnDate: [
    'Closed On', 'Closure Date', 'ClosedDate', 'Closed Date', 'Closing Date',
    'Date of Closure', 'Date Closed', 'Closure On', 'Loan Closed Date',
  ],
  branch: [
    'Branch', 'Branch Name', 'BranchName', 'Branch Code', 'Office',
    'Centre', 'Center', 'Location', 'Area', 'Zone',
  ],
};

const TXN_ALIASES: Record<string, string[]> = {
  loanAccountNumber: [
    'Loan Account Number', 'Account No', 'LoanNo', 'Loan No', 'Account Number',
    'Loan Account No', 'Account', 'Loan ID', 'Loan Acc No', 'Acc No',
  ],
  transactionDate: [
    'Transaction Date', 'Txn Date', 'Date', 'Trans Date', 'Transaction Dt',
    'Txn Dt', 'Value Date', 'Payment Date',
  ],
  principalDr: [
    'Principal Dr', 'Principal Debit', 'Disbursement', 'Loan Dr', 'Principal(Dr)',
    'Principal (Dr)', 'Prin Dr', 'Principal Disbursed', 'Loan Disbursement',
  ],
  totalReceived: [
    'Total Received', 'Amount Received', 'Collection', 'Total Amount Received',
    'Amt Received', 'Total Collection', 'Total Cr', 'Total Credit',
    'Amount Collected', 'Receipt Amount', 'Total Payment',
  ],
  branch: [
    'Branch', 'Branch Name', 'BranchName', 'Branch Code', 'Office',
    'Centre', 'Center', 'Location',
  ],
};

// Required columns for each type (must match ≥3 to declare a winner)
const BALANCE_REQUIRED = ['customerNumber', 'principalClosingBalance', 'disbursedAmount', 'dpd'];
const TXN_REQUIRED     = ['loanAccountNumber', 'transactionDate', 'totalReceived'];

// ─────────────────────────────────────────────────────────────────────────────
// Core utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Find the actual header key in a row that best matches one of the aliases */
function findKey(rowKeys: string[], aliases: string[]): string | null {
  // 1. Exact match
  for (const a of aliases) {
    if (rowKeys.includes(a)) return a;
  }
  // 2. Case-insensitive + trimmed match
  for (const a of aliases) {
    const found = rowKeys.find((k) => k.trim().toLowerCase() === a.trim().toLowerCase());
    if (found) return found;
  }
  // 3. Partial match — alias is substring of header, or header is substring of alias
  for (const a of aliases) {
    const aLow = a.trim().toLowerCase();
    const found = rowKeys.find((k) => {
      const kLow = k.trim().toLowerCase();
      return kLow.includes(aLow) || aLow.includes(kLow);
    });
    if (found) return found;
  }
  return null;
}

function col(row: Record<string, unknown>, aliases: string[]): unknown {
  const key = findKey(Object.keys(row), aliases);
  return key ? row[key] : undefined;
}

function toNum(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = Number(String(v).replace(/[, ]/g, ''));
  return isNaN(n) ? 0 : n;
}

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    try {
      const p = XLSX.SSF.parse_date_code(v);
      if (p) return new Date(p.y, p.m - 1, p.d);
    } catch { return null; }
  }
  const s = String(v).trim();
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ─────────────────────────────────────────────────────────────────────────────
// Smart detection — score headers against each file type
// ─────────────────────────────────────────────────────────────────────────────

export type DetectionResult = {
  fileType:       'Balance Statement' | 'Transaction Statement' | 'Unknown';
  matchedColumns: string[];   // canonical names that were found
  missingColumns: string[];   // canonical names that were NOT found
  confidence:     'high' | 'low' | 'none';
  detectedVia:    'headers' | 'filename' | 'none';
};

export function detectMfFile(filename: string, buffer: Buffer): DetectionResult {
  // Try header-based detection first (most reliable)
  try {
    const wb   = XLSX.read(buffer, { type: 'buffer', sheetRows: 3 });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
    const first = rows[0];

    if (first) {
      const rowKeys = Object.keys(first);

      // Score Balance Statement
      const balMatched = Object.keys(BALANCE_ALIASES).filter(
        (canonical) => findKey(rowKeys, BALANCE_ALIASES[canonical]) !== null,
      );
      const balReqMatched = BALANCE_REQUIRED.filter((r) => balMatched.includes(r)).length;

      // Score Transaction Statement
      const txnMatched = Object.keys(TXN_ALIASES).filter(
        (canonical) => findKey(rowKeys, TXN_ALIASES[canonical]) !== null,
      );
      const txnReqMatched = TXN_REQUIRED.filter((r) => txnMatched.includes(r)).length;

      if (balReqMatched >= 3 && balReqMatched >= txnReqMatched) {
        const missingColumns = Object.keys(BALANCE_ALIASES).filter((c) => !balMatched.includes(c));
        return {
          fileType:       'Balance Statement',
          matchedColumns: balMatched,
          missingColumns,
          confidence:     balReqMatched === BALANCE_REQUIRED.length ? 'high' : 'low',
          detectedVia:    'headers',
        };
      }
      if (txnReqMatched >= 2 && txnReqMatched >= balReqMatched) {
        const missingColumns = Object.keys(TXN_ALIASES).filter((c) => !txnMatched.includes(c));
        return {
          fileType:       'Transaction Statement',
          matchedColumns: txnMatched,
          missingColumns,
          confidence:     txnReqMatched === TXN_REQUIRED.length ? 'high' : 'low',
          detectedVia:    'headers',
        };
      }
    }
  } catch { /* fall through to filename */ }

  // Filename fallback
  const n = filename.toLowerCase();
  if (n.includes('balance') || n.includes('bal stmt') || n.includes('balstmt')) {
    return { fileType: 'Balance Statement',     matchedColumns: [], missingColumns: [], confidence: 'low', detectedVia: 'filename' };
  }
  if (n.includes('transaction') || n.includes('txn') || n.includes('trans')) {
    return { fileType: 'Transaction Statement', matchedColumns: [], missingColumns: [], confidence: 'low', detectedVia: 'filename' };
  }

  return { fileType: 'Unknown', matchedColumns: [], missingColumns: [], confidence: 'none', detectedVia: 'none' };
}

// Keep backward-compat shim
export function detectMfFileType(
  filename: string,
  buffer?: Buffer,
): 'Balance Statement' | 'Transaction Statement' | 'Unknown' {
  if (buffer) return detectMfFile(filename, buffer).fileType;
  const n = filename.toLowerCase();
  if (n.includes('balance')) return 'Balance Statement';
  if (n.includes('transaction') || n.includes('txn')) return 'Transaction Statement';
  return 'Unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsers
// ─────────────────────────────────────────────────────────────────────────────

export function parseMfLoanBalanceStatement(buffer: Buffer): MfLoanBalanceRow[] {
  const wb  = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws  = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

  return raw
    .filter((r) => Object.values(r).some((v) => v !== '' && v !== null))
    .map((r) => ({
      customerNumber:           String(col(r, BALANCE_ALIASES.customerNumber)           ?? ''),
      principalClosingBalance:  toNum( col(r, BALANCE_ALIASES.principalClosingBalance)),
      rateOfInterest:           toNum( col(r, BALANCE_ALIASES.rateOfInterest)),
      disbursedAmount:          toNum( col(r, BALANCE_ALIASES.disbursedAmount)),
      issueDate:                toDate(col(r, BALANCE_ALIASES.issueDate)),
      dpd:                      toNum( col(r, BALANCE_ALIASES.dpd)),
      closingPrincipalReceived: toNum( col(r, BALANCE_ALIASES.closingPrincipalReceived)),
      closedOnDate:             toDate(col(r, BALANCE_ALIASES.closedOnDate)),
      branch:                   String(col(r, BALANCE_ALIASES.branch)                  ?? ''),
    }));
}

export function parseMfLoanTransactionStatement(buffer: Buffer): MfLoanTransactionRow[] {
  const wb  = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws  = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

  return raw
    .filter((r) => Object.values(r).some((v) => v !== '' && v !== null))
    .map((r) => ({
      loanAccountNumber: String(col(r, TXN_ALIASES.loanAccountNumber) ?? ''),
      transactionDate:   toDate(col(r, TXN_ALIASES.transactionDate)),
      principalDr:       toNum( col(r, TXN_ALIASES.principalDr)),
      totalReceived:     toNum( col(r, TXN_ALIASES.totalReceived)),
      branch:            String(col(r, TXN_ALIASES.branch) ?? ''),
    }));
}
