import { describe, expect, it } from "vitest";
import { calculateKPIs } from "./calculator";
import { calculateTransactionKPIs } from "./transaction-calculator";

describe("calculateKPIs", () => {
  it("counts balance-sheet FTD disbursement when disbursementDate is a string", () => {
    const asOnDate = new Date(Date.UTC(2026, 3, 30));
    const kpis = calculateKPIs(
      [
        {
          loanAccountNumber: "A1",
          customerId: "C1",
          disbursementDate: "30/04/2026",
          disbursedAmount: 100,
          closingBalance: 100,
        },
        {
          loanAccountNumber: "A2",
          customerId: "C2",
          disbursementDate: "2026-04-29",
          disbursedAmount: 50,
          closingBalance: 50,
        },
      ],
      [],
      asOnDate,
    );

    expect(kpis.newDisbursements).toBe(100);
    expect(kpis.calendarMonthDisbursements).toBe(150);
    expect(kpis.mtdDisbursements).toBe(150);
  });
});

describe("calculateTransactionKPIs", () => {
  it("treats A, J, and G modes as disbursements and keeps J credits out of collections", () => {
    const asOnDate = new Date(Date.UTC(2026, 3, 30));
    const kpis = calculateTransactionKPIs(
      [
        {
          loanAccountNumber: "A1",
          branchName: "B1",
          tranMode: "A",
          transactionDate: asOnDate,
          principalDr: 100,
        },
        {
          loanAccountNumber: "J1",
          branchName: "B1",
          tranMode: "J",
          transactionDate: asOnDate,
          principalDr: 25,
          principalCr: 25,
        },
        {
          loanAccountNumber: "G1",
          branchName: "B2",
          tranMode: "G",
          transactionDate: asOnDate,
          principalDr: 10,
        },
        {
          loanAccountNumber: "C1",
          branchName: "B2",
          tranMode: "C",
          transactionDate: asOnDate,
          principalCr: 5,
          totalAmountReceived: 5,
        },
      ],
      [],
      0,
      asOnDate,
    );

    expect(kpis.disbursementTransactions).toBe(3);
    expect(kpis.ftdDisbursement).toBe(135);
    expect(kpis.calendarMonthDisbursement).toBe(135);
    expect(kpis.collectionTransactions).toBe(1);
    expect(kpis.principalCollected).toBe(5);
  });
});
