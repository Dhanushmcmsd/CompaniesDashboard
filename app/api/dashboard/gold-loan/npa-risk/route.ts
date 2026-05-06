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
      select: { closingBalance: true, dpd: true, provisionAmount: true },
    });

    const totalAUM = loans.reduce((s, l) => s + (l.closingBalance ?? 0), 0);
    const gnpaRaw = loans.filter(l => (l.dpd ?? 0) > 90).reduce((s, l) => s + (l.closingBalance ?? 0), 0);
    const provisionRaw = loans.reduce((s, l) => s + (l.provisionAmount ?? 0), 0);
    const nnpaRaw = Math.max(gnpaRaw - provisionRaw, 0);

    const sma0 = loans.filter(l => (l.dpd ?? 0) >= 1 && (l.dpd ?? 0) <= 30);
    const sma1 = loans.filter(l => (l.dpd ?? 0) >= 31 && (l.dpd ?? 0) <= 60);
    const sma2 = loans.filter(l => (l.dpd ?? 0) >= 61 && (l.dpd ?? 0) <= 90);

    return NextResponse.json({
      kpis: {
        gnpaAmount: toCr(gnpaRaw),
        gnpaPct: totalAUM > 0 ? parseFloat(((gnpaRaw / totalAUM) * 100).toFixed(2)) : 0,
        nnpaAmount: toCr(nnpaRaw),
        nnpaPct: totalAUM > 0 ? parseFloat(((nnpaRaw / totalAUM) * 100).toFixed(2)) : 0,
        sma0Count: sma0.length,
        sma0Amount: toCr(sma0.reduce((s, l) => s + (l.closingBalance ?? 0), 0)),
        sma1Count: sma1.length,
        sma1Amount: toCr(sma1.reduce((s, l) => s + (l.closingBalance ?? 0), 0)),
        sma2Count: sma2.length,
        sma2Amount: toCr(sma2.reduce((s, l) => s + (l.closingBalance ?? 0), 0)),
      },
      productMix: [
        { name: "Bullet", value: 42 },
        { name: "OD", value: 28 },
        { name: "Agri", value: 15 },
        { name: "Agri-J", value: 10 },
        { name: "Others", value: 5 },
      ],
    });
  } catch (err) {
    console.error("[npa-risk]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
