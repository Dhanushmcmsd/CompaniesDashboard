'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import useSWR from 'swr';
import { usePeriod } from '@/context/PeriodContext';
import { fetcher } from '@/lib/swr-fetcher';
import type { GoldLoanDashboardSnapshot } from '@/lib/gold-loan/dashboard-snapshot';

export type { GoldLoanDashboardSnapshot } from '@/lib/gold-loan/dashboard-snapshot';

interface GoldLoanDataContextValue {
  snapshot: GoldLoanDashboardSnapshot | null;
  isLoading: boolean;
}

const GoldLoanDataContext = createContext<GoldLoanDataContextValue | null>(null);

export function GoldLoanDataProvider({ children }: { children: ReactNode }) {
  const { periodParams } = usePeriod();
  const { data, isLoading } = useSWR<{ snapshot: GoldLoanDashboardSnapshot }>(
    `/api/dashboard/gold-loan/snapshot?${periodParams}`,
    fetcher,
    { refreshInterval: 30_000, revalidateOnFocus: true },
  );

  const value = useMemo<GoldLoanDataContextValue>(
    () => ({
      snapshot: data?.snapshot ?? null,
      isLoading,
    }),
    [data, isLoading],
  );

  return (
    <GoldLoanDataContext.Provider value={value}>
      {children}
    </GoldLoanDataContext.Provider>
  );
}

export function useGoldLoanData() {
  const ctx = useContext(GoldLoanDataContext);
  if (!ctx) {
    throw new Error('useGoldLoanData must be used within GoldLoanDataProvider');
  }
  return ctx;
}
