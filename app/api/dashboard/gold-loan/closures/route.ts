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

    if (!snap) return NextResponse.json({ closures: null });

    // Closure gold grams released = accounts with fullyReceived flag
    // Not available in snapshot by design — show total gold for context
    return NextResponse.json({
      totalGoldWeight:     snap.totalGoldWeight,
      avgGoldWeightPerLoan: snap.avgGoldWeightPerLoan,
      // Detailed closure data requires a dedicated Closed Loans report file
      closedGrams: null,
      note: "Upload a Closed Loans statement for detailed closure data",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
