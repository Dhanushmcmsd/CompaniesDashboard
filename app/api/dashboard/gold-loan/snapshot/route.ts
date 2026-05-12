import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveSnapshot } from "@/lib/snapshotQuery";
import { aggregateGoldLoanDashboard } from "@/lib/gold-loan/dashboard-snapshot";

/**
 * GET /api/dashboard/gold-loan/snapshot?period=FTD|MTD|YTD[&date|month|year=…]
 *
 * Single payload for the gold-loan dashboard (replaces many parallel fetches).
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company") ?? "supra";

    const snap = await resolveSnapshot(company, searchParams);

    const trendSnaps = await prisma.goldLoanSnapshot.findMany({
      where: { company },
      orderBy: { createdAt: "asc" },
      take: 10,
      select: {
        reportDate: true,
        newDisbursements: true,
        mtdDisbursements: true,
        createdAt: true,
      },
    });

    const snapshot = aggregateGoldLoanDashboard(snap, trendSnaps);

    return NextResponse.json({ snapshot }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: `Server error: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
