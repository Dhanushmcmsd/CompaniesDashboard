import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDateRange } from "@/lib/gold-loan/period-utils";
import type { Period } from "@/context/PeriodContext";

export async function GET(req: NextRequest) {
  const period = (req.nextUrl.searchParams.get("period") ?? "MTD") as Period;
  const { from, to } = getDateRange(period);
  const goldRate = parseFloat(process.env.GOLD_RATE_PER_GRAM ?? "9240");

  try {
    const loans = await prisma.goldLoan.findMany({
      where: { updatedAt: { gte: from, lte: to }, status: { not: "CANCELLED" } },
      select: { closingBalance: true, goldWeight: true, loanStatus: true },
    });

    const valid = loans.filter(l => (l.goldWeight ?? 0) > 0);
    const ltvValues = valid.map(l => ((l.closingBalance ?? 0) / ((l.goldWeight ?? 0) * goldRate)) * 100);
    const avgLTV = ltvValues.length ? ltvValues.reduce((a, b) => a + b, 0) / ltvValues.length : 0;
    const avgLoanPerGram = valid.length ? valid.reduce((s, l) => s + ((l.closingBalance ?? 0) / (l.goldWeight ?? 1)), 0) / valid.length : 0;
    const totalGoldWeight = valid.reduce((s, l) => s + (l.goldWeight ?? 0), 0);
    const auctionCases = loans.filter(l => l.loanStatus === "AUCTION").length;

    return NextResponse.json({
      avgLTV: parseFloat(avgLTV.toFixed(2)),
      goldRate,
      avgLoanPerGram: parseFloat(avgLoanPerGram.toFixed(2)),
      totalGoldWeight: parseFloat(totalGoldWeight.toFixed(2)),
      auctionCases,
    });
  } catch (err) {
    console.error("[gold-ltv]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
