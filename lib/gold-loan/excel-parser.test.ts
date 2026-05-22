import { describe, expect, it } from "vitest";
import {
  findAllColumns,
  findColumn,
  getAliasesForFileType,
  normalizeHeader,
} from "./excel-parser";

const PRODUCTION_HEADERS = {
  goldBalance: [
    "Scheme Code",
    "Scheme Name",
    "Inventory No",
    "Branch Name",
    "Br. Code",
    "Account Num#",
    "Customer ID",
    "Customer Name",
    "Disbursment Date",
    "Disbursed Amount",
    "Opening Balance",
    "Principal Dr.",
    "Principal Cr.",
    "Closing Balance",
    "Interest Rcvd",
    "Gold Wt.",
    "Gross Wt.",
    "Purity",
    "Total Outstanding",
    "Total Interest Rate",
    "Present Rate",
    "DPD",
    "Maturity Date",
  ],
  goldTransaction: [
    "Issue Date",
    "Branch Name",
    "BR. Code",
    "Loan Type",
    "Inventory Number",
    "Account Number",
    "Customer Number",
    "Name",
    "Issue Amount",
    "Principal Debit",
    "Principal Credit",
    "TranDate",
    "Rate Of Interest",
    "Tot. Intr. Amount",
    "Amount Received",
    "Tran Mode",
  ],
  goldTransactionThane: [
    "Amount Received",
    "Interest and other charges received",
    "Interest Received Upto",
  ],
  mfBalance: [
    "Branch Name",
    "Issue Date",
    "Scheme Code",
    "Group A/c Number",
    "Borrower #",
    "Sub A/c Number",
    "Customer Number",
    "Customer Name",
    "Rate Of Interest",
    "Disbursed Amount",
    "Prin. Opening Bal.",
    "Prin Dr. for Period",
    "Prin Cr. for Period",
    "Prin. Closing Bal.",
    "Interest Rcvd for Period",
  ],
  mfTransaction: [
    "Branch Name",
    "Tran. Date",
    "Tran. ID",
    "Tran. Type",
    "Group A/c Number",
    "Sub A/c Number",
    "Customer ID",
    "Principal Dr",
    "Principal Cr",
    "Interest Received Cr",
    "Total Rcvd",
    "Tran. Mode",
  ],
};

function normHeaders(raw: string[]): string[] {
  return raw.map(normalizeHeader);
}

describe("normalizeHeader", () => {
  it("maps production spellings", () => {
    expect(normalizeHeader("Account Num#")).toBe("account num number");
    expect(normalizeHeader("Disbursment Date")).toBe("disbursment date");
    expect(normalizeHeader("TranDate")).toBe("trandate");
    expect(normalizeHeader("Tot. Intr. Amount")).toBe("tot intr amount");
    expect(normalizeHeader("BR. Code")).toBe("br code");
    expect(normalizeHeader("Amount Received")).toBe("amount received");
    expect(normalizeHeader("Prin. Closing Bal.")).toBe("prin closing bal");
    expect(normalizeHeader("Total Rcvd")).toBe("total rcvd");
    expect(normalizeHeader("Tran. Date")).toBe("tran date");
    expect(normalizeHeader("Interest and other charges received")).toBe(
      "interest and other charges received",
    );
  });
});

describe("findColumn — gold balance", () => {
  const headers = normHeaders(PRODUCTION_HEADERS.goldBalance);
  const aliases = getAliasesForFileType("balance");

  it("resolves core balance columns", () => {
    expect(findColumn(headers, aliases.loanAccountNumber)).toBe("account num number");
    expect(findColumn(headers, aliases.disbursementDate)).toBe("disbursment date");
    expect(findColumn(headers, aliases.disbursedAmount)).toBe("disbursed amount");
    expect(findColumn(headers, aliases.closingBalance)).toBe("closing balance");
    expect(findColumn(headers, aliases.principalDr)).toBe("principal dr");
    expect(findColumn(headers, aliases.principalCr)).toBe("principal cr");
    expect(findColumn(headers, aliases.interestRcvd)).toBe("interest rcvd");
    expect(findColumn(headers, aliases.goldWeight)).toBe("gold wt");
    expect(findColumn(headers, aliases.presentRate)).toBe("present rate");
    expect(findColumn(headers, aliases.dpd)).toBe("dpd");
  });
});

describe("findColumn — gold transaction", () => {
  const headers = normHeaders(PRODUCTION_HEADERS.goldTransaction);
  const aliases = getAliasesForFileType("transaction");

  it("resolves transaction columns", () => {
    expect(findColumn(headers, aliases.loanAccountNumber)).toBe("account number");
    expect(findColumn(headers, aliases.disbursementDate)).toBe("issue date");
    expect(findColumn(headers, aliases.disbursedAmount)).toBe("issue amount");
    expect(findColumn(headers, aliases.transactionDate)).toBe("trandate");
    expect(findColumn(headers, aliases.totalAmountReceived)).toBe("amount received");
    expect(findColumn(headers, aliases.principalDr)).toBe("principal debit");
    expect(findColumn(headers, aliases.interestRcvd)).toBe("tot intr amount");
    expect(findColumn(headers, aliases.tranMode)).toBe("tran mode");
  });

  it("does not map totalAmountReceived to generic amount columns", () => {
    const generic = normHeaders(["Dr Amount", "Net Amount", "Payment Amount"]);
    expect(findColumn(generic, aliases.totalAmountReceived)).toBeNull();
  });
});

describe("findColumn — gold transaction Thane variant", () => {
  it("maps both collection columns for Thane exports", () => {
    const headers = normHeaders(PRODUCTION_HEADERS.goldTransactionThane);
    const aliases = getAliasesForFileType("transaction");
    const cols = findAllColumns(headers, aliases.totalAmountReceived);
    expect(cols).toContain("amount received");
    expect(cols).toContain("interest and other charges received");
  });
});
