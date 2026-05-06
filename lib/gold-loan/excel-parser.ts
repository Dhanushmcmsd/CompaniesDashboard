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
};

const KEYWORDS = ["account", "customer", "balance", "disburs", "principal", "interest", "gold", "dpd", "branch"];

const FIELD_ALIASES: Record<string, string[]> = {
  // KEY FIX: 'Account Num#' normalizes to 'account num number' (with space before 'number')
  // Added 'account numnumber' as fallback for any old normalization behavior
  loanAccountNumber: [
    "account num number",
    "account numnumber",
    "account number",
    "loan account number",
    "account num",
  ],
  customerId: ["customer id", "customer code", "cust id"],
  customerName: ["customer name", "name"],
  branchName: ["branch name", "branch"],
  disbursementDate: ["disbursment date", "disbursement date", "disb date"],
  disbursedAmount: ["disbursed amount", "disbursement amount", "loan amount"],
  closingBalance: ["closing balance", "closing balance cr", "principal closing amount", "balance"],
  openingBalance: ["opening balance"],
  principalCr: ["principal cr", "principal received", "principal collection"],
  principalDr: ["principal dr"],
  interestRcvd: ["interest rcvd", "interest received", "total interest amount", "interest collection"],
  interestRcvDuring: ["interest rcvd during"],
  interestRate: ["total interest rate", "interest rate", "yield"],
  goldWeight: ["gold wt", "gold weight", "net gold weight"],
  grossWt: ["gross wt", "gross weight"],
  goldPurity: ["purity", "gold purity"],
  presentRate: ["present rate", "rate per gram", "gold rate"],
  dpd: ["dpd", "days past due", "days overdue"],
  schemeName: ["scheme name", "product", "loan product"],
  branchState: ["br state", "state"],
  branchRegion: ["br region", "region"],
  totalOutstanding: ["total outstanding", "loan outstanding"],
  totalInterestDue: ["total interest due"],
  maturityDate: ["maturity date"],
  inventoryDate: ["inventory date"],
  loanPeriod: ["loan period"],
  loanPeriodType: ["loan period type"],
  totalAmountReceived: ["total amount received", "total amount", "collection amount"],
  otherCharges: ["other charges", "other charges due"],
  transactionDate: ["transaction date", "date"],
};

const EXTRA_ALIASES: Record<string, string[]> = {
  schemeCode: ["scheme code"],
  branchCode: ["br code", "branch code"],
  inventoryNo: ["inventory no", "inventory number"],
};

/**
 * Normalize a raw Excel header cell value to a stable lowercase string.
 *
 * FIX (2026-05-06): Replace '#' with ' number' (space prefix) so that
 * 'Account Num#' becomes 'account num number' and correctly matches the
 * loanAccountNumber alias. Without the space it became 'account numnumber'.
 */
export function normalizeHeader(value: unknown): string {
  const text = String(value ?? "")
    .toLowerCase()
    .replace(/\r?\n/g, " ")
    .replace(/#/g, " number ")          // KEY FIX: space on both sides before collapsing
    .replace(/[^a-z0-9\s]/g, " ")       // remove remaining punctuation
    .replace(/\s+/g, " ")               // collapse all whitespace
    .trim();
  return text;
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
  // exact match first
  for (const alias of aliases) {
    const normAlias = normalizeHeader(alias);
    const exact = headers.find((h) => h === normAlias);
    if (exact) return exact;
  }
  // fuzzy match fallback
  for (const alias of aliases) {
    const normAlias = normalizeHeader(alias);
    const fuzzy = headers.find((h) => fuzzyMatch(h, normAlias));
    if (fuzzy) return fuzzy;
  }
  return null;
}

function parseDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const raw = String(value).trim();
  // DD-MM-YYYY
  const m = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // ISO and any other standard format
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
    };
  }

  const headerRowIndex = findBestHeaderRow(matrix);
  const titleRows = matrix.slice(0, headerRowIndex).map((r) => (r ?? []).join(" "));
  const reportDate = parseReportDate(titleRows);

  const originalHeaders = (matrix[headerRowIndex] ?? []).map((c) => String(c ?? "").trim());
  const headers = originalHeaders.map(normalizeHeader);

  const col: Record<string, string | null> = {};
  for (const [field, aliases] of Object.entries({ ...FIELD_ALIASES, ...EXTRA_ALIASES })) {
    col[field] = findColumn(headers, aliases);
  }

  // --- File type detection ---
  const hasAccount = Boolean(col.loanAccountNumber);
  const hasClosing = Boolean(col.closingBalance);
  const hasTxnDate = Boolean(col.transactionDate);
  const hasTotalAmt = Boolean(col.totalAmountReceived);
  const hasPrincipalCr = Boolean(col.principalCr);
  const hasInterest = Boolean(col.interestRcvd);

  let fileType: ParsedFileType = "unknown";
  if (hasAccount && hasClosing) {
    fileType = "balance";
  } else if (hasAccount && hasTxnDate && hasTotalAmt) {
    fileType = "transaction";
  } else if (hasAccount && (hasPrincipalCr || hasTotalAmt) && hasInterest) {
    fileType = "interest-extract";
  }

  if (fileType === "unknown") {
    const seen = headers.filter(Boolean).slice(0, 25).join(", ");
    errors.push(
      `Cannot detect file type for "${filename ?? "file"}". ` +
      `Recognized columns: ${seen}. ` +
      `Expected: 'Account Num#' + 'Closing Balance' (balance), or 'Transaction Date' + 'Total Amount Received' (transaction).`
    );
  }

  // --- Row parsing ---
  const rows: Record<string, unknown>[] = [];

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
    out.customerId        = toStringOrNull(read("customerId"));
    out.customerName      = toStringOrNull(read("customerName"));
    out.branchName        = toStringOrNull(read("branchName"));
    out.branchState       = toStringOrNull(read("branchState"));
    out.branchRegion      = toStringOrNull(read("branchRegion"));
    out.schemeName        = toStringOrNull(read("schemeName"));
    out.schemeCode        = toStringOrNull(read("schemeCode"));
    out.branchCode        = toStringOrNull(read("branchCode"));
    out.inventoryNo       = toStringOrNull(read("inventoryNo"));

    out.disbursementDate  = parseDate(read("disbursementDate"));
    out.transactionDate   = parseDate(read("transactionDate"));
    out.maturityDate      = parseDate(read("maturityDate"));
    out.inventoryDate     = parseDate(read("inventoryDate"));

    out.disbursedAmount   = parseNumber(read("disbursedAmount"));
    out.openingBalance    = parseNumber(read("openingBalance"));
    out.closingBalance    = parseNumber(read("closingBalance"));
    out.principalCr       = parseNumber(read("principalCr"));
    out.principalDr       = parseNumber(read("principalDr"));
    out.interestRcvd      = parseNumber(read("interestRcvd"));
    out.interestRcvDuring = parseNumber(read("interestRcvDuring"));
    out.interestRate      = parseNumber(read("interestRate"));
    out.goldWeight        = parseNumber(read("goldWeight"));
    out.grossWt           = parseNumber(read("grossWt"));
    out.goldPurity        = parseNumber(read("goldPurity"));
    out.presentRate       = parseNumber(read("presentRate"));
    out.dpd               = parseNumber(read("dpd"));
    out.totalOutstanding  = parseNumber(read("totalOutstanding"));
    out.totalInterestDue  = parseNumber(read("totalInterestDue"));
    out.totalAmountReceived = parseNumber(read("totalAmountReceived"));
    out.otherCharges      = parseNumber(read("otherCharges"));
    out.loanPeriod        = parseNumber(read("loanPeriod"));

    // Derived: principal + interest received (useful for collection efficiency)
    const pRcvd = parseNumber(read("principalCr"));
    const iRcvd = parseNumber(read("interestRcvd"));
    out.principalReceived = pRcvd;
    out.interestReceived  = iRcvd;
    out.principalInterestReceived = (pRcvd ?? 0) + (iRcvd ?? 0);

    if (fileType !== "unknown") rows.push(out);
  }

  return {
    fileType,
    reportDate,
    headers,
    originalHeaders,
    rows,
    rowCount: rows.length,
    errors,
  };
}
