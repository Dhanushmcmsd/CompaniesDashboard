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

    if (!snap) return NextResponse.json({ totalCustomers: 0, totalAccounts: 0, newCustomers: 0, mtdDisbursements: 0 });

    return NextResponse.json({
      totalCustomers:   snap.totalCustomers,
      totalAccounts:    snap.totalAccounts,
      newCustomers:     snap.newDisbursements > 0 ? 'See FTD disbursement' : 0,
      mtdDisbursements: snap.mtdDisbursements,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
