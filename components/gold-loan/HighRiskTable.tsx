"use client";

import { useEffect, useState } from "react";
import { usePeriod } from "@/context/PeriodContext";

interface HighRiskData {
  goldRate: number;
  highRiskCount: number;
  highLTVCount: number;
  accounts: unknown[];
}

function fmt0(n: unknown) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "\u2014";
  return num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function HighRiskTable() {
  const { period } = usePeriod();
  const [data, setData]       = useState<HighRiskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    fetch(`/api/dashboard/gold-loan/high-risk?period=${period}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [period]);

  if (loading) return <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />;
  if (error)   return <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">Failed to load high-risk data: {error}</div>;

  const goldRate     = data?.goldRate     ?? 0;
  const highRiskCount = data?.highRiskCount ?? 0;
  const highLTVCount  = data?.highLTVCount  ?? 0;

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        Customers where loan outstanding &gt; current gold collateral value&nbsp;&nbsp;|
        &nbsp;Gold rate: <strong>\u20b9{fmt0(goldRate)}/g</strong>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`rounded-xl border p-4 shadow-sm ${ highRiskCount > 0 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50" }`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Outstanding &gt; Gold Value</p>
          <p className={`text-3xl font-bold ${ highRiskCount > 0 ? "text-red-700" : "text-green-700" }`}>
            {fmt0(highRiskCount)}
            <span className="text-sm font-normal text-gray-500 ml-2">accounts</span>
          </p>
          {highRiskCount === 0 && <p className="text-xs text-green-600 mt-1">\u2705 No high-risk accounts</p>}
        </div>

        <div className={`rounded-xl border p-4 shadow-sm ${ highLTVCount > 0 ? "border-orange-200 bg-orange-50" : "border-green-200 bg-green-50" }`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">LTV Above 85%</p>
          <p className={`text-3xl font-bold ${ highLTVCount > 0 ? "text-orange-700" : "text-green-700" }`}>
            {fmt0(highLTVCount)}
            <span className="text-sm font-normal text-gray-500 ml-2">accounts</span>
          </p>
          {highLTVCount === 0 && <p className="text-xs text-green-600 mt-1">\u2705 All LTVs within limit</p>}
        </div>
      </div>

      {highRiskCount > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          \u26a0\ufe0f  {highRiskCount} account(s) require immediate management action —
          ask the employee to upload the latest balance statement for account-level detail.
        </div>
      )}
    </div>
  );
}
