/**
 * Central helper: resolve a GoldLoanSnapshot from period + optional date params.
 *
 * period=FTD  → snapshot for a specific day (default: today)
 * period=MTD  → latest snapshot whose snapshotDate falls in the chosen month
 * period=YTD  → latest snapshot whose snapshotDate falls in the chosen Indian
 *               financial year (Apr–Mar). Param year=FY2026 or year=2026 means
 *               FY ending March 2026 (1 Apr 2025 – 31 Mar 2026).
 *
 * If no snapshot exists in the requested window, returns the latest snapshot ever
 * for that company (same behaviour as mf-loan KPIs).
 * Extra query params:
 *   date=YYYY-MM-DD   → used for FTD day selection
 *   month=YYYY-MM     → used for MTD month selection
 *   year=FY2026|2026  → FY end year (March year) for YTD window
 */
import { prisma } from '@/lib/prisma';
import {
  indianFyStartEnd,
  parseIndianFyEndYearFromParam,
  uniqueSortedIndianFyLabelsFromDates,
} from '@/lib/indian-fy';

export async function resolveSnapshot(
  company: string,
  searchParams: URLSearchParams,
) {
  const period = (searchParams.get('period') ?? 'FTD').toUpperCase();
  const now = new Date();

  const latestEver = () =>
    prisma.goldLoanSnapshot.findFirst({
      where: { company },
      orderBy: { snapshotDate: 'desc' },
    });

  if (period === 'FTD') {
    // Specific day — default today (IST)
    const dateStr = searchParams.get('date');
    const day = dateStr ? new Date(dateStr) : new Date();
    const start = new Date(day); start.setHours(0, 0, 0, 0);
    const end   = new Date(day); end.setHours(23, 59, 59, 999);
    return (await prisma.goldLoanSnapshot.findFirst({
      where: { company, snapshotDate: { gte: start, lte: end } },
      orderBy: { snapshotDate: 'desc' },
    })) ?? await latestEver();
  }

  if (period === 'MTD') {
    // A specific month — default current month
    const monthStr = searchParams.get('month'); // YYYY-MM
    const ref = monthStr ? new Date(`${monthStr}-01`) : now;
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
    const end   = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
    return (await prisma.goldLoanSnapshot.findFirst({
      where: { company, snapshotDate: { gte: start, lte: end } },
      orderBy: { snapshotDate: 'desc' },
    })) ?? await latestEver();
  }

  // YTD — Indian financial year (Apr 1 – Mar 31), param = FY end year (March year)
  const yearParam = searchParams.get('year');
  const fyEndYear = parseIndianFyEndYearFromParam(yearParam, now);
  const { start, end } = indianFyStartEnd(fyEndYear);
  return (await prisma.goldLoanSnapshot.findFirst({
    where: { company, snapshotDate: { gte: start, lte: end } },
    orderBy: { snapshotDate: 'desc' },
  })) ?? await latestEver();
}

/** Returns list of all days that have at least one snapshot (for FTD date picker) */
export async function availableDays(company: string) {
  const rows = await prisma.goldLoanSnapshot.findMany({
    where: { company },
    select: { snapshotDate: true },
    orderBy: { snapshotDate: 'desc' },
    take: 90,
  });
  const days = Array.from(new Set(rows.map((r: { snapshotDate: Date }) => r.snapshotDate.toISOString().slice(0, 10))));
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
  const months = Array.from(new Set(rows.map((r: { snapshotDate: Date }) => r.snapshotDate.toISOString().slice(0, 7))));
  return months;
}

/** Returns list of Indian FY labels (e.g. FY2026) that have snapshots (for YTD picker) */
export async function availableYears(company: string) {
  const rows = await prisma.goldLoanSnapshot.findMany({
    where: { company },
    select: { snapshotDate: true },
    orderBy: { snapshotDate: 'desc' },
    take: 365,
  });
  return uniqueSortedIndianFyLabelsFromDates(rows.map((r) => r.snapshotDate));
}
