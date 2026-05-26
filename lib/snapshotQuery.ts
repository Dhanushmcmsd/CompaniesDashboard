/**
 * Central helper: resolve a GoldLoanSnapshot from period + optional date params.
 *
 * period=FTD  → snapshot for a specific day (default: latest uploaded snapshot)
 * period=MTD  → latest snapshot whose snapshotDate falls in the chosen month
 * period=YTD  → latest snapshot whose snapshotDate falls in the chosen Indian
 *               financial year (Apr–Mar). Param year=FY2026 or year=2026 means
 *               FY ending March 2026 (1 Apr 2025 – 31 Mar 2026).
 *
 * If no snapshot exists in the requested window, returns the latest snapshot ever
 * for that company. This prevents dashboards from showing nil simply because
 * the selected date is later than the most recent uploaded report.
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
import type { GoldLoanSnapshot } from '@prisma/client';

export type SnapshotResolveResult = {
  snapshot: GoldLoanSnapshot | null;
  requestedPeriod: string;
  requestedDate: string | null;
  requestedMonth: string | null;
  requestedYear: string | null;
  exactSnapshotFound: boolean;
  usedFallback: boolean;
  snapshotDate: string | null;
};

function toDateParam(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function parseDateParam(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function dayBounds(day: Date) {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function resolveSnapshot(
  company: string,
  searchParams: URLSearchParams,
) {
  const resolved = await resolveSnapshotWithMeta(company, searchParams);
  return resolved.snapshot;
}

export async function resolveSnapshotWithMeta(
  company: string,
  searchParams: URLSearchParams,
): Promise<SnapshotResolveResult> {
  const period = (searchParams.get('period') ?? 'FTD').toUpperCase();
  const now = new Date();
  const requestedDate = searchParams.get('date');
  const requestedMonth = searchParams.get('month');
  const requestedYear = searchParams.get('year');

  const latestEver = () =>
    prisma.goldLoanSnapshot.findFirst({
      where: { company },
      orderBy: { snapshotDate: 'desc' },
    });

  const finish = (
    exactSnapshot: GoldLoanSnapshot | null,
    fallbackSnapshot: GoldLoanSnapshot | null,
  ): SnapshotResolveResult => {
    const snapshot = exactSnapshot ?? fallbackSnapshot;
    const result = {
      snapshot,
      requestedPeriod: period,
      requestedDate,
      requestedMonth,
      requestedYear,
      exactSnapshotFound: Boolean(exactSnapshot),
      usedFallback: !exactSnapshot && Boolean(fallbackSnapshot),
      snapshotDate: toDateParam(snapshot?.snapshotDate),
    };

    console.log('[gold-loan snapshotQuery]', {
      company,
      requestedPeriod: result.requestedPeriod,
      requestedDate: result.requestedDate,
      requestedMonth: result.requestedMonth,
      requestedYear: result.requestedYear,
      exactSnapshotFound: result.exactSnapshotFound,
      usedFallback: result.usedFallback,
      snapshotDate: result.snapshotDate,
      newDisbursements: snapshot?.newDisbursements ?? null,
      mtdDisbursements: snapshot?.mtdDisbursements ?? null,
    });

    return result;
  };

  const latest = async () => finish(await latestEver(), null);

  if (period === 'FTD') {
    // No explicit day means "latest uploaded snapshot"; do not silently use today's date.
    if (!requestedDate) return latest();

    const { start, end } = dayBounds(parseDateParam(requestedDate));
    const exact = await prisma.goldLoanSnapshot.findFirst({
      where: { company, snapshotDate: { gte: start, lte: end } },
      orderBy: { snapshotDate: 'desc' },
    });
    return finish(exact, exact ? null : await latestEver());
  }

  if (period === 'MTD') {
    if (!requestedMonth) return latest();

    const ref = parseDateParam(`${requestedMonth}-01`);
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
    const end   = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
    const exact = await prisma.goldLoanSnapshot.findFirst({
      where: { company, snapshotDate: { gte: start, lte: end } },
      orderBy: { snapshotDate: 'desc' },
    });
    return finish(exact, exact ? null : await latestEver());
  }

  // YTD — Indian financial year (Apr 1 – Mar 31), param = FY end year (March year)
  if (!requestedYear) return latest();

  const fyEndYear = parseIndianFyEndYearFromParam(requestedYear, now);
  const { start, end } = indianFyStartEnd(fyEndYear);
  const exact = await prisma.goldLoanSnapshot.findFirst({
    where: { company, snapshotDate: { gte: start, lte: end } },
    orderBy: { snapshotDate: 'desc' },
  });
  return finish(exact, exact ? null : await latestEver());
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
