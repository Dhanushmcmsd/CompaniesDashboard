/**
 * Central helper: resolve a GoldLoanSnapshot from period + optional date params.
 *
 * period=FTD  → snapshot for a specific day (default: today)
 * period=MTD  → latest snapshot whose snapshotDate falls in the chosen month
 * period=YTD  → latest snapshot whose snapshotDate falls in the chosen year
 *
 * Extra query params:
 *   date=YYYY-MM-DD   → used for FTD day selection
 *   month=YYYY-MM     → used for MTD month selection
 *   year=YYYY         → used for YTD year selection
 */
import { prisma } from '@/lib/prisma';

export async function resolveSnapshot(
  company: string,
  searchParams: URLSearchParams,
) {
  const period = (searchParams.get('period') ?? 'FTD').toUpperCase();
  const now = new Date();

  if (period === 'FTD') {
    // Specific day — default today (IST)
    const dateStr = searchParams.get('date');
    const day = dateStr ? new Date(dateStr) : new Date();
    const start = new Date(day); start.setHours(0, 0, 0, 0);
    const end   = new Date(day); end.setHours(23, 59, 59, 999);
    return prisma.goldLoanSnapshot.findFirst({
      where: { company, snapshotDate: { gte: start, lte: end } },
      orderBy: { snapshotDate: 'desc' },
    });
  }

  if (period === 'MTD') {
    // A specific month — default current month
    const monthStr = searchParams.get('month'); // YYYY-MM
    const ref = monthStr ? new Date(`${monthStr}-01`) : now;
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
    const end   = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
    return prisma.goldLoanSnapshot.findFirst({
      where: { company, snapshotDate: { gte: start, lte: end } },
      orderBy: { snapshotDate: 'desc' },
    });
  }

  // YTD — a specific year — default current year
  const yearStr = searchParams.get('year');
  const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end   = new Date(year, 11, 31, 23, 59, 59, 999);
  return prisma.goldLoanSnapshot.findFirst({
    where: { company, snapshotDate: { gte: start, lte: end } },
    orderBy: { snapshotDate: 'desc' },
  });
}

/** Returns list of all days that have at least one snapshot (for FTD date picker) */
export async function availableDays(company: string) {
  const rows = await prisma.goldLoanSnapshot.findMany({
    where: { company },
    select: { snapshotDate: true },
    orderBy: { snapshotDate: 'desc' },
    take: 90,
  });
  const days = [...new Set(rows.map((r) => r.snapshotDate.toISOString().slice(0, 10)))];
  return days;
}

/** Returns list of YYYY-MM months that have snapshots (for MTD picker) */
export async function availableMonths(company: string) {
  const rows = await prisma.goldLoanSnapshot.findMany({
    where: { company },
    select: { snapshotDate: true },
    orderBy: { snapshotDate: 'desc' },
    take: 365,
  });
  const months = [...new Set(rows.map((r) => r.snapshotDate.toISOString().slice(0, 7)))];
  return months;
}

/** Returns list of years that have snapshots (for YTD picker) */
export async function availableYears(company: string) {
  const rows = await prisma.goldLoanSnapshot.findMany({
    where: { company },
    select: { snapshotDate: true },
    orderBy: { snapshotDate: 'desc' },
    take: 365,
  });
  const years = [...new Set(rows.map((r) => String(r.snapshotDate.getFullYear())))];
  return years;
}
