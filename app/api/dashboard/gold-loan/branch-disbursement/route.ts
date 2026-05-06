import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDateRange } from '@/lib/gold-loan/period-utils';
import type { Period } from '@/context/PeriodContext';

export async function GET(req: NextRequest) {
  const raw    = req.nextUrl.searchParams.get('period') ?? 'MTD';
  const period = (['FTD', 'MTD', 'YTD'].includes(raw) ? raw : 'MTD') as Period;
  const { from, to } = getDateRange(period);

  const rows = await prisma.goldLoanBalance.findMany({
    where:  { disbursementDate: { gte: from, lte: to } },
    select: { branchName: true, closingBalance: true },
  });

  const branchMap = new Map<string, number>();
  for (const row of rows) {
    const branch = row.branchName ?? 'Unknown';
    branchMap.set(branch, (branchMap.get(branch) ?? 0) + (row.closingBalance ?? 0));
  }

  // Target is stored as a flat value — replace with DB lookup when target table exists
  const TARGET_PER_BRANCH_CR = 5;

  const data = Array.from(branchMap.entries()).map(([branch, disbursement]) => ({
    branch,
    disbursement: Math.round(disbursement * 100) / 100,
    target:       TARGET_PER_BRANCH_CR,
  }));

  return NextResponse.json({ data });
}
