/**
 * GET /api/dashboard/mf-loan/kpis?period=FTD|MTD|YTD[&date=YYYY-MM-DD][&month=YYYY-MM][&year=YYYY]
 *
 * Returns the latest MfLoanSnapshot KPIs for the requested period.
 * Period resolution mirrors the gold-loan pattern:
 *   FTD  → most recent snapshot on the requested day  (default: today)
 *   MTD  → most recent snapshot in the requested month (default: current month)
 *   YTD  → most recent snapshot in the requested year  (default: current year)
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions }      from '@/lib/auth';
import { prisma }           from '@/lib/prisma';

async function resolveMfSnapshot(
  company: string,
  searchParams: URLSearchParams,
) {
  const period = (searchParams.get('period') ?? 'FTD').toUpperCase();
  const now    = new Date();

  if (period === 'FTD') {
    const dateStr = searchParams.get('date');
    const day     = dateStr ? new Date(dateStr) : new Date();
    const start   = new Date(day); start.setHours(0, 0, 0, 0);
    const end     = new Date(day); end.setHours(23, 59, 59, 999);
    return prisma.mfLoanSnapshot.findFirst({
      where:   { company, snapshotDate: { gte: start, lte: end } },
      orderBy: { snapshotDate: 'desc' },
    });
  }

  if (period === 'MTD') {
    const monthStr = searchParams.get('month');
    const ref      = monthStr ? new Date(`${monthStr}-01`) : now;
    const start    = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
    const end      = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
    return prisma.mfLoanSnapshot.findFirst({
      where:   { company, snapshotDate: { gte: start, lte: end } },
      orderBy: { snapshotDate: 'desc' },
    });
  }

  // YTD
  const yearStr = searchParams.get('year');
  const year    = yearStr ? parseInt(yearStr, 10) : now.getFullYear();
  const start   = new Date(year, 0, 1, 0, 0, 0, 0);
  const end     = new Date(year, 11, 31, 23, 59, 59, 999);
  return prisma.mfLoanSnapshot.findFirst({
    where:   { company, snapshotDate: { gte: start, lte: end } },
    orderBy: { snapshotDate: 'desc' },
  });
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const snap = await resolveMfSnapshot('supra', searchParams);

    if (!snap) return NextResponse.json({ kpis: null });

    return NextResponse.json({
      kpis: {
        // ── Section A — Balance Statement ─────────────────────────────────────
        totalAUM:          snap.totalAUM,
        totalCustomers:    snap.totalCustomers,
        avgYield:          snap.avgYield,
        mtdDisbursement:   snap.mtdDisbursement,
        ftdDisbursement:   snap.ftdDisbursement,
        overdueAccounts:   snap.overdueAccounts,
        overdueAmount:     snap.overdueAmount,
        gnpaAmount:        snap.gnpaAmount,
        gnpaPct:           snap.gnpaPct,
        loanClosureAmount: snap.loanClosureAmount,
        // ── Section B — Transaction Statement ────────────────────────────────
        ftdCollection:      snap.ftdCollection,
        mtdCollection:      snap.mtdCollection,
        ftdDisburseFromTxn: snap.ftdDisburseFromTxn,
        // ── Branch breakdown ─────────────────────────────────────────────────
        branchAUM:         snap.branchAUM,
        // ── Meta ──────────────────────────────────────────────────────────────
        snapshotDate:      snap.snapshotDate,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
