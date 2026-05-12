/**
 * MF Loan Excel Parser
 *
 * Parses two file types:
 *   1. Loan Balance Statement — columns per spec:
 *      Customer Number, Principal Closing Balance, Rate of Interest,
 *      Disbursed Amount, Issue Date, DPD, Closing Principal Received, Closed On
 *
 *   2. Transaction Statement — columns per spec:
 *      Loan Account Number / Transaction Date / Principal Dr / Total Received
 *
 * Column name matching is fuzzy (multiple aliases per field) so minor header
 * variations in the actual Excel don't break the parse.
 */

import * as XLSX from 'xlsx';
import type { MfLoanBalanceRow, MfLoanTransactionRow } from './types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function col(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
    // Case-insensitive fallback
    const match = Object.keys(row).find(
      (rk) => rk.trim().toLowerCase() === k.toLowerCase(),
    );
    if (match && row[match] !== undefined && row[match] !== null && row[match] !== '') {
      return row[match];
    }
  }
  return undefined;
}

function toNum(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    // Excel serial date
    try {
      const parsed = XLSX.SSF.parse_date_code(v);
      if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d);
    } catch {
      return null;
    }
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

// ── Balance Statement ─────────────────────────────────────────────────────────

export function parseMfLoanBalanceStatement(buffer: Buffer): MfLoanBalanceRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

  return raw
    .filter((r) => Object.values(r).some((v) => v !== '' && v !== null))
    .map((r) => ({
      customerNumber:          String(col(r, 'Customer Number', 'CustomerNumber', 'customer_number', 'Cust No') ?? ''),
      principalClosingBalance: toNum(col(r, 'Principal Closing Balance', 'Principal Closing Bal', 'Closing Balance', 'Closing Bal', 'Principal Outstanding')),
      rateOfInterest:          toNum(col(r, 'Rate of Interest', 'ROI', 'Interest Rate', 'Rate')),
      disbursedAmount:         toNum(col(r, 'Disbursed Amount', 'Disburse Amount', 'Loan Amount', 'Sanctioned Amount', 'Disbursement Amount')),
      issueDate:               toDate(col(r, 'Issue Date', 'Disbursement Date', 'IssueDate', 'Loan Date', 'Disbursal Date')),
      dpd:                     toNum(col(r, 'DPD', 'Days Past Due', 'Overdue Days', 'Days Overdue', 'DPD Days')),
      closingPrincipalReceived:toNum(col(r, 'Closing Principal Received', 'Principal Received', 'Closure Amount', 'Closing Amt')),
      closedOnDate:            toDate(col(r, 'Closed On', 'Closure Date', 'ClosedDate', 'Closed Date', 'Closing Date')),
      branch:                  String(col(r, 'Branch', 'Branch Name', 'BranchName') ?? ''),
    }));
}

// ── Transaction Statement ─────────────────────────────────────────────────────

export function parseMfLoanTransactionStatement(buffer: Buffer): MfLoanTransactionRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

  return raw
    .filter((r) => Object.values(r).some((v) => v !== '' && v !== null))
    .map((r) => ({
      loanAccountNumber: String(col(r, 'Loan Account Number', 'Account No', 'LoanNo', 'Loan No', 'Account Number') ?? ''),
      transactionDate:   toDate(col(r, 'Transaction Date', 'Txn Date', 'Date', 'Trans Date')),
      principalDr:       toNum(col(r, 'Principal Dr', 'Principal Debit', 'Disbursement', 'Loan Dr', 'Principal(Dr)')),
      totalReceived:     toNum(col(r, 'Total Received', 'Amount Received', 'Collection', 'Total Amount Received', 'Amt Received')),
      branch:            String(col(r, 'Branch', 'Branch Name', 'BranchName') ?? ''),
    }));
}

// ── File type detection ───────────────────────────────────────────────────────

export function detectMfFileType(
  filename: string,
): 'Balance Statement' | 'Transaction Statement' | 'Unknown' {
  const n = filename.toLowerCase();
  if (n.includes('balance') || n.includes('loan balance') || n.includes('bal stmt')) return 'Balance Statement';
  if (n.includes('transaction') || n.includes('txn') || n.includes('trans stmt')) return 'Transaction Statement';
  return 'Unknown';
}
