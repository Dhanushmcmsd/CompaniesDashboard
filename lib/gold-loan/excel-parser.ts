import * as XLSX from "xlsx";

export type ParsedFileType = "balance" | "transaction" | "interest-extract" | "unknown";

export type ParsedGoldLoanExcel = {
  fileType: ParsedFileType;
  reportDate: Date | null;
  headers: string[];
  originalHeaders: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  errors: string[];
  warnings: string[];
  /** Populated for balance-sheet files: account numbers where DPD > 0.
   *  Used by the transaction-statement parser for overdue collection cross-reference. */
  overdueAccountNumbers: string[];
};

const KEYWORDS = ["account", "customer", "balance", "disburs", "principal", "interest", "gold", "dpd", "branch"];

/** Shared optional fields — merged into each file-type map at parse time. */
const SHARED_ALIASES: Record<string, string[]> = {
  branchState: ["br state", "br. state"],
  branchRegion: ["br region", "br. region"],
  otherCharges: ["other charges", "other charges due"],
  isClosed: ["closed", "loan closed", "is closed"],
};

/** FILE TYPE 1: Gold Loan Balance Statement (production headers). */
const BALANCE_ALIASES: Record<string, string[]> = {
  loanAccountNumber: [
    "account num#",
    "account num number",
    "account numnumber",
    "account number",
    "account no",
    "account no ",
    "loan account number",
    "loan account no",
    "acct no",
    "acct number",
    "account num",
  ],
  customerId: ["customer id", "customer number", "customer code", "cust id"],
  customerName: ["customer name", "name"],
  branchName: ["branch name", "branch"],
  branchCode: ["br. code", "br code", "branch code"],
  schemeName: ["scheme name", "loan type", "product", "loan product"],
  schemeCode: ["scheme code"],
  inventoryNo: ["inventory no", "inventory number"],
  disbursementDate: ["disbursment date", "disbursement date", "disb date", "disbursement dt"],
  disbursedAmount: ["disbursed amount", "disbursement amount", "loan amount"],
  closingBalance: [
    "closing balance",
    "closing balance cr",
    "principal closing amount",
    "outstanding balance",
    "outstanding amount",
    "loan outstanding",
    "current balance",
  ],
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
const TRANSACTION_ALIASES: Record<string, string[]> = {
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
  transactionDate: [
    "trandate",
    "tran date",
    "transaction date",
    "transaction dt",
    "txn date",
    "txndate",
  ],
  tranMode: ["tran mode", "transaction mode", "mode"],
  totalAmountReceived: [
    "amount received",
    "interest and other charges received",
  ],
};

/** FILE TYPE 3: Gold Loan Interest Extract. */
const INTEREST_EXTRACT_ALIASES: Record<string, string[]> = {
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

function mergeAliases(...maps: Record<string, string[]>[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const m of maps) {
    for (const [k, v] of Object.entries(m)) {
      out[k] = [...(out[k] ?? []), ...v];
    }
  }
  return out;
}

export function getAliasesForFileType(fileType: ParsedFileType): Record<string, string[]> {
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
export function normalizeHeader(value: unknown): string {
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
export function detectHeaderRowIndex(matrix: unknown[][]): number {
  const row0Text = (matrix[0] ?? []).map((c) => String(c ?? "")).join(" ").toLowerCase();

  if (/balance statement between/i.test(row0Text)) return 1;
  if (/transactions during period/i.test(row0Text)) return 1;
  if (/interest extract between/i.test(row0Text)) return 1;
  if (/\bgroup\b/i.test(row0Text) && /loan|balance|transaction|closed/i.test(row0Text)) return 1;

  const row0Norm = normalizeHeader(matrix[0]?.[0]);
  const row1Norm = normalizeHeader(matrix[1]?.[0]);
  if (row0Norm.length < 3 && row1Norm === "branch name") return 1;

  return findBestHeaderRow(matrix);
}

function detectFileTypeFromTitle(titleRows: string[]): ParsedFileType | null {
  const title = titleRows.join(" ").toLowerCase();
  if (/balance statement between/i.test(title)) return "balance";
  if (/transactions during period/i.test(title)) return "transaction";
  if (/interest extract between/i.test(title)) return "interest-extract";
  return null;
}

function findBestHeaderRow(rows: unknown[][]): number {
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

function fuzzyMatch(header: string, alias: string): boolean {
  return header.includes(alias) || alias.includes(header);
}

export function findColumn(headers: string[], aliases: string[]): string | null {
  for (const alias of aliases) {
    const normAlias = normalizeHeader(alias);
    const exact = headers.find((h) => h === normAlias);
    if (exact) return exact;
  }
  for (const alias of aliases) {
    const normAlias = normalizeHeader(alias);
    const fuzzy = headers.find((h) => fuzzyMatch(h, normAlias));
    if (fuzzy) return fuzzy;
  }
  return null;
}

/** All distinct header keys matching any alias (Thane txn has two collection columns). */
export function findAllColumns(headers: string[], aliases: string[]): string[] {
  const keys: string[] = [];
  for (const alias of aliases) {
    const normAlias = normalizeHeader(alias);
    const exact = headers.find((h) => h === normAlias);
    if (exact && !keys.includes(exact)) keys.push(exact);
  }
  for (const alias of aliases) {
    const normAlias = normalizeHeader(alias);
    const fuzzy = headers.find((h) => fuzzyMatch(h, normAlias) && !keys.includes(h));
    if (fuzzy) keys.push(fuzzy);
  }
  return keys;
}

function sumNumericFields(
  objByHeader: Record<string, unknown>,
  keys: string[],
): number | null {
  if (!keys.length) return null;
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

function buildColumnMap(headers: string[], aliases: Record<string, string[]>): Record<string, string | null> {
  const col: Record<string, string | null> = {};
  for (const [field, fieldAliases] of Object.entries(aliases)) {
    col[field] = findColumn(headers, fieldAliases);
  }
  return col;
}

function scoreFileType(headers: string[], fileType: ParsedFileType): number {
  const col = buildColumnMap(headers, getAliasesForFileType(fileType));
  let score = 0;

  if (col.loanAccountNumber) score += 2;

  if (fileType === "balance") {
    if (col.closingBalance) score += 3;
    if (col.openingBalance) score += 1;
    if (col.dpd) score += 1;
    if (col.goldWeight) score += 1;
  } else if (fileType === "transaction") {
    if (col.transactionDate) score += 3;
    if (col.totalAmountReceived) score += 2;
    if (col.tranMode) score += 1;
    if (col.disbursedAmount) score += 1;
  } else if (fileType === "interest-extract") {
    if (col.interestRcvd) score += 2;
    if (col.transactionDate) score += 1;
    if (col.principalCr) score += 1;
  }

  return score;
}

function detectFileType(headers: string[], titleHint: ParsedFileType | null): ParsedFileType {
  const candidates: ParsedFileType[] = ["balance", "transaction", "interest-extract"];
  const scores = candidates.map((t) => ({ t, s: scoreFileType(headers, t) }));
  scores.sort((a, b) => b.s - a.s);

  if (titleHint && scores.some((x) => x.t === titleHint && x.s >= 3)) {
    return titleHint;
  }

  const best = scores[0];
  if (best && best.s >= 3) return best.t;
  return "unknown";
}

function parseDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const raw = String(value).trim();
  const m = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = new Date(raw);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function parseNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseReportDate(rawTitleRows: string[]): Date | null {
  const title = rawTitleRows.join(" ");
  const between = title.match(/Between (\d{2}-\d{2}-\d{4}) and (\d{2}-\d{2}-\d{4})/i);
  if (between) return parseDate(between[2]);
  const fromTo = title.match(/From (\d{2}-\d{2}-\d{4}) To (\d{2}-\d{2}-\d{4})/i);
  if (fromTo) return parseDate(fromTo[2]);
  const asOn = title.match(/As on (\d{2}-\d{2}-\d{4})/i);
  if (asOn) return parseDate(asOn[1]);
  return null;
}

function toStringOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

export function parseGoldLoanExcel(buffer: ArrayBuffer, filename?: string): ParsedGoldLoanExcel {
  const errors: string[] = [];
  const warnings: string[] = [];
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: false });

  if (!matrix.length) {
    return {
      fileType: "unknown",
      reportDate: null,
      headers: [],
      originalHeaders: [],
      rows: [],
      rowCount: 0,
      errors: ["Empty worksheet"],
      warnings: [],
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
  const collectionCols =
    fileType === "transaction"
      ? findAllColumns(headers, TRANSACTION_ALIASES.totalAmountReceived ?? [])
      : [];

  if (fileType === "unknown") {
    const seen = headers.filter(Boolean).slice(0, 25).join(", ");
    errors.push(
      `Cannot detect file type for "${filename ?? "file"}". ` +
        `Recognized columns: ${seen}. ` +
        `Expected: 'Account Num#' + 'Closing Balance' (balance), or 'TranDate' + 'Amount Received' (transaction), or interest columns (interest-extract).`,
    );
  }

  const rows: Record<string, unknown>[] = [];

  function rowValidationIssue(out: Record<string, unknown>, fileType: ParsedFileType): string | null {
    const account = toStringOrNull(out.loanAccountNumber);
    const hasAmount = out.totalAmountReceived != null || out.principalCr != null || out.interestRcvd != null || out.disbursedAmount != null || out.principalDr != null;

    if (fileType === "balance") {
      if (!account) return "missing loan account number";
      if (out.closingBalance == null) return "missing closing balance / outstanding amount";
    }
    if (fileType === "transaction") {
      if (!account) return "missing loan account number";
      if (!(out.transactionDate instanceof Date)) return "missing transaction date";
      if (!hasAmount) return "missing amount data (disbursement or collection)";
    }
    if (fileType === "interest-extract") {
      if (!account) return "missing loan account number";
      if (!hasAmount) return "missing principal/interest amount";
    }
    return null;
  }

  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const arr = matrix[i] ?? [];
    if (!arr.some((v) => v != null && String(v).trim() !== "")) continue;

    const objByHeader: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      objByHeader[h] = arr[idx] ?? null;
    });

    const read = (field: string) => {
      const key = col[field];
      return key ? objByHeader[key] : null;
    };

    const out: Record<string, unknown> = {};

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

    const validationIssue = fileType !== "unknown" ? rowValidationIssue(out, fileType) : null;
    if (validationIssue) {
      warnings.push(`Row ${i + 1}: ${validationIssue}. Row skipped.`);
    } else if (fileType !== "unknown") {
      rows.push(out);
    }
  }

  const overdueAccountNumbers: string[] =
    fileType === "balance"
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
    warnings,
    overdueAccountNumbers,
  };
}
