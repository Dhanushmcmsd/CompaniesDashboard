'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Period = 'FTD' | 'MTD' | 'YTD';

interface PeriodState {
  period:   Period;
  date:     string;   // YYYY-MM-DD  (FTD)
  month:    string;   // YYYY-MM     (MTD)
  year:     string;   // YYYY        (YTD)
  // Available options from DB
  availableDays:   string[];
  availableMonths: string[];
  availableYears:  string[];
  // Setters
  setPeriod: (p: Period) => void;
  setDate:   (d: string) => void;
  setMonth:  (m: string) => void;
  setYear:   (y: string) => void;
  // Build query string for API calls
  periodParams: string;
}

const PeriodContext = createContext<PeriodState | null>(null);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const monthStr = now.toISOString().slice(0, 7);
  const yearStr  = String(now.getFullYear());

  const [period,   setPeriod]   = useState<Period>('FTD');
  const [date,     setDate]     = useState(todayStr);
  const [month,    setMonth]    = useState(monthStr);
  const [year,     setYear]     = useState(yearStr);
  const [availableDays,   setAvailableDays]   = useState<string[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [availableYears,  setAvailableYears]  = useState<string[]>([]);

  // Fetch available periods once on mount
  useEffect(() => {
    fetch('/api/dashboard/gold-loan/available-periods')
      .then((r) => r.json())
      .then((d) => {
        if (d.days?.length)   { setAvailableDays(d.days);     setDate(d.days[0]); }
        if (d.months?.length) { setAvailableMonths(d.months); setMonth(d.months[0]); }
        if (d.years?.length)  { setAvailableYears(d.years);  setYear(d.years[0]); }
      })
      .catch(() => {});
  }, []);

  // Build the query string that all API calls append
  const periodParams =
    period === 'FTD' ? `period=FTD&date=${date}` :
    period === 'MTD' ? `period=MTD&month=${month}` :
                      `period=YTD&year=${year}`;

  return (
    <PeriodContext.Provider value={{
      period, date, month, year,
      availableDays, availableMonths, availableYears,
      setPeriod, setDate, setMonth, setYear,
      periodParams,
    }}>
      {children}
    </PeriodContext.Provider>
  );
}

export function usePeriod() {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error('usePeriod must be used inside PeriodProvider');
  return ctx;
}
