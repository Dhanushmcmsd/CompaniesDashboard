import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { resolveSnapshot } from '@/lib/snapshotQuery';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const snap = await resolveSnapshot('supra', searchParams);

    if (!snap) return NextResponse.json({ kpis: null });

    return NextResponse.json({
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
        newDisbursements:     snap.newDisbursements,   // FTD
        mtdDisbursements:     snap.mtdDisbursements,   // financial year to date (Apr 1 to today)
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
