'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { formatIndianFyLabel, indianFyEndYearForDate } from '@/lib/indian-fy';

export type Period = 'FTD' | 'MTD' | 'YTD';
export type Portfolio = 'gold-loan' | 'mf-loan';

interface PeriodState {
  period:   Period;
  date:     string;   // YYYY-MM-DD  (FTD)
  month:    string;   // YYYY-MM     (MTD)
  year:     string;   // FY20xx      (YTD, Indian FY)
  availableDays:   string[];
  availableMonths: string[];
  availableYears:  string[];
  setPeriod: (p: Period) => void;
  setDate:   (d: string) => void;
  setMonth:  (m: string) => void;
  setYear:   (y: string) => void;
  periodParams: string;
}

const PeriodContext = createContext<PeriodState | null>(null);

interface PeriodProviderProps {
  children:  ReactNode;
  portfolio?: Portfolio; // defaults to 'gold-loan' for backward-compat
}

export function PeriodProvider({ children, portfolio = 'gold-loan' }: PeriodProviderProps) {
  const now      = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const monthStr = now.toISOString().slice(0, 7);
  const yearStr  = formatIndianFyLabel(indianFyEndYearForDate(now));

  const [period,   setPeriod]   = useState<Period>('FTD');
  const [date,     setDate]     = useState(todayStr);
  const [month,    setMonth]    = useState(monthStr);
  const [year,     setYear]     = useState(yearStr);
  const [availableDays,   setAvailableDays]   = useState<string[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [availableYears,  setAvailableYears]  = useState<string[]>([]);

  useEffect(() => {
    // Each portfolio fetches from its own available-periods endpoint
    fetch(`/api/dashboard/${portfolio}/available-periods`)
      .then((r) => r.json())
      .then((d) => {
        if (d.days?.length)   { setAvailableDays(d.days);     setDate(d.days[0]); }
        if (d.months?.length) { setAvailableMonths(d.months); setMonth(d.months[0]); }
        if (d.years?.length)  { setAvailableYears(d.years);  setYear(d.years[0]); }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio]);

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
