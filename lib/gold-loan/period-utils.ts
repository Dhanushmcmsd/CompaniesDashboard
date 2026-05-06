import type { Period } from "@/context/PeriodContext";

export interface DateRange {
  from: Date;
  to: Date;
}

export function getDateRange(period: Period): DateRange {
  const now = new Date();

  // Normalise 'to' to end-of-day so queries include today fully
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (period) {
    case "FTD": {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return { from, to };
    }
    case "MTD": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { from, to };
    }
    case "YTD": {
      const from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      return { from, to };
    }
  }
}

/** Convenience: ISO strings ready for Prisma / SQL WHERE clauses */
export function getDateRangeISO(period: Period): { from: string; to: string } {
  const { from, to } = getDateRange(period);
  return { from: from.toISOString(), to: to.toISOString() };
}
