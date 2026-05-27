import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeDailyDisbursementTrend } from "@/lib/gold-loan/dashboard-snapshot";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Prefer the per-day breakdown saved from the latest transaction statement.
    const latest = await prisma.goldLoanSnapshot.findFirst({
      where:   { company: "supra" },
      orderBy: { snapshotDate: "desc" },
      select:  {
        snapshotDate: true,
        dailyDisbursements: true,
        newDisbursements: true,
        mtdDisbursements: true,
      },
    });

    if (!latest) return NextResponse.json({ trend: [] });

    const dailyTrend = normalizeDailyDisbursementTrend(latest.dailyDisbursements);
    if (dailyTrend.length > 0) {
      return NextResponse.json({ trend: dailyTrend });
    }

    // Fallback: multi-snapshot series for data uploaded before daily breakdowns existed.
    const snaps = await prisma.goldLoanSnapshot.findMany({
      where:   { company: "supra" },
      orderBy: { snapshotDate: "asc" },
      take:    30,
      select:  { snapshotDate: true, newDisbursements: true, mtdDisbursements: true },
    });

    const trend = snaps.map((s) => ({
      date:  s.snapshotDate.toISOString().slice(0, 10),
      ftd:   s.newDisbursements,
      mtd:   s.mtdDisbursements,
    }));

    return NextResponse.json({ trend });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
