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
        avgLTV:               snap.avgLTV,
        totalGoldWeight:      snap.totalGoldWeight,
        avgPresentRate:       snap.avgPresentRate,
        avgGoldValuePerLoan:  snap.avgGoldValuePerLoan,
        newDisbursements:     snap.newDisbursements,
        mtdDisbursements:     snap.mtdDisbursements,
        ytdDisbursements:     snap.ytdDisbursements,
        totalOverdue:         snap.totalOverdue,
        overduePercent:       snap.overduePercent,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
