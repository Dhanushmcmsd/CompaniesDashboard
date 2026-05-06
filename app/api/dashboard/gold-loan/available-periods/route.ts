/**
 * GET /api/dashboard/gold-loan/available-periods
 * Returns the days, months, and years that have snapshots for the date pickers.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { availableDays, availableMonths, availableYears } from '@/lib/snapshotQuery';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [days, months, years] = await Promise.all([
      availableDays('supra'),
      availableMonths('supra'),
      availableYears('supra'),
    ]);

    return NextResponse.json({ days, months, years });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
