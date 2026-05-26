import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { resolveSnapshotWithMeta } from '@/lib/snapshotQuery';

type DisbursementFields = {
  newDisbursements: number;
  mtdDisbursements: number;
  ytdDisbursements: number;
};

function disbursementForPeriod(snap: DisbursementFields, period: string): number {
  switch (period.toUpperCase()) {
    case 'MTD':
      return snap.mtdDisbursements;
    case 'YTD':
      return snap.ytdDisbursements;
    default:
      return snap.newDisbursements;
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const resolved = await resolveSnapshotWithMeta('supra', searchParams);
    const snap = resolved.snapshot;
    const periodDisbursements = snap
      ? disbursementForPeriod(snap, resolved.requestedPeriod)
      : null;

    console.log('[gold-loan kpis]', {
      requestedPeriod: resolved.requestedPeriod,
      requestedDate: resolved.requestedDate,
      requestedMonth: resolved.requestedMonth,
      requestedYear: resolved.requestedYear,
      exactSnapshotFound: resolved.exactSnapshotFound,
      usedFallback: resolved.usedFallback,
      snapshotDate: resolved.snapshotDate,
      newDisbursements: snap?.newDisbursements ?? null,
      mtdDisbursements: snap?.mtdDisbursements ?? null,
      ytdDisbursements: snap?.ytdDisbursements ?? null,
      periodDisbursements,
    });

    if (!snap) {
      return NextResponse.json({
        snapshotDate: null,
        requestedDate: resolved.requestedDate,
        requestedPeriod: resolved.requestedPeriod,
        usedFallback: false,
        exactSnapshotFound: false,
        kpis: null,
      });
    }

    return NextResponse.json({
      snapshotDate: resolved.snapshotDate,
      requestedDate: resolved.requestedDate,
      requestedMonth: resolved.requestedMonth,
      requestedYear: resolved.requestedYear,
      requestedPeriod: resolved.requestedPeriod,
      usedFallback: resolved.usedFallback,
      exactSnapshotFound: resolved.exactSnapshotFound,
      kpis: {
        totalAUM:             snap.totalAUM,
        totalCustomers:       snap.totalCustomers,
        totalAccounts:        snap.totalAccounts,
        avgTicketSize:        snap.avgTicketSize,
        avgYield:             snap.avgYield,
        gnpaPct:              snap.gnpaPct,
        gnpaAmount:           snap.gnpaAmount,
        nnpaPct:              snap.nnpaPct,
        collectionEfficiency: snap.collectionEfficiency,
        // Detailed collection breakdown
        overdueCollection:    snap.overdueCollection,
        totalOverdue:         snap.totalOverdue,
        overduePercent:       snap.overduePercent,
        // Gold metrics
        avgLTV:               snap.avgLTV,
        totalGoldWeight:      snap.totalGoldWeight,
        avgPresentRate:       snap.avgPresentRate,
        avgRatePerGram:       snap.avgRatePerGram,
        avgGoldValuePerLoan:  snap.avgGoldValuePerLoan,
        highRiskAmount:       snap.highRiskAmount,
        newCustomerFromLoanBalance: snap.newCustomerFromLoanBalance,
        newCustomerFromTxn:   snap.newCustomerFromTxn,
        // Disbursements — sourced from Transaction Statement when uploaded,
        // otherwise from Issue Date in Loan Balance Statement.
        periodDisbursements,                           // selected period
        newDisbursements:     snap.newDisbursements,   // FTD
        mtdDisbursements:     snap.mtdDisbursements,   // MTD
        ytdDisbursements:     snap.ytdDisbursements,   // Indian FY to date
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
