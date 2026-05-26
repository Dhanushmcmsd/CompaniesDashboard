import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveSnapshotWithMeta } from "@/lib/snapshotQuery";
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

    const resolved = await resolveSnapshotWithMeta(company, searchParams);
    const snap = resolved.snapshot;

    const trendSnaps = await prisma.goldLoanSnapshot.findMany({
      where: { company },
      orderBy: { snapshotDate: "asc" },
      take: 10,
      select: {
        snapshotDate: true,
        newDisbursements: true,
        mtdDisbursements: true,
      },
    });

    const snapshot = aggregateGoldLoanDashboard(snap, trendSnaps, {
      snapshotDate: resolved.snapshotDate,
      requestedPeriod: resolved.requestedPeriod,
      requestedDate: resolved.requestedDate,
      requestedMonth: resolved.requestedMonth,
      requestedYear: resolved.requestedYear,
      usedFallback: resolved.usedFallback,
      exactSnapshotFound: resolved.exactSnapshotFound,
    });

    console.log("[gold-loan snapshot]", {
      requestedPeriod: resolved.requestedPeriod,
      requestedDate: resolved.requestedDate,
      requestedMonth: resolved.requestedMonth,
      requestedYear: resolved.requestedYear,
      exactSnapshotFound: resolved.exactSnapshotFound,
      usedFallback: resolved.usedFallback,
      snapshotDate: resolved.snapshotDate,
      newDisbursements: snap?.newDisbursements ?? null,
      mtdDisbursements: snap?.mtdDisbursements ?? null,
    });

    return NextResponse.json({
      snapshot,
      snapshotDate: resolved.snapshotDate,
      requestedDate: resolved.requestedDate,
      requestedMonth: resolved.requestedMonth,
      requestedYear: resolved.requestedYear,
      requestedPeriod: resolved.requestedPeriod,
      usedFallback: resolved.usedFallback,
      exactSnapshotFound: resolved.exactSnapshotFound,
    }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: `Server error: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
