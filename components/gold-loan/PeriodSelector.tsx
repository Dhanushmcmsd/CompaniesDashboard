'use client';

import { formatIndianFyLabel, indianFyEndYearForDate } from '@/lib/indian-fy';
import { usePeriod, Period } from '@/context/PeriodContext';

const PERIODS: Period[] = ['FTD', 'MTD', 'YTD'];

const PERIOD_LABELS: Record<Period, string> = {
  FTD: 'FTD — For the Day',
  MTD: 'MTD — Month to Date',
  YTD: 'YTD (FY) — Financial Year to Date',
};

export default function PeriodSelector() {
  const {
    period, setPeriod,
    date, setDate, availableDays,
    month, setMonth, availableMonths,
    year, setYear, availableYears,
  } = usePeriod();

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Period toggle buttons */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`
              px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors
              ${ period === p
                  ? 'bg-[#0f172a] text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }
            `}
          >
            {p === 'YTD' ? 'YTD (FY)' : p}
          </button>
        ))}
      </div>

      {/* FTD: day picker */}
      {period === 'FTD' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Day</span>
          {availableDays.length > 0 ? (
            <select
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f172a]"
            >
              {availableDays.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          ) : (
            <input
              type="date"
              value={date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white shadow-sm focus:outline-none"
            />
          )}
          <span className="text-xs text-gray-400 italic">Upload refreshes daily</span>
        </div>
      )}

      {/* MTD: month picker */}
      {period === 'MTD' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Month</span>
          {availableMonths.length > 0 ? (
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white shadow-sm focus:outline-none"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {new Date(`${m}-01`).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white shadow-sm focus:outline-none"
            />
          )}
        </div>
      )}

      {/* YTD: year picker */}
      {period === 'YTD' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">FY</span>
          {availableYears.length > 0 ? (
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white shadow-sm focus:outline-none"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          ) : (
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white shadow-sm focus:outline-none"
            >
              {(() => {
                const end = indianFyEndYearForDate(new Date());
                return [end - 2, end - 1, end].map((y) => (
                  <option key={y} value={formatIndianFyLabel(y)}>{formatIndianFyLabel(y)}</option>
                ));
              })()}
            </select>
          )}
        </div>
      )}

      {/* Period description badge */}
      <span className="text-xs text-gray-400 hidden md:inline">
        {PERIOD_LABELS[period]}
      </span>
    </div>
  );
}
