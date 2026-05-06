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

    if (!snap) return NextResponse.json({ highRisk: null, goldRate: 0, accounts: [] });

    return NextResponse.json({
      goldRate:         snap.avgPresentRate,
      highRiskCount:    snap.goldValueMismatch,
      highLTVCount:     snap.highLTVAccounts,
      // Row-level high-risk detail not available from snapshot (by design)
      // Management sees counts + can request full list from employee
      accounts: [],
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
