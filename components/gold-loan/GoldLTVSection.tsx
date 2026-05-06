"use client";

import { useEffect, useState } from "react";
import { usePeriod } from "@/context/PeriodContext";

interface GoldLTVData {
  avgLTV: number;
  avgPresentRate: number;
  avgGoldValuePerLoan: number;
  totalGoldWeight: number;
  avgGoldWeightPerLoan: number;
  auctionCases: number;
  highLTVAccounts: number;
  goldValueMismatch: number;
}

function fmt2(n: unknown) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "\u2014";
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmt0(n: unknown) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "\u2014";
  return num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function Pill({ label, value, unit, warn }: { label: string; value: string; unit?: string; warn?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold leading-none ${warn ? "text-red-600" : "text-[#0f172a]"}`}>
        {value}{unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

export default function GoldLTVSection() {
  const { period } = usePeriod();
  const [data, setData]       = useState<GoldLTVData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    fetch(`/api/dashboard/gold-loan/gold-ltv?period=${period}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => {
        // API returns { goldLtv: { ... } }
        setData(d?.goldLtv ?? null);
        setLoading(false);
      })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [period]);

  if (loading) return <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />;
  if (error)   return <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">Failed to load Gold/LTV data: {error}</div>;
  if (!data)   return <div className="text-gray-400 text-sm text-center py-8">No data — upload a Balance Statement.</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Pill label="Avg LTV"               value={fmt2(data.avgLTV)}              unit="%"   warn={(data.avgLTV ?? 0) > 85} />
        <Pill label="Avg Rate / gram"       value={fmt0(data.avgPresentRate)}      unit="\u20b9" />
        <Pill label="Avg Gold Value / Loan" value={fmt2(data.avgGoldValuePerLoan)} unit="\u20b9 L" />
        <Pill label="Total Gold Weight"     value={fmt0(data.totalGoldWeight)}     unit="g" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Pill label="Avg Gold / Loan"    value={fmt2(data.avgGoldWeightPerLoan)} unit="g" />
        <Pill label="High LTV (>85%)"   value={fmt0(data.highLTVAccounts)}      unit="accounts" warn={(data.highLTVAccounts ?? 0) > 0} />
        <Pill label="Gold Value Deficit" value={fmt0(data.goldValueMismatch)}    unit="accounts" warn={(data.goldValueMismatch ?? 0) > 0} />
      </div>
    </div>
  );
}
