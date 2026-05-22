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

    if (!snap) return NextResponse.json({ alerts: [] });

    const alerts: { type: string; severity: string; message: string; count: number }[] = [];

    if (snap.goldValueMismatch > 0) {
      alerts.push({
        type:     "gold-mismatch",
        severity: "high",
        message:  `${snap.goldValueMismatch} loan(s) where outstanding exceeds current gold value`,
        count:    snap.goldValueMismatch,
      });
    }
    if (snap.highLTVAccounts > 0) {
      alerts.push({
        type:     "high-ltv",
        severity: "medium",
        message:  `${snap.highLTVAccounts} account(s) with LTV above 85%`,
        count:    snap.highLTVAccounts,
      });
    }
    if (snap.gnpaPct > 2) {
      alerts.push({
        type:     "npa-spike",
        severity: "high",
        message:  `GNPA at ${snap.gnpaPct.toFixed(2)}% — above 2% threshold`,
        count:    snap.auctionCases,
      });
    }
    if (snap.collectionEfficiency != null && snap.collectionEfficiency < 80) {
      alerts.push({
        type:     "low-collection",
        severity: "medium",
        message:  `Collection efficiency at ${snap.collectionEfficiency.toFixed(1)}% — below 80% target`,
        count:    0,
      });
    }

    return NextResponse.json({ alerts, avgPresentRate: snap.avgPresentRate });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
