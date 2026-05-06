"use client";

import { usePeriod, type Period } from "@/context/PeriodContext";

const PERIODS: Period[] = ["FTD", "MTD", "YTD"];

export default function PeriodSelector() {
  const { period, setPeriod } = usePeriod();

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-200">Period:</span>
      <div className="flex gap-1">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
              period === p
                ? "bg-[#0f172a] text-white font-bold border border-white/20"
                : "bg-gray-200 text-gray-500 hover:bg-gray-300"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
