import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const snap = await prisma.goldLoanSnapshot.findFirst({
      where: { company: "supra" },
      orderBy: { createdAt: "desc" },
    });

    if (!snap) return NextResponse.json({ kpis: null });

    return NextResponse.json({
      kpis: {
        totalAUM:             snap.totalAUM,
        totalAccounts:        snap.totalAccounts,
        totalCustomers:       snap.totalCustomers,
        avgTicketSize:        snap.avgTicketSize,
        avgYield:             snap.avgYield,
        gnpaPct:              snap.gnpaPct,
        nnpaPct:              snap.nnpaPct,
        collectionEfficiency: snap.collectionEfficiency,
        avgLTV:               snap.avgLTV,
        totalGoldWeight:      snap.totalGoldWeight,
        avgPresentRate:       snap.avgPresentRate,
        avgGoldValuePerLoan:  snap.avgGoldValuePerLoan,
        newDisbursements:     snap.newDisbursements,
        mtdDisbursements:     snap.mtdDisbursements,
        ytdDisbursements:     snap.ytdDisbursements,
        reportDate:           snap.reportDate,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
