"use client";

import { useEffect, useState } from "react";
import { usePeriod } from "@/context/PeriodContext";

interface ApiResponse {
  avgLTV: number;
  goldRate: number;
  avgLoanPerGram: number;
  totalGoldWeight: number;
  auctionCases: number;
}

function fmt2(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function KPICard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-bold text-[#0f172a] leading-none">
        {value}{unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

export default function GoldLTVSection() {
  const { period } = usePeriod();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/gold-loan/gold-ltv?period=${period}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: ApiResponse) => { setData(d); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [period]);

  if (loading) return <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{[0,1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">Failed to load Gold/LTV data: {error}</div>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <KPICard label="Avg LTV" value={fmt2(data?.avgLTV ?? 0)} unit="%" />
      <KPICard label="Gold Rate" value={fmt2(data?.goldRate ?? 0)} unit="₹/g" />
      <KPICard label="Avg Loan per Gram" value={fmt2(data?.avgLoanPerGram ?? 0)} unit="₹" />
      <KPICard label="Total Gold Weight" value={fmt2(data?.totalGoldWeight ?? 0)} unit="g" />
      <KPICard label="Auction Cases" value={String(data?.auctionCases ?? 0)} />
    </div>
  );
}
