import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/dashboard/gold-loan/snapshot
 * Returns the latest KPI snapshot for the management dashboard.
 * Optionally filter by ?company=supra
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company") ?? "supra";

    const snapshot = await prisma.goldLoanSnapshot.findFirst({
      where:   { company },
      orderBy: { createdAt: "desc" },
    });

    if (!snapshot) {
      return NextResponse.json({ snapshot: null }, { status: 200 });
    }

    return NextResponse.json({ snapshot }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: `Server error: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
