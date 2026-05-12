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

    if (!snap) return NextResponse.json({ totalCustomers: 0, totalAccounts: 0, newCustomers: 0, mtdDisbursements: 0, ftdDisbursements: 0 });

    // newCustomers: count of FTD disbursement transactions (proxy — true new-customer
    // detection requires historical first-loan-date data not yet available in uploads).
    // The dashboard shows this with a note so users understand the limitation.
    const ftdDisb = snap.newDisbursements ?? 0;

    return NextResponse.json({
      totalCustomers:   snap.totalCustomers,
      totalAccounts:    snap.totalAccounts,
      // NOTE: This is FTD disbursement amount (not a count of unique new borrowers).
      // Accurate new-customer tracking requires historical first-loan-date data.
      newCustomers:     ftdDisb,
      newCustomersNote: 'FTD disbursement amount (new borrower count not yet available)',
      mtdDisbursements: snap.mtdDisbursements,
      ftdDisbursements: snap.newDisbursements,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
