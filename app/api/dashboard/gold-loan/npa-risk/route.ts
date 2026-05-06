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

    if (!snap) return NextResponse.json({ npa: null });

    const branchNPA = (snap.branchNPA ?? []) as { branch: string; gnpaAmount: number; gnpaPct: number }[];

    return NextResponse.json({
      npa: {
        gnpaAmount:   snap.gnpaAmount,
        gnpaPct:      snap.gnpaPct,
        nnpaPct:      snap.nnpaPct,
        auctionCases: snap.auctionCases,
        // SMA approximations from DPD buckets
        sma0: snap.bucket0to30,
        sma1: snap.bucket31to60,
        sma2: snap.bucket61to90,
        branchNPA,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
