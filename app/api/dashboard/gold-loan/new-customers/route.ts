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

    if (!snap) return NextResponse.json({ newCustomers: 0, totalCustomers: 0 });

    // New customers = accounts with disbursement today (FTD)
    // Approximated from newDisbursements > 0 indicator in snapshot
    return NextResponse.json({
      totalCustomers: snap.totalCustomers,
      totalAccounts:  snap.totalAccounts,
      // Row-level new customer detail requires balance file re-upload
      newCustomers:   snap.newDisbursements > 0 ? "See FTD disbursement" : 0,
      mtdDisbursements: snap.mtdDisbursements,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
