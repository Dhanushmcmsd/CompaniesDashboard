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

    if (!snap) return NextResponse.json({
      buckets: [], totalOverdue: 0, overduePercent: 0,
      overdueCollection: 0, collectionEfficiency: 0,
    });

    const totalAUM = snap.totalAUM || 1;
    return NextResponse.json({
      buckets: [
        { label: '0–30 Days',  amount: snap.bucket0to30,  pct: (snap.bucket0to30  / totalAUM) * 100 },
        { label: '31–60 Days', amount: snap.bucket31to60, pct: (snap.bucket31to60 / totalAUM) * 100 },
        { label: '61–90 Days', amount: snap.bucket61to90, pct: (snap.bucket61to90 / totalAUM) * 100 },
        { label: '90+ Days',   amount: snap.bucket90plus, pct: (snap.bucket90plus / totalAUM) * 100 },
      ],
      totalOverdue:         snap.totalOverdue,
      overduePercent:       snap.overduePercent,
      overdueCollection:    snap.overdueCollection,
      collectionEfficiency: snap.collectionEfficiency,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
