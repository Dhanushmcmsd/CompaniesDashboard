import { describe, expect, it } from "vitest";
import { findColumn, normalizeHeader } from "@/lib/gold-loan/excel-parser";

const MF_TXN_HEADERS = [
  "Branch Name",
  "Tran. Date",
  "Tran. ID",
  "Tran. Type",
  "Group A/c Number",
  "Sub A/c Number",
  "Customer ID",
  "Customer Name",
  "Principal Dr",
  "Principal Cr",
  "Interest Received Cr",
  "Total Rcvd",
  "Tran. Mode",
].map(normalizeHeader);

const MF_BAL_HEADERS = [
  "Branch Name",
  "Issue Date",
  "Group A/c Number",
  "Borrower #",
  "Sub A/c Number",
  "Customer Number",
  "Customer Name",
  "Rate Of Interest",
  "Disbursed Amount",
  "Prin. Closing Bal.",
  "Interest Rcvd for Period",
].map(normalizeHeader);

describe("MF production headers", () => {
  it("maps transaction Total Rcvd (not Amount Received)", () => {
    expect(findColumn(MF_TXN_HEADERS, ["total rcvd"])).toBe("total rcvd");
    expect(findColumn(MF_TXN_HEADERS, ["amount received"])).toBeNull();
  });

  it("maps Sub A/c Number and Tran. Date", () => {
    expect(findColumn(MF_TXN_HEADERS, ["sub a c number", "sub account number"])).toBe(
      "sub account number",
    );
    expect(findColumn(MF_TXN_HEADERS, ["tran date"])).toBe("tran date");
    expect(findColumn(MF_TXN_HEADERS, ["trandate"])).toBeNull();
  });

  it("maps balance Prin. Closing Bal. and Customer Number", () => {
    expect(findColumn(MF_BAL_HEADERS, ["prin closing bal"])).toBe("prin closing bal");
    expect(findColumn(MF_BAL_HEADERS, ["customer number"])).toBe("customer number");
    expect(findColumn(MF_BAL_HEADERS, ["sub a c number", "sub account number"])).toBe(
      "sub account number",
    );
  });
});
