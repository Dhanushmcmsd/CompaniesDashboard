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
    select: { disbursementDate: true, closingBalance: true },
  });

  // Aggregate by bucket: FTD→hours (show as one), MTD→day, YTD→month
  const buckets = new Map<string, number>();

  for (const row of rows) {
    if (!row.disbursementDate) continue;
    let key: string;
    if (period === 'YTD') {
      key = row.disbursementDate.toISOString().slice(0, 7); // YYYY-MM
    } else {
      key = row.disbursementDate.toISOString().slice(0, 10); // YYYY-MM-DD
    }
    buckets.set(key, (buckets.get(key) ?? 0) + (row.closingBalance ?? 0));
  }

  const data = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, amount]) => ({ label, amount: Math.round(amount * 100) / 100 }));

  return NextResponse.json({ data });
}
