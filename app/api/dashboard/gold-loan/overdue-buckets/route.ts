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

    if (!snap) return NextResponse.json({ buckets: [] });

    const totalAUM = snap.totalAUM || 1;
    return NextResponse.json({
      buckets: [
        { label: "0–30 Days",  amount: snap.bucket0to30,  pct: (snap.bucket0to30  / totalAUM) * 100 },
        { label: "31–60 Days", amount: snap.bucket31to60, pct: (snap.bucket31to60 / totalAUM) * 100 },
        { label: "61–90 Days", amount: snap.bucket61to90, pct: (snap.bucket61to90 / totalAUM) * 100 },
        { label: "90+ Days",   amount: snap.bucket90plus, pct: (snap.bucket90plus / totalAUM) * 100 },
      ],
      totalOverdue:         snap.totalOverdue,
      overduePercent:       snap.overduePercent,
      overdueCollection:    snap.overdueCollection,
      collectionEfficiency: snap.collectionEfficiency,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
