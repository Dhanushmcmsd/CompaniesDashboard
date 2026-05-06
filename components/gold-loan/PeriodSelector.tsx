'use client';

import { usePeriod, Period } from '@/context/PeriodContext';

const PERIODS: Period[] = ['FTD', 'MTD', 'YTD'];

export default function PeriodSelector() {
  const { period, setPeriod } = usePeriod();

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-300">Period:</span>
      <div className="flex rounded overflow-hidden border border-gray-600">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 text-sm font-semibold transition-colors ${
              period === p
                ? 'bg-[#1a2340] text-white'
                : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
