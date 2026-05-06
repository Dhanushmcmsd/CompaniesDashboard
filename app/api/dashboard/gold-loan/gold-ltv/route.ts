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

    if (!snap) return NextResponse.json({ goldLtv: null });

    return NextResponse.json({
      goldLtv: {
        avgLTV:              snap.avgLTV,
        avgPresentRate:      snap.avgPresentRate,
        avgGoldValuePerLoan: snap.avgGoldValuePerLoan,
        totalGoldWeight:     snap.totalGoldWeight,
        avgGoldWeightPerLoan: snap.avgGoldWeightPerLoan,
        auctionCases:        snap.auctionCases,
        highLTVAccounts:     snap.highLTVAccounts,
        goldValueMismatch:   snap.goldValueMismatch,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
