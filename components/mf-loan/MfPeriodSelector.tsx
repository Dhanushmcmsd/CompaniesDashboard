'use client';

import { usePeriod } from '@/context/PeriodContext';

export default function MfPeriodSelector() {
  const { period, setPeriod } = usePeriod();
  const periods = ['FTD', 'MTD', 'YTD'] as const;

  return (
    <div className="flex gap-1 bg-[#0f172a] rounded-lg p-1">
      {periods.map((p) => (
        <button
          key={p}
          onClick={() => setPeriod(p)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            period === p
              ? 'bg-white text-[#1a2340]'
              : 'text-gray-300 hover:text-white'
          }`}
        >
          {p === 'YTD' ? 'YTD (FY)' : p}
        </button>
      ))}
    </div>
  );
}
