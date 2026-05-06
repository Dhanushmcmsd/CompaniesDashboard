"use client";

import PeriodSelector from "@/components/gold-loan/PeriodSelector";
import { usePeriod } from "@/context/PeriodContext";

export default function GoldLoanPage() {
  const { period } = usePeriod();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ── Dark Dashboard Header ── */}
      <header className="bg-[#0f172a] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold tracking-wide">
            Supra Pacific — Gold Loan Portfolio
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">Live financial overview</p>
        </div>
        <PeriodSelector />
      </header>

      {/* ── Page Body ── */}
      <main className="p-6">
        {/* KPI tiles, charts and tables go here in Phase 2+ */}
        <div className="text-gray-500 text-sm">
          Active period: <span className="font-semibold text-gray-800">{period}</span>
        </div>
      </main>
    </div>
  );
}
