import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Return last 10 snapshots as a trend series
    const snaps = await prisma.goldLoanSnapshot.findMany({
      where:   { company: "supra" },
      orderBy: { snapshotDate: "asc" },
      take:    10,
      select:  { snapshotDate: true, newDisbursements: true, mtdDisbursements: true },
    });

    const trend = snaps.map((s: typeof snaps[number]) => ({
      date:  s.snapshotDate.toISOString().slice(0, 10),
      ftd:   s.newDisbursements,
      mtd:   s.mtdDisbursements,
    }));

    return NextResponse.json({ trend });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
