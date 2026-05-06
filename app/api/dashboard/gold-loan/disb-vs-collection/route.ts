import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDateRange } from "@/lib/gold-loan/period-utils";
import type { Period } from "@/context/PeriodContext";

export async function GET(req: NextRequest) {
  const period = (req.nextUrl.searchParams.get("period") ?? "MTD") as Period;
  const { from, to } = getDateRange(period);

  try {
    const records = await prisma.goldLoan.findMany({
      where: { updatedAt: { gte: from, lte: to } },
      select: { disbursementAmount: true, collectionAmount: true },
    });

    const totalDisb = records.reduce((s, r) => s + (r.disbursementAmount ?? 0), 0);
    const totalColl = records.reduce((s, r) => s + (r.collectionAmount ?? 0), 0);

    // Single grouped bar — one data point with both values
    const result = [
      {
        label: period,
        disbursement: parseFloat((totalDisb / 1e7).toFixed(2)),
        collection: parseFloat((totalColl / 1e7).toFixed(2)),
      },
    ];

    return NextResponse.json(result);
  } catch (err) {
    console.error("[disb-vs-collection]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
