import type { Period } from '@/context/PeriodContext';

export interface DateRange {
  from: Date;
  to: Date;
}

export function getDateRange(period: Period): DateRange {
  const today = new Date();
  // Normalise to start-of-day
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfToday   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

  switch (period) {
    case 'FTD':
      return { from: startOfToday, to: endOfToday };

    case 'MTD': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from, to: endOfToday };
    }

    case 'YTD': {
      const from = new Date(today.getFullYear(), 0, 1);
      return { from, to: endOfToday };
    }
  }
}

/** Returns ISO date string 'YYYY-MM-DD' for use in Prisma/SQL queries */
export function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}
