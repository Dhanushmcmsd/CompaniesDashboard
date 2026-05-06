import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDateRange } from "@/lib/gold-loan/period-utils";
import type { Period } from "@/context/PeriodContext";

function toCr(v: number) { return parseFloat((v / 1e7).toFixed(2)); }

export async function GET(req: NextRequest) {
  const period = (req.nextUrl.searchParams.get("period") ?? "MTD") as Period;
  const { from, to } = getDateRange(period);

  try {
    const loans = await prisma.goldLoan.findMany({
      where: { updatedAt: { gte: from, lte: to }, status: { not: "CANCELLED" } },
      select: {
        branch: true,
        closingBalance: true,
        disbursementAmount: true,
        disbursementTarget: true,
        collectedFromOverdue: true,
        overdueBalance: true,
        dpd: true,
        goldWeight: true,
      },
    });

    const map = new Map<string, {
      aum: number; disb: number; target: number; collected: number; overdue: number; npa: number; goldWeight: number; count: number;
    }>();

    for (const l of loans) {
      const b = l.branch ?? "Unknown";
      const cur = map.get(b) ?? { aum: 0, disb: 0, target: 0, collected: 0, overdue: 0, npa: 0, goldWeight: 0, count: 0 };
      cur.aum += l.closingBalance ?? 0;
      cur.disb += l.disbursementAmount ?? 0;
      cur.target += l.disbursementTarget ?? 0;
      cur.collected += l.collectedFromOverdue ?? 0;
      cur.overdue += l.overdueBalance ?? 0;
      cur.npa += (l.dpd ?? 0) > 90 ? (l.closingBalance ?? 0) : 0;
      cur.goldWeight += l.goldWeight ?? 0;
      cur.count += 1;
      map.set(b, cur);
    }

    const rows = Array.from(map.entries()).map(([branch, v]) => ({
      branch,
      aum: toCr(v.aum),
      disbursement: toCr(v.disb),
      target: toCr(v.target),
      vsTargetPct: v.target > 0 ? parseFloat(((v.disb / v.target) * 100).toFixed(2)) : 0,
      collectionEff: v.overdue > 0 ? parseFloat(((v.collected / v.overdue) * 100).toFixed(2)) : 100,
      npaPct: v.aum > 0 ? parseFloat(((v.npa / v.aum) * 100).toFixed(2)) : 0,
      avgGoldWeight: v.count > 0 ? parseFloat((v.goldWeight / v.count).toFixed(2)) : 0,
    }));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[branch-performance]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
