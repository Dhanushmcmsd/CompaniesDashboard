"use strict";
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
exports.getAliasesForFileType = getAliasesForFileType;
exports.normalizeHeader = normalizeHeader;
exports.detectHeaderRowIndex = detectHeaderRowIndex;
exports.findColumn = findColumn;
exports.findAllColumns = findAllColumns;
exports.parseGoldLoanExcel = parseGoldLoanExcel;
const XLSX = __importStar(require("xlsx"));
const KEYWORDS = ["account", "customer", "balance", "disburs", "principal", "interest", "gold", "dpd", "branch"];
/** Shared optional fields — merged into each file-type map at parse time. */
const SHARED_ALIASES = {
    branchState: ["br state", "br. state"],
    branchRegion: ["br region", "br. region"],
    otherCharges: ["other charges", "other charges due"],
    isClosed: ["closed", "loan closed", "is closed"],
};
/** FILE TYPE 1: Gold Loan Balance Statement (production headers). */
const BALANCE_ALIASES = {
    loanAccountNumber: [
        "account num#",
        "account num number",
        "account numnumber",
        "account number",
        "loan account number",
        "account num",
    ],
    customerId: ["customer id", "customer number", "customer code", "cust id"],
    customerName: ["customer name", "name"],
    branchName: ["branch name", "branch"],
    branchCode: ["br. code", "br code", "branch code"],
    schemeName: ["scheme name", "loan type", "product", "loan product"],
    schemeCode: ["scheme code"],
    inventoryNo: ["inventory no", "inventory number"],
    disbursementDate: ["disbursment date", "disbursement date", "disb date"],
    disbursedAmount: ["disbursed amount", "disbursement amount", "loan amount"],
    closingBalance: ["closing balance", "closing balance cr", "principal closing amount"],
    openingBalance: ["opening balance"],
    principalDr: ["principal dr.", "principal dr", "principal debit"],
    principalCr: ["principal cr.", "principal cr", "principal credit", "principal received", "principal collection"],
    interestRcvd: ["interest rcvd", "tot. intr. amount", "intr. amount"],
    interestRcvDuring: ["interest rcvd during"],
    interestRate: ["total interest rate", "interest rate", "yield"],
    goldWeight: ["gold wt.", "gold wt", "gold weight", "net gold weight"],
    grossWt: ["gross wt.", "gross wt", "gross weight"],
    goldPurity: ["purity", "gold purity"],
    presentRate: ["present rate", "rate per gram", "gold rate"],
    dpd: ["dpd", "days past due", "days overdue"],
    totalOutstanding: ["total outstanding", "loan outstanding"],
    totalInterestDue: ["total interest due"],
    maturityDate: ["maturity date"],
    inventoryDate: ["inventory date"],
    loanPeriod: ["loan period"],
    loanPeriodType: ["loan period type"],
};
/** FILE TYPE 2: Gold Loan Transaction Statement. */
const TRANSACTION_ALIASES = {
    loanAccountNumber: ["account number", "account num#", "account num number", "loan account number"],
    customerId: ["customer number", "customer id", "customer code", "cust id"],
    customerName: ["name", "customer name"],
    branchName: ["branch name", "branch"],
    branchCode: ["br. code", "br code", "branch code"],
    schemeName: ["loan type", "scheme name", "product", "loan product"],
    inventoryNo: ["inventory number", "inventory no"],
    disbursementDate: ["issue date"],
    disbursedAmount: ["issue amount"],
    principalDr: ["principal debit", "principal dr.", "principal dr"],
    principalCr: ["principal credit", "principal cr.", "principal cr"],
    interestRcvd: ["tot. intr. amount", "tot intr amount", "intr. amount", "total interest amount"],
    interestRate: ["rate of interest", "interest rate"],
    transactionDate: ["trandate", "tran date", "transaction date"],
    tranMode: ["tran mode", "transaction mode", "mode"],
    totalAmountReceived: [
        "amount received",
        "interest and other charges received",
    ],
};
/** FILE TYPE 3: Gold Loan Interest Extract. */
const INTEREST_EXTRACT_ALIASES = {
    loanAccountNumber: ["account number", "account num#", "account num number"],
    customerId: ["customer number", "customer id"],
    customerName: ["name", "customer name"],
    branchName: ["branch name", "branch"],
    branchCode: ["br. code", "br code", "branch code"],
    schemeName: ["loan type", "scheme name"],
    inventoryNo: ["inventory number", "inventory no"],
    disbursementDate: ["issue date"],
    disbursedAmount: ["issue amount"],
    principalCr: ["principal credit", "principal cr.", "principal cr"],
    interestRcvd: ["tot. intr. amount", "intr. amount", "interest received upto", "last interest received upto"],
    interestRate: ["rate of interest", "interest rate"],
    transactionDate: ["trandate", "tran date"],
    tranMode: ["tran mode"],
    goldWeight: ["ornament weight", "gold wt.", "gold wt"],
    goldPurity: ["purity"],
};
function mergeAliases(...maps) {
    const out = {};
    for (const m of maps) {
        for (const [k, v] of Object.entries(m)) {
            out[k] = [...(out[k] ?? []), ...v];
        }
    }
    return out;
}
function getAliasesForFileType(fileType) {
    switch (fileType) {
        case "balance":
            return mergeAliases(BALANCE_ALIASES, SHARED_ALIASES);
        case "transaction":
            return mergeAliases(TRANSACTION_ALIASES, SHARED_ALIASES);
        case "interest-extract":
            return mergeAliases(INTEREST_EXTRACT_ALIASES, SHARED_ALIASES);
        default:
            return mergeAliases(BALANCE_ALIASES, TRANSACTION_ALIASES, SHARED_ALIASES);
    }
}
/**
 * Normalize a raw Excel header cell value to a stable lowercase string.
 */
function normalizeHeader(value) {
    return String(value ?? "")
        .toLowerCase()
        .replace(/\r?\n/g, " ")
        .replace(/#/g, " number ")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
/**
 * Production files: title row at index 0, column headers at index 1 (skipRows = 1).
 */
function detectHeaderRowIndex(matrix) {
    const row0Text = (matrix[0] ?? []).map((c) => String(c ?? "")).join(" ").toLowerCase();
    if (/balance statement between/i.test(row0Text))
        return 1;
    if (/transactions during period/i.test(row0Text))
        return 1;
    if (/interest extract between/i.test(row0Text))
        return 1;
    if (/\bgroup\b/i.test(row0Text) && /loan|balance|transaction|closed/i.test(row0Text))
        return 1;
    const row0Norm = normalizeHeader(matrix[0]?.[0]);
    const row1Norm = normalizeHeader(matrix[1]?.[0]);
    if (row0Norm.length < 3 && row1Norm === "branch name")
        return 1;
    return findBestHeaderRow(matrix);
}
function detectFileTypeFromTitle(titleRows) {
    const title = titleRows.join(" ").toLowerCase();
    if (/balance statement between/i.test(title))
        return "balance";
    if (/transactions during period/i.test(title))
        return "transaction";
    if (/interest extract between/i.test(title))
        return "interest-extract";
    return null;
}
function findBestHeaderRow(rows) {
    let bestIndex = 0;
    let bestScore = -1;
    const scan = Math.min(5, rows.length);
    for (let i = 0; i < scan; i++) {
        const cells = (rows[i] ?? []).map(normalizeHeader);
        const nonEmpty = cells.filter(Boolean).length;
        const hits = KEYWORDS.reduce((acc, kw) => (cells.some((c) => c.includes(kw)) ? acc + 1 : acc), 0);
        const score = nonEmpty + hits * 3;
        if (hits >= 2 && score > bestScore) {
            bestScore = score;
            bestIndex = i;
        }
    }
    return bestIndex;
}
function fuzzyMatch(header, alias) {
    return header.includes(alias) || alias.includes(header);
}
function findColumn(headers, aliases) {
    for (const alias of aliases) {
        const normAlias = normalizeHeader(alias);
        const exact = headers.find((h) => h === normAlias);
        if (exact)
            return exact;
    }
    for (const alias of aliases) {
        const normAlias = normalizeHeader(alias);
        const fuzzy = headers.find((h) => fuzzyMatch(h, normAlias));
        if (fuzzy)
            return fuzzy;
    }
    return null;
}
/** All distinct header keys matching any alias (Thane txn has two collection columns). */
function findAllColumns(headers, aliases) {
    const keys = [];
    for (const alias of aliases) {
        const normAlias = normalizeHeader(alias);
        const exact = headers.find((h) => h === normAlias);
        if (exact && !keys.includes(exact))
            keys.push(exact);
    }
    for (const alias of aliases) {
        const normAlias = normalizeHeader(alias);
        const fuzzy = headers.find((h) => fuzzyMatch(h, normAlias) && !keys.includes(h));
        if (fuzzy)
            keys.push(fuzzy);
    }
    return keys;
}
function sumNumericFields(objByHeader, keys) {
    if (!keys.length)
        return null;
    let sum = 0;
    let any = false;
    for (const key of keys) {
        const n = parseNumber(objByHeader[key]);
        if (n != null) {
            sum += n;
            any = true;
        }
    }
    return any ? sum : null;
}
function buildColumnMap(headers, aliases) {
    const col = {};
    for (const [field, fieldAliases] of Object.entries(aliases)) {
        col[field] = findColumn(headers, fieldAliases);
    }
    return col;
}
function scoreFileType(headers, fileType) {
    const col = buildColumnMap(headers, getAliasesForFileType(fileType));
    let score = 0;
    if (col.loanAccountNumber)
        score += 2;
    if (fileType === "balance") {
        if (col.closingBalance)
            score += 3;
        if (col.openingBalance)
            score += 1;
        if (col.dpd)
            score += 1;
        if (col.goldWeight)
            score += 1;
    }
    else if (fileType === "transaction") {
        if (col.transactionDate)
            score += 3;
        if (col.totalAmountReceived)
            score += 2;
        if (col.tranMode)
            score += 1;
        if (col.disbursedAmount)
            score += 1;
    }
    else if (fileType === "interest-extract") {
        if (col.interestRcvd)
            score += 2;
        if (col.transactionDate)
            score += 1;
        if (col.principalCr)
            score += 1;
    }
    return score;
}
function detectFileType(headers, titleHint) {
    const candidates = ["balance", "transaction", "interest-extract"];
    const scores = candidates.map((t) => ({ t, s: scoreFileType(headers, t) }));
    scores.sort((a, b) => b.s - a.s);
    if (titleHint && scores.some((x) => x.t === titleHint && x.s >= 3)) {
        return titleHint;
    }
    const best = scores[0];
    if (best && best.s >= 3)
        return best.t;
    return "unknown";
}
function parseDate(value) {
    if (value == null || value === "")
        return null;
    if (value instanceof Date && !Number.isNaN(value.getTime()))
        return value;
    const raw = String(value).trim();
    const m = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m) {
        const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
        return Number.isNaN(d.getTime()) ? null : d;
    }
    const iso = new Date(raw);
    return Number.isNaN(iso.getTime()) ? null : iso;
}
function parseNumber(value) {
    if (value == null || value === "")
        return null;
    const n = parseFloat(String(value).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : null;
}
function parseReportDate(rawTitleRows) {
    const title = rawTitleRows.join(" ");
    const between = title.match(/Between (\d{2}-\d{2}-\d{4}) and (\d{2}-\d{2}-\d{4})/i);
    if (between)
        return parseDate(between[2]);
    const fromTo = title.match(/From (\d{2}-\d{2}-\d{4}) To (\d{2}-\d{2}-\d{4})/i);
    if (fromTo)
        return parseDate(fromTo[2]);
    const asOn = title.match(/As on (\d{2}-\d{2}-\d{4})/i);
    if (asOn)
        return parseDate(asOn[1]);
    return null;
}
function toStringOrNull(v) {
    if (v == null)
        return null;
    const s = String(v).trim();
    return s || null;
}
function parseGoldLoanExcel(buffer, filename) {
    const errors = [];
    const wb = XLSX.read(buffer, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
    if (!matrix.length) {
        return {
            fileType: "unknown",
            reportDate: null,
            headers: [],
            originalHeaders: [],
            rows: [],
            rowCount: 0,
            errors: ["Empty worksheet"],
            overdueAccountNumbers: [],
        };
    }
    const headerRowIndex = detectHeaderRowIndex(matrix);
    const titleRows = matrix.slice(0, headerRowIndex).map((r) => (r ?? []).join(" "));
    const reportDate = parseReportDate(titleRows);
    const titleHint = detectFileTypeFromTitle(titleRows);
    const originalHeaders = (matrix[headerRowIndex] ?? []).map((c) => String(c ?? "").trim());
    const headers = originalHeaders.map(normalizeHeader);
    let fileType = detectFileType(headers, titleHint);
    const fieldAliases = getAliasesForFileType(fileType);
    const col = buildColumnMap(headers, fieldAliases);
    const collectionCols = fileType === "transaction"
        ? findAllColumns(headers, TRANSACTION_ALIASES.totalAmountReceived ?? [])
        : [];
    if (fileType === "unknown") {
        const seen = headers.filter(Boolean).slice(0, 25).join(", ");
        errors.push(`Cannot detect file type for "${filename ?? "file"}". ` +
            `Recognized columns: ${seen}. ` +
            `Expected: 'Account Num#' + 'Closing Balance' (balance), or 'TranDate' + 'Amount Received' (transaction), or interest columns (interest-extract).`);
    }
    const rows = [];
    for (let i = headerRowIndex + 1; i < matrix.length; i++) {
        const arr = matrix[i] ?? [];
        if (!arr.some((v) => v != null && String(v).trim() !== ""))
            continue;
        const objByHeader = {};
        headers.forEach((h, idx) => {
            objByHeader[h] = arr[idx] ?? null;
        });
        const read = (field) => {
            const key = col[field];
            return key ? objByHeader[key] : null;
        };
        const out = {};
        out.loanAccountNumber = toStringOrNull(read("loanAccountNumber"));
        out.customerId = toStringOrNull(read("customerId"));
        out.customerName = toStringOrNull(read("customerName"));
        out.branchName = toStringOrNull(read("branchName"));
        out.branchState = toStringOrNull(read("branchState"));
        out.branchRegion = toStringOrNull(read("branchRegion"));
        out.schemeName = toStringOrNull(read("schemeName"));
        out.schemeCode = toStringOrNull(read("schemeCode"));
        out.branchCode = toStringOrNull(read("branchCode"));
        out.inventoryNo = toStringOrNull(read("inventoryNo"));
        out.tranMode = toStringOrNull(read("tranMode"));
        out.isClosed = toStringOrNull(read("isClosed"));
        out.disbursementDate = parseDate(read("disbursementDate"));
        out.transactionDate = parseDate(read("transactionDate"));
        out.maturityDate = parseDate(read("maturityDate"));
        out.inventoryDate = parseDate(read("inventoryDate"));
        out.disbursedAmount = parseNumber(read("disbursedAmount"));
        out.openingBalance = parseNumber(read("openingBalance"));
        out.closingBalance = parseNumber(read("closingBalance"));
        out.principalCr = parseNumber(read("principalCr"));
        out.principalDr = parseNumber(read("principalDr"));
        out.interestRcvd = parseNumber(read("interestRcvd"));
        out.interestRcvDuring = parseNumber(read("interestRcvDuring"));
        out.interestRate = parseNumber(read("interestRate"));
        out.goldWeight = parseNumber(read("goldWeight"));
        out.grossWt = parseNumber(read("grossWt"));
        out.goldPurity = parseNumber(read("goldPurity"));
        out.presentRate = parseNumber(read("presentRate"));
        out.dpd = parseNumber(read("dpd"));
        out.totalOutstanding = parseNumber(read("totalOutstanding"));
        out.totalInterestDue = parseNumber(read("totalInterestDue"));
        out.totalAmountReceived =
            fileType === "transaction" && collectionCols.length
                ? sumNumericFields(objByHeader, collectionCols)
                : parseNumber(read("totalAmountReceived"));
        out.otherCharges = parseNumber(read("otherCharges"));
        out.loanPeriod = parseNumber(read("loanPeriod"));
        const pRcvd = parseNumber(read("principalCr"));
        const iRcvd = parseNumber(read("interestRcvd"));
        out.principalReceived = pRcvd;
        out.interestReceived = iRcvd;
        out.principalInterestReceived = (pRcvd ?? 0) + (iRcvd ?? 0);
        if (fileType !== "unknown")
            rows.push(out);
    }
    const overdueAccountNumbers = fileType === "balance"
        ? rows
            .filter((r) => (parseNumber(r.dpd) ?? 0) > 0)
            .map((r) => String(r.loanAccountNumber ?? "").trim())
            .filter(Boolean)
        : [];
    return {
        fileType,
        reportDate,
        headers,
        originalHeaders,
        rows,
        rowCount: rows.length,
        errors,
        overdueAccountNumbers,
    };
}
