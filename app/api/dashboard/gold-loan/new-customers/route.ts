import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDateRange } from "@/lib/gold-loan/period-utils";
import type { Period } from "@/context/PeriodContext";

export async function GET(req: NextRequest) {
  const period = (req.nextUrl.searchParams.get("period") ?? "MTD") as Period;
  const { from, to } = getDateRange(period);

  try {
    // All loans disbursed in period (first-time customers = new)
    const loans = await prisma.goldLoan.findMany({
      where: { disbursementDate: { gte: from, lte: to } },
      select: {
        customerId:         true,
        branch:             true,
        disbursementAmount: true,
      },
    });

    // Identify customers who have NO loan before 'from' (i.e. truly new)
    const customerIds = [...new Set(loans.map(l => l.customerId))];
    const existingBefore = await prisma.goldLoan.findMany({
      where: {
        customerId: { in: customerIds },
        disbursementDate: { lt: from },
      },
      select: { customerId: true },
    });
    const existingSet = new Set(existingBefore.map(e => e.customerId));

    const newLoans = loans.filter(l => !existingSet.has(l.customerId));
    const newCustIds = new Set(newLoans.map(l => l.customerId));
    const count = newCustIds.size;

    const disbursementAmount = newLoans.reduce((s, l) => s + (l.disbursementAmount ?? 0), 0) / 1e7;
    const avgTicketSize = count > 0 ? (disbursementAmount * 100) / count : 0; // Cr → L

    // Branch-wise count (unique new customers per branch)
    const branchMap = new Map<string, Set<string>>();
    for (const l of newLoans) {
      if (existingSet.has(l.customerId)) continue;
      const b = l.branch ?? "Unknown";
      if (!branchMap.has(b)) branchMap.set(b, new Set());
      branchMap.get(b)!.add(l.customerId);
    }
    const byBranch = Array.from(branchMap.entries()).map(([branch, set]) => ({
      branch,
      count: set.size,
    }));

    return NextResponse.json({
      count,
      disbursementAmount: parseFloat(disbursementAmount.toFixed(2)),
      avgTicketSize: parseFloat(avgTicketSize.toFixed(2)),
      byBranch,
    });
  } catch (err) {
    console.error("[new-customers]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
