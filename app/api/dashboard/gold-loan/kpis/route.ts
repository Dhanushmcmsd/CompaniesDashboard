import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDateRange } from '@/lib/gold-loan/period-utils';
import type { Period } from '@/context/PeriodContext';

export async function GET(req: NextRequest) {
  const raw    = req.nextUrl.searchParams.get('period') ?? 'MTD';
  const period = ((['FTD', 'MTD', 'YTD'].includes(raw) ? raw : 'MTD') as Period);
  const { from, to } = getDateRange(period);

  // ── Balance-based metrics (snapshot: use latest record per loan) ──
  const balances = await prisma.goldLoanBalance.findMany({
    where: { disbursementDate: { gte: from, lte: to } },
    select: {
      customerId:      true,
      closingBalance:  true,
      goldWeight:      true,
      interestRate:    true,
      dpd:             true,
      disbursementDate: true,
    },
  });

  const totalAUM          = balances.reduce((s, r) => s + (r.closingBalance ?? 0), 0);
  const totalCustomers    = new Set(balances.map((r) => r.customerId)).size;
  const avgTicketSize     = totalCustomers > 0 ? (totalAUM / totalCustomers) * 100 : 0; // convert Cr → L
  const yieldAvg          = balances.length > 0
    ? balances.reduce((s, r) => s + (r.interestRate ?? 0), 0) / balances.length
    : 0;
  const gnpaAmount        = balances.filter((r) => (r.dpd ?? 0) > 90).reduce((s, r) => s + (r.closingBalance ?? 0), 0);
  const gnpaPct           = totalAUM > 0 ? (gnpaAmount / totalAUM) * 100 : 0;
  const totalGoldWeight   = balances.reduce((s, r) => s + (r.goldWeight ?? 0), 0);
  const newCustomers      = new Set(
    balances
      .filter((r) => r.disbursementDate && r.disbursementDate >= from && r.disbursementDate <= to)
      .map((r) => r.customerId)
  ).size;

  // Avg LTV: closing_balance / (gold_weight * assumed gold rate 9500/g as placeholder)
  const GOLD_RATE = 9500;
  const ltvValues = balances
    .filter((r) => r.goldWeight && r.goldWeight > 0)
    .map((r) => (r.closingBalance ?? 0) / ((r.goldWeight! * GOLD_RATE) / 1e5)); // Cr basis
  const avgLTV = ltvValues.length > 0 ? ltvValues.reduce((a, b) => a + b, 0) / ltvValues.length * 100 : 0;

  const avgRatePerGram = GOLD_RATE; // replace with live rate feed later
  const avgGoldValuePerLoan = totalCustomers > 0
    ? (totalGoldWeight * GOLD_RATE) / 1e5 / totalCustomers
    : 0;

  // ── Transaction-based metrics ──
  const transactions = await prisma.goldLoanTransaction.findMany({
    where: { transactionDate: { gte: from, lte: to } },
    select: { totalAmountReceived: true },
  });
  // Overdue proxy: balances with dpd > 0
  const overdueAmount = balances
    .filter((r) => (r.dpd ?? 0) > 0)
    .reduce((s, r) => s + (r.closingBalance ?? 0), 0);
  const collected = transactions.reduce((s, t) => s + (t.totalAmountReceived ?? 0), 0);
  const collectionEfficiency = overdueAmount > 0 ? (collected / overdueAmount) * 100 : 100;

  // Closed loans (grams released) — loans with dpd = -1 or closingBalance = 0 within range
  const closedLoansGrams = balances
    .filter((r) => (r.closingBalance ?? 0) === 0)
    .reduce((s, r) => s + (r.goldWeight ?? 0), 0);

  return NextResponse.json({
    totalAUM:             Math.round(totalAUM * 100) / 100,
    totalCustomers,
    avgTicketSize:        Math.round(avgTicketSize * 100) / 100,
    yield:                Math.round(yieldAvg * 100) / 100,
    gnpaPct:              Math.round(gnpaPct * 100) / 100,
    collectionEfficiency: Math.round(collectionEfficiency * 100) / 100,
    avgLTV:               Math.round(avgLTV * 100) / 100,
    totalGoldWeight:      Math.round(totalGoldWeight),
    avgRatePerGram,
    avgGoldValuePerLoan:  Math.round(avgGoldValuePerLoan * 100) / 100,
    newCustomers,
    closedLoansGrams:     Math.round(closedLoansGrams),
  });
}
