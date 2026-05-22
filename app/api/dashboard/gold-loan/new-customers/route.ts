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

    if (!snap) return NextResponse.json({ totalCustomers: 0, totalAccounts: 0, newCustomers: 0, newCustomersDisbursementAmount: 0, mtdDisbursements: 0, ftdDisbursements: 0 });

    const newCustomers = snap.newCustomerFromTxn || snap.newCustomerFromLoanBalance || 0;
    const newCustomersDisbursementAmount = snap.newDisbursements ?? 0;

    return NextResponse.json({
      totalCustomers:   snap.totalCustomers,
      totalAccounts:    snap.totalAccounts,
      newCustomers,
      newCustomersDisbursementAmount,
      newCustomersNote: snap.newCustomerFromTxn != null
        ? 'New borrower count based on today’s transaction disbursements'
        : snap.newCustomerFromLoanBalance
          ? 'New borrower count based on today’s loan balance disbursements'
          : 'New borrower count unavailable',
      mtdDisbursements: snap.mtdDisbursements,
      ftdDisbursements: snap.newDisbursements,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
