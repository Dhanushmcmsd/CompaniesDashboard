import * as XLSX from "xlsx";

type Parsed = {
  fileType: string;
  reportDate: Date | null;
  headers: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  errors: string[];
};

function cleanHeader(v: unknown): string {
  return String(v ?? "").trim();
}

function parseNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function parseDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  const s = String(v).trim();
  const ddmmyyyy = /^(\d{2})-(\d{2})-(\d{4})$/;
  if (ddmmyyyy.test(s)) {
    const [, dd, mm, yyyy] = s.match(ddmmyyyy)!;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function extractReportDate(title: string): Date | null {
  const between = title.match(/Between (\d{2}-\d{2}-\d{4}) and (\d{2}-\d{2}-\d{4})/i);
  if (between) return parseDate(between[2]);
  const asOn = title.match(/As on (\d{2}-\d{2}-\d{4})/i);
  if (asOn) return parseDate(asOn[1]);
  return null;
}

const BALANCE_MAP: Record<string, string> = {
  "Scheme Code": "schemeCode",
  "Scheme Name": "schemeName",
  "Inventory No": "inventoryNo",
  "Branch Name": "branchName",
  "Br. Code": "branchCode",
  "Br. State": "branchState",
  "Br. Region": "branchRegion",
  "Account Num#": "loanAccountNumber",
  "Customer ID": "customerId",
  "Customer Name": "customerName",
  "Disbursment Date": "disbursementDate",
  "Disbursed Amount": "disbursedAmount",
  "Opening Balance": "openingBalance",
  "Principal Dr.": "principalDr",
  "Principal Cr.": "principalCr",
  "Closing Balance": "closingBalance",
  "Fully Received": "fullyReceived",
  "Partial Prin.Rcvd.": "partialPrinRcvd",
  "Bal. Prin.Rcvd.": "balPrinRcvd",
  "Interest Rcvd": "interestRcvd",
  "Interest Rcvd During": "interestRcvDuring",
  "Other Charges Due": "otherChargesDue",
  "Gross Wt.": "grossWt",
  Deductions: "deductions",
  "Gold Wt.": "goldWeight",
  Purity: "goldPurity",
  "Interest Collected Upto": "intCollectedUpto",
  "Base Interest Due": "baseInterestDue",
  "Other1 Due": "other1Due",
  "Other2 Due": "other2Due",
  "Other3 Due": "other3Due",
  "Total Interest Due": "totalInterestDue",
  "Total Outstanding": "totalOutstanding",
  "Total Interest Rate": "interestRate",
  "Notice Letter Status": "noticeLetter",
  "Present Rate": "presentRate",
  "Loan Period": "loanPeriod",
  "Loan Period Type": "loanPeriodType",
  "Reference #": "referenceNo",
  "Inventory Date": "inventoryDate",
  "Is Online Registered": "isOnline",
  "Loan Availed Days": "loanAvailedDays",
  "Days Post Intr.Upto": "daysPostIntr",
  "Maturity Date": "maturityDate",
  "Balance Days To Mature": "balDaysToMature",
  "Is Locked": "isLocked",
  "Locked By": "lockedBy",
  "Marketing Executive Code": "mktExecCode",
  "Marketing Executive": "mktExec",
  "Relationship Executive Code": "relExecCode",
  "Relationship Executive": "relExec",
  "Collection Executive Code": "collExecCode",
  "Collection Executive": "collExec",
  DPD: "dpd",
  "Discount Amt": "discountAmt",
  "Renewed From A/c Num#": "renewedFrom",
};

const TRANSACTION_MAP: Record<string, string> = {
  "Account Num#": "loanAccountNumber",
  "Transaction Date": "transactionDate",
  "Principal Received": "principalReceived",
  "Interest Received": "interestReceived",
  "Other Charges": "otherCharges",
  "Total Amount Received": "totalAmountReceived",
};

const INTEREST_EXTRACT_MAP: Record<string, string> = {
  "Account Num#": "loanAccountNumber",
  "Transaction Date": "transactionDate",
  "Principal Cr.": "principalReceived",
  "Total Interest Amount": "interestReceived",
  "Total Amount": "totalAmountReceived",
};

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k.toLowerCase().includes("date") || k === "intCollectedUpto") out[k] = parseDate(v);
    else if (
      [
        "openingBalance", "principalDr", "disbursedAmount", "principalCr", "closingBalance", "partialPrinRcvd", "balPrinRcvd",
        "interestRcvd", "interestRcvDuring", "otherChargesDue", "grossWt", "deductions", "goldWeight", "goldPurity", "baseInterestDue",
        "other1Due", "other2Due", "other3Due", "totalInterestDue", "totalOutstanding", "interestRate", "presentRate", "loanPeriod",
        "loanAvailedDays", "daysPostIntr", "balDaysToMature", "dpd", "discountAmt", "principalReceived", "interestReceived", "otherCharges", "totalAmountReceived"
      ].includes(k)
    ) out[k] = parseNumber(v);
    else out[k] = parseString(v);
  }
  return out;
}

export function parseGoldLoanExcel(buffer: ArrayBuffer): Parsed {
  const errors: string[] = [];
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(firstSheet, { header: 1, defval: null });

  const title = (matrix[0] ?? []).join(" ");
  const reportDate = extractReportDate(title);

  const headers = ((matrix[1] ?? []) as unknown[]).map(cleanHeader).filter(Boolean);

  const has = (h: string) => headers.includes(h);
  let fileType = "unknown";
  let map: Record<string, string> = {};

  if (has("Account Num#") && has("Closing Balance") && has("DPD")) {
    fileType = "balance";
    map = BALANCE_MAP;
  } else if (has("Account Num#") && has("Total Amount Received")) {
    fileType = "transaction";
    map = TRANSACTION_MAP;
  } else if (has("Account Num#") && has("Total Interest Amount")) {
    fileType = "interest-extract";
    map = INTEREST_EXTRACT_MAP;
  } else {
    errors.push("Unknown file type: required headers not found.");
  }

  const rows: Record<string, unknown>[] = [];
  for (let i = 2; i < matrix.length; i++) {
    const rowArr = matrix[i] ?? [];
    if (!rowArr.some((v) => v !== null && v !== "")) continue;
    const raw: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      raw[h] = rowArr[idx] ?? null;
    });

    const mapped: Record<string, unknown> = {};
    for (const [source, target] of Object.entries(map)) {
      if (source in raw) mapped[target] = raw[source];
    }

    const normalized = normalizeRow(mapped);
    if (normalized.principalReceived !== undefined || normalized.interestReceived !== undefined) {
      const pr = (normalized.principalReceived as number | null) ?? 0;
      const ir = (normalized.interestReceived as number | null) ?? 0;
      normalized.principalInterestReceived = pr + ir;
      if (normalized.totalAmountReceived == null) {
        const oc = (normalized.otherCharges as number | null) ?? 0;
        normalized.totalAmountReceived = pr + ir + oc;
      }
    }

    rows.push(normalized);
  }

  return {
    fileType,
    reportDate,
    headers,
    rows,
    rowCount: rows.length,
    errors,
  };
}
