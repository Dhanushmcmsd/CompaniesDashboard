import { describe, expect, it } from "vitest";
import { normalizeDailyDisbursementTrend } from "./dashboard-snapshot";

describe("normalizeDailyDisbursementTrend", () => {
  it("maps transaction daily totals to chart-ready FTD and running MTD values", () => {
    expect(
      normalizeDailyDisbursementTrend([
        { date: "2026-04-02", totalDisbursed: 3, accountCount: 1 },
        { date: "2026-04-01", totalDisbursed: 2, accountCount: 1 },
      ]),
    ).toEqual([
      { date: "2026-04-01", ftd: 2, mtd: 2 },
      { date: "2026-04-02", ftd: 3, mtd: 5 },
    ]);
  });
});
