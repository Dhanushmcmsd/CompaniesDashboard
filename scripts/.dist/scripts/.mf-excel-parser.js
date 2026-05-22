"use strict";
/**
 * MF Loan Excel Parser — production column headers (Group Loan exports).
 * File type detected from column headers; title row skipped when present (skipRows = 1).
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectMfFile = detectMfFile;
exports.detectMfFileType = detectMfFileType;
exports.parseMfLoanBalanceStatement = parseMfLoanBalanceStatement;
exports.parseMfLoanTransactionStatement = parseMfLoanTransactionStatement;
const XLSX = __importStar(require("xlsx"));
const excel_parser_1 = require("../lib/gold-loan/excel-parser");
// ─────────────────────────────────────────────────────────────────────────────
// FILE TYPE 4: MF Balance Statement — production aliases (keep legacy fallbacks)
// ─────────────────────────────────────────────────────────────────────────────
const BALANCE_ALIASES = {
    loanAccountNumber: [
        'Sub A/c Number', 'Sub A/c No', 'Sub Account Number', 'Sub Account No',
        'Loan Account Number', 'Account Number',
    ],
    groupAccountNumber: [
        'Group A/c Number', 'Group A/c No', 'Group Account Number',
    ],
    customerNumber: [
        'Customer Number', 'Customer No', 'CustomerNumber', 'customer_number',
        'Customer ID', 'Cust No', 'Member No', 'Client No',
    ],
    borrowerNumber: [
        'Borrower #', 'Borrower#', 'Borrower No', 'Borrower Number',
    ],
    customerName: ['Customer Name', 'Group Name', 'Name'],
    principalClosingBalance: [
        'Prin. Closing Bal.', 'Prin Closing Bal', 'Principal Closing Balance',
        'Principal Closing Bal', 'Closing Balance', 'Closing Bal',
        'Principal Outstanding', 'Outstanding Principal', 'OS Principal',
        'Principal Balance', 'Closing Principal',
    ],
    principalOpeningBalance: [
        'Prin. Opening Bal.', 'Prin Opening Bal', 'Opening Balance',
    ],
    principalDr: [
        'Prin Dr. for Period', 'Prin Dr for Period', 'Principal Dr', 'Principal Debit',
    ],
    principalCr: [
        'Prin Cr. for Period', 'Prin Cr for Period', 'Principal Cr', 'Principal Credit',
    ],
    interestRcvd: [
        'Interest Rcvd for Period', 'Interest Received for Period', 'Interest Rcvd',
    ],
    rateOfInterest: [
        'Rate Of Interest', 'Rate of Interest', 'ROI', 'Interest Rate', 'Rate',
        'Interest %', 'Annual Rate', 'Rate(%)', 'Rate of Int', 'Int Rate',
    ],
    disbursedAmount: [
        'Disbursed Amount', 'Disburse Amount', 'Loan Amount', 'Sanctioned Amount',
        'Disbursement Amount', 'Amount Disbursed', 'Disbursal Amt',
    ],
    issueDate: [
        'Issue Date', 'Disbursement Date', 'IssueDate', 'Loan Date', 'Disbursal Date',
        'Date of Issue', 'Loan Issue Date', 'Date of Disbursement',
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
        'Branch Name', 'Branch', 'BranchName', 'Branch Code', 'Branch ID',
        'Office', 'Centre', 'Center', 'Location',
    ],
    schemeName: ['Scheme Name', 'Scheme Code'],
    schemeCode: ['Scheme Code'],
};
// ─────────────────────────────────────────────────────────────────────────────
// FILE TYPE 5: MF Transaction Statement
// ─────────────────────────────────────────────────────────────────────────────
const TXN_ALIASES = {
    loanAccountNumber: [
        'Sub A/c Number', 'Sub A/c No', 'Sub Account Number',
        'Loan Account Number', 'Account No', 'Loan No', 'Account Number',
    ],
    groupAccountNumber: ['Group A/c Number', 'Group A/c No'],
    customerId: ['Customer ID', 'Customer Number', 'Cust ID'],
    customerName: ['Customer Name', 'Name'],
    transactionDate: [
        'Tran. Date', 'Tran Date', 'Transaction Date', 'Txn Date', 'Trans Date',
        'Transaction Dt', 'Txn Dt', 'Value Date', 'Payment Date',
    ],
    transactionType: ['Tran. Type', 'Tran Type', 'Transaction Type'],
    transactionId: ['Tran. ID', 'Tran ID', 'Transaction ID', 'Txn ID'],
    principalDr: [
        'Principal Dr', 'Principal Dr.', 'Principal Debit', 'Disbursement',
        'Principal(Dr)', 'Principal (Dr)', 'Prin Dr',
    ],
    principalCr: [
        'Principal Cr', 'Principal Cr.', 'Principal Credit', 'Principal(Cr)',
    ],
    interestRcvd: [
        'Interest Received Cr', 'Interest Received Cr.', 'Interest Received',
        'Interest Rcvd Cr',
    ],
    totalReceived: [
        'Total Rcvd', 'Total Received',
    ],
    tranMode: ['Tran. Mode', 'Tran Mode', 'Transaction Mode', 'Mode'],
    branch: [
        'Branch Name', 'Branch', 'BranchName', 'Branch ID', 'Branch Code',
        'Office', 'Centre', 'Center',
    ],
};
const BALANCE_REQUIRED = ['customerNumber', 'principalClosingBalance', 'disbursedAmount'];
const TXN_REQUIRED = ['loanAccountNumber', 'transactionDate', 'totalReceived'];
// ─────────────────────────────────────────────────────────────────────────────
// Matrix read — skip title row (row 0) when headers are on row 1
// ─────────────────────────────────────────────────────────────────────────────
function sheetToRows(buffer) {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
    if (!matrix.length)
        return [];
    const headerRowIndex = (0, excel_parser_1.detectHeaderRowIndex)(matrix);
    const originalHeaders = (matrix[headerRowIndex] ?? []).map((c) => String(c ?? '').trim());
    const normalizedHeaders = originalHeaders.map(excel_parser_1.normalizeHeader);
    const rows = [];
    for (let i = headerRowIndex + 1; i < matrix.length; i++) {
        const arr = matrix[i] ?? [];
        if (!arr.some((v) => v != null && String(v).trim() !== ''))
            continue;
        const row = {};
        originalHeaders.forEach((orig, idx) => {
            row[orig] = arr[idx] ?? '';
            row[normalizedHeaders[idx]] = arr[idx] ?? '';
        });
        rows.push(row);
    }
    return rows;
}
function col(row, aliases) {
    const normKeys = Object.keys(row).filter((k) => k === (0, excel_parser_1.normalizeHeader)(k));
    const key = (0, excel_parser_1.findColumn)(normKeys, aliases);
    if (key)
        return row[key];
    for (const a of aliases) {
        if (row[a] !== undefined)
            return row[a];
        const found = Object.keys(row).find((k) => k.trim().toLowerCase() === a.trim().toLowerCase());
        if (found)
            return row[found];
    }
    return undefined;
}
function toNum(v) {
    if (v == null || v === '')
        return 0;
    const n = Number(String(v).replace(/[, ]/g, ''));
    return isNaN(n) ? 0 : n;
}
function toDate(v) {
    if (!v)
        return null;
    if (v instanceof Date)
        return isNaN(v.getTime()) ? null : v;
    if (typeof v === 'number') {
        try {
            const p = XLSX.SSF.parse_date_code(v);
            if (p)
                return new Date(p.y, p.m - 1, p.d);
        }
        catch {
            return null;
        }
    }
    const s = String(v).trim();
    const dmy = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (dmy) {
        const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
        return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}
function matchCanonical(headers, aliases) {
    const normalized = headers.map(excel_parser_1.normalizeHeader);
    const matched = [];
    for (const canonical of Object.keys(aliases)) {
        if ((0, excel_parser_1.findColumn)(normalized, aliases[canonical]))
            matched.push(canonical);
    }
    const missing = Object.keys(aliases).filter((c) => !matched.includes(c));
    return { matched, missing };
}
function detectMfFile(filename, buffer) {
    try {
        const wb = XLSX.read(buffer, { type: 'buffer', sheetRows: 6 });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const headerRowIndex = (0, excel_parser_1.detectHeaderRowIndex)(matrix);
        const headerRow = (matrix[headerRowIndex] ?? []).map((c) => String(c ?? '').trim()).filter(Boolean);
        if (headerRow.length) {
            const bal = matchCanonical(headerRow, BALANCE_ALIASES);
            const txn = matchCanonical(headerRow, TXN_ALIASES);
            const balReq = BALANCE_REQUIRED.filter((r) => bal.matched.includes(r)).length;
            const txnReq = TXN_REQUIRED.filter((r) => txn.matched.includes(r)).length;
            if (balReq >= 3 && balReq >= txnReq) {
                return {
                    fileType: 'Balance Statement',
                    matchedColumns: bal.matched,
                    missingColumns: bal.missing,
                    confidence: balReq === BALANCE_REQUIRED.length ? 'high' : 'low',
                    detectedVia: 'headers',
                };
            }
            if (txnReq >= 2 && txnReq >= balReq) {
                return {
                    fileType: 'Transaction Statement',
                    matchedColumns: txn.matched,
                    missingColumns: txn.missing,
                    confidence: txnReq === TXN_REQUIRED.length ? 'high' : 'low',
                    detectedVia: 'headers',
                };
            }
        }
    }
    catch {
        /* fall through */
    }
    const n = filename.toLowerCase();
    if (n.includes('balance') || n.includes('bal stmt') || n.includes('balstmt')) {
        return { fileType: 'Balance Statement', matchedColumns: [], missingColumns: [], confidence: 'low', detectedVia: 'filename' };
    }
    if (n.includes('transaction') || n.includes('txn') || n.includes('trans')) {
        return { fileType: 'Transaction Statement', matchedColumns: [], missingColumns: [], confidence: 'low', detectedVia: 'filename' };
    }
    return { fileType: 'Unknown', matchedColumns: [], missingColumns: [], confidence: 'none', detectedVia: 'none' };
}
function detectMfFileType(filename, buffer) {
    if (buffer)
        return detectMfFile(filename, buffer).fileType;
    const n = filename.toLowerCase();
    if (n.includes('balance'))
        return 'Balance Statement';
    if (n.includes('transaction') || n.includes('txn'))
        return 'Transaction Statement';
    return 'Unknown';
}
// ─────────────────────────────────────────────────────────────────────────────
// Parsers
// ─────────────────────────────────────────────────────────────────────────────
function parseMfLoanBalanceStatement(buffer) {
    const raw = sheetToRows(buffer);
    return raw.map((r) => ({
        customerNumber: String(col(r, BALANCE_ALIASES.customerNumber) ?? ''),
        loanAccountNumber: String(col(r, BALANCE_ALIASES.loanAccountNumber) ?? ''),
        principalClosingBalance: toNum(col(r, BALANCE_ALIASES.principalClosingBalance)),
        rateOfInterest: toNum(col(r, BALANCE_ALIASES.rateOfInterest)),
        disbursedAmount: toNum(col(r, BALANCE_ALIASES.disbursedAmount)),
        issueDate: toDate(col(r, BALANCE_ALIASES.issueDate)),
        dpd: toNum(col(r, BALANCE_ALIASES.dpd)),
        closingPrincipalReceived: toNum(col(r, BALANCE_ALIASES.closingPrincipalReceived)),
        closedOnDate: toDate(col(r, BALANCE_ALIASES.closedOnDate)),
        branch: String(col(r, BALANCE_ALIASES.branch) ?? ''),
    }));
}
function parseMfLoanTransactionStatement(buffer) {
    const raw = sheetToRows(buffer);
    return raw.map((r) => ({
        loanAccountNumber: String(col(r, TXN_ALIASES.loanAccountNumber) ?? ''),
        transactionDate: toDate(col(r, TXN_ALIASES.transactionDate)),
        principalDr: toNum(col(r, TXN_ALIASES.principalDr)),
        principalCr: toNum(col(r, TXN_ALIASES.principalCr)),
        totalReceived: toNum(col(r, TXN_ALIASES.totalReceived)),
        interestRcvd: toNum(col(r, TXN_ALIASES.interestRcvd)),
        tranMode: String(col(r, TXN_ALIASES.tranMode) ?? ''),
        branch: String(col(r, TXN_ALIASES.branch) ?? ''),
    }));
}
