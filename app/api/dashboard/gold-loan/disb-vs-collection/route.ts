import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDateRange } from '@/lib/gold-loan/period-utils';
import type { Period } from '@/context/PeriodContext';

export async function GET(req: NextRequest) {
  const raw    = req.nextUrl.searchParams.get('period') ?? 'MTD';
  const period = (['FTD', 'MTD', 'YTD'].includes(raw) ? raw : 'MTD') as Period;
  const { from, to } = getDateRange(period);

  const [balances, transactions] = await Promise.all([
    prisma.goldLoanBalance.aggregate({
      where:  { disbursementDate: { gte: from, lte: to } },
      _sum:   { closingBalance: true },
    }),
    prisma.goldLoanTransaction.aggregate({
      where:  { transactionDate: { gte: from, lte: to } },
      _sum:   { totalAmountReceived: true },
    }),
  ]);

  return NextResponse.json({
    disbursement: Math.round((balances._sum.closingBalance ?? 0) * 100) / 100,
    collection:   Math.round((transactions._sum.totalAmountReceived ?? 0) * 100) / 100,
  });
}
