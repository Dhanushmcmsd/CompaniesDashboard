import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDateRange } from "@/lib/gold-loan/period-utils";
import type { Period } from "@/context/PeriodContext";

function toCr(v: number) { return parseFloat((v / 1e7).toFixed(2)); }

export async function GET(req: NextRequest) {
  const period = (req.nextUrl.searchParams.get("period") ?? "MTD") as Period;
  const { from, to } = getDateRange(period);
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = period === "FTD"
    ? new Date(prevTo.getFullYear(), prevTo.getMonth(), prevTo.getDate(), 0, 0, 0, 0)
    : period === "MTD"
    ? new Date(prevTo.getFullYear(), prevTo.getMonth(), 1, 0, 0, 0, 0)
    : new Date(prevTo.getFullYear(), 0, 1, 0, 0, 0, 0);

  const goldRate = parseFloat(process.env.GOLD_RATE_PER_GRAM ?? "9240");
  const highValueThreshold = parseFloat(process.env.HIGH_VALUE_DISBURSEMENT_THRESHOLD ?? "5000000");

  try {
    const loans = await prisma.goldLoan.findMany({
      where: { updatedAt: { gte: from, lte: to }, status: { not: "CANCELLED" } },
      select: {
        closingBalance: true,
        disbursementAmount: true,
        goldWeight: true,
        dpd: true,
        branch: true,
        overdueBalance: true,
        collectedFromOverdue: true,
      },
    });

    const prevLoans = await prisma.goldLoan.findMany({
      where: { updatedAt: { gte: prevFrom, lte: prevTo }, status: { not: "CANCELLED" } },
      select: { closingBalance: true, dpd: true },
    });

    const highValue = loans.filter(l => (l.disbursementAmount ?? 0) > highValueThreshold);
    const ltvBreaches = loans.filter(l => (l.goldWeight ?? 0) > 0 && ((l.closingBalance ?? 0) / ((l.goldWeight ?? 0) * goldRate)) * 100 > 75);
    const goldMismatch = loans.filter(l => (l.goldWeight ?? 0) > 0 && (l.closingBalance ?? 0) > (l.goldWeight ?? 0) * goldRate);

    const branchMap = new Map<string, { collected: number; overdue: number }>();
    for (const l of loans) {
      const b = l.branch ?? "Unknown";
      const cur = branchMap.get(b) ?? { collected: 0, overdue: 0 };
      cur.collected += l.collectedFromOverdue ?? 0;
      cur.overdue += l.overdueBalance ?? 0;
      branchMap.set(b, cur);
    }
    const lowCollectionBranches = Array.from(branchMap.entries()).filter(([, v]) => v.overdue > 0 && (v.collected / v.overdue) * 100 < 75);

    const currentGnpa = loans.reduce((s, l) => s + (((l.dpd ?? 0) > 90) ? (l.closingBalance ?? 0) : 0), 0);
    const prevGnpa = prevLoans.reduce((s, l) => s + (((l.dpd ?? 0) > 90) ? (l.closingBalance ?? 0) : 0), 0);
    const npaSpikeCount = currentGnpa > prevGnpa ? 1 : 0;

    return NextResponse.json([
      {
        key: "high-value-disbursements",
        icon: "🔴",
        title: "High-value disbursements",
        count: highValue.length,
        amount: toCr(highValue.reduce((s, l) => s + (l.disbursementAmount ?? 0), 0)),
        severity: "red",
      },
      {
        key: "ltv-breaches",
        icon: "🔴",
        title: "LTV breaches (LTV > 75%)",
        count: ltvBreaches.length,
        amount: toCr(ltvBreaches.reduce((s, l) => s + (l.closingBalance ?? 0), 0)),
        severity: "red",
      },
      {
        key: "npa-spike",
        icon: "🟠",
        title: "NPA spikes (vs previous period)",
        count: npaSpikeCount,
        amount: toCr(Math.max(currentGnpa - prevGnpa, 0)),
        severity: "orange",
      },
      {
        key: "gold-mismatch",
        icon: "🟡",
        title: "Gold valuation mismatch",
        count: goldMismatch.length,
        amount: toCr(goldMismatch.reduce((s, l) => s + ((l.closingBalance ?? 0) - ((l.goldWeight ?? 0) * goldRate)), 0)),
        severity: "yellow",
        href: "#high-risk",
      },
      {
        key: "low-collection-branches",
        icon: "🟡",
        title: "Low collection efficiency branches",
        count: lowCollectionBranches.length,
        amount: toCr(lowCollectionBranches.reduce((s, [, v]) => s + v.overdue, 0)),
        severity: "yellow",
      },
    ]);
  } catch (err) {
    console.error("[alerts]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
