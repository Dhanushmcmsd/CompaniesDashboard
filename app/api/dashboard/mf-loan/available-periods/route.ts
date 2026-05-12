/**
 * GET /api/dashboard/mf-loan/available-periods
 * Returns days, months, and years that have MF Loan snapshots — used by the date pickers.
 */
import { NextResponse }    from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions }     from '@/lib/auth';
import { prisma }          from '@/lib/prisma';

async function mfAvailableDays(company: string): Promise<string[]> {
  const rows = await prisma.mfLoanSnapshot.findMany({
    where:   { company },
    select:  { snapshotDate: true },
    orderBy: { snapshotDate: 'desc' },
    take:    90,
  });
  return Array.from(new Set(rows.map((r: { snapshotDate: Date }) => r.snapshotDate.toISOString().slice(0, 10))));
}

async function mfAvailableMonths(company: string): Promise<string[]> {
  const rows = await prisma.mfLoanSnapshot.findMany({
    where:   { company },
    select:  { snapshotDate: true },
    orderBy: { snapshotDate: 'desc' },
    take:    365,
  });
  return Array.from(new Set(rows.map((r: { snapshotDate: Date }) => r.snapshotDate.toISOString().slice(0, 7))));
}

async function mfAvailableYears(company: string): Promise<string[]> {
  const rows = await prisma.mfLoanSnapshot.findMany({
    where:   { company },
    select:  { snapshotDate: true },
    orderBy: { snapshotDate: 'desc' },
    take:    365,
  });
  return Array.from(new Set(rows.map((r: { snapshotDate: Date }) => String(r.snapshotDate.getFullYear()))));
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [days, months, years] = await Promise.all([
      mfAvailableDays('supra'),
      mfAvailableMonths('supra'),
      mfAvailableYears('supra'),
    ]);

    return NextResponse.json({ days, months, years });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
