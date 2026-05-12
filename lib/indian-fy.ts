/**
 * Indian financial year: April 1 → March 31.
 * Label FY20xx denotes the FY that ends in March of calendar year 20xx
 * (e.g. FY2026 = 1 Apr 2025 – 31 Mar 2026).
 */

export function indianFyEndYearForDate(d: Date): number {
  const m = d.getMonth();
  const y = d.getFullYear();
  return m >= 3 ? y + 1 : y;
}

export function indianFyStartEnd(fyEndYear: number): { start: Date; end: Date } {
  const start = new Date(fyEndYear - 1, 3, 1, 0, 0, 0, 0);
  const end = new Date(fyEndYear, 2, 31, 23, 59, 59, 999);
  return { start, end };
}

export function formatIndianFyLabel(fyEndYear: number): string {
  return `FY${fyEndYear}`;
}

/**
 * Parse `year` query param: "FY2026", "fy2026", or plain "2026" (FY end year).
 */
export function parseIndianFyEndYearFromParam(
  yearStr: string | null | undefined,
  now: Date,
): number {
  if (!yearStr?.trim()) return indianFyEndYearForDate(now);
  const t = yearStr.trim();
  const m = /^FY\s*(\d{4})$/i.exec(t);
  if (m) {
    const y = parseInt(m[1], 10);
    return Number.isFinite(y) ? y : indianFyEndYearForDate(now);
  }
  if (/^\d{4}$/.test(t)) {
    const y = parseInt(t, 10);
    return Number.isFinite(y) ? y : indianFyEndYearForDate(now);
  }
  return indianFyEndYearForDate(now);
}

export function uniqueSortedIndianFyLabelsFromDates(dates: Date[]): string[] {
  const set = new Set<string>();
  for (const d of dates) {
    set.add(formatIndianFyLabel(indianFyEndYearForDate(d)));
  }
  return Array.from(set).sort((a, b) => {
    const na = parseInt(a.replace(/^FY/i, ''), 10);
    const nb = parseInt(b.replace(/^FY/i, ''), 10);
    return nb - na;
  });
}
