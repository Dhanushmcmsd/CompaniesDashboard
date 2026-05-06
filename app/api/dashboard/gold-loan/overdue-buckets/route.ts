import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDateRange } from "@/lib/gold-loan/period-utils";
import type { Period } from "@/context/PeriodContext";

type Bucket = "0-30" | "31-60" | "61-90" | "90+";

function getBucket(dpd: number): Bucket {
  if (dpd <= 30)  return "0-30";
  if (dpd <= 60)  return "31-60";
  if (dpd <= 90)  return "61-90";
  return "90+";
}

export async function GET(req: NextRequest) {
  const period = (req.nextUrl.searchParams.get("period") ?? "MTD") as Period;
  const { from, to } = getDateRange(period);

  try {
    // ── All loans with DPD > 0 in period ───────────────────────────────────────────
    const overdueLoans = await prisma.goldLoan.findMany({
      where: {
        updatedAt: { gte: from, lte: to },
        dpd: { gt: 0 },
      },
      select: {
        closingBalance:      true,
        dpd:                 true,
        collectedFromOverdue: true, // principal + interest recovered
        overdueBalance:       true,
      },
    });

    // ── Total AUM for % calculation (all active loans in period) ──────────────
    const allLoans = await prisma.goldLoan.aggregate({
      where: { updatedAt: { gte: from, lte: to }, status: { not: "CANCELLED" } },
      _sum: { closingBalance: true },
    });
    const totalAUM = (allLoans._sum.closingBalance ?? 0); // raw units

    // ── Group into buckets ─────────────────────────────────────────────────────────
    const bucketMap: Record<Bucket, number> = {
      "0-30":  0,
      "31-60": 0,
      "61-90": 0,
      "90+":   0,
    };

    let totalOverdueRaw   = 0;
    let totalCollectedRaw = 0;
    let totalOverdueBalanceRaw = 0;

    for (const loan of overdueLoans) {
      const dpd    = loan.dpd ?? 0;
      const bal    = loan.closingBalance ?? 0;
      const bucket = getBucket(dpd);
      bucketMap[bucket] += bal;
      totalOverdueRaw   += bal;
      totalCollectedRaw     += loan.collectedFromOverdue ?? 0;
      totalOverdueBalanceRaw += loan.overdueBalance ?? 0;
    }

    // ── Convert to ₹ Cr and compute percentages ────────────────────────────────
    const toCr = (v: number) => parseFloat((v / 1e7).toFixed(2));

    const totalOverdue = toCr(totalOverdueRaw);
    const totalAUMCr   = toCr(totalAUM);

    const buckets = (Object.entries(bucketMap) as [Bucket, number][]).map(
      ([bucket, raw]) => ({
        bucket,
        amount: toCr(raw),
        pct: totalAUM > 0 ? parseFloat(((raw / totalAUM) * 100).toFixed(2)) : 0,
      })
    );

    const overdueOfAUM = totalAUMCr > 0
      ? parseFloat(((totalOverdue / totalAUMCr) * 100).toFixed(2))
      : 0;

    const collectionEfficiency = totalOverdueBalanceRaw > 0
      ? parseFloat(((totalCollectedRaw / totalOverdueBalanceRaw) * 100).toFixed(2))
      : 100;

    return NextResponse.json({
      buckets,
      totalOverdue,
      overdueOfAUM,
      overdueCollected: toCr(totalCollectedRaw),
      collectionEfficiency,
    });
  } catch (err) {
    console.error("[overdue-buckets]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
