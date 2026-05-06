"use client";

import { useEffect, useState } from "react";
import { usePeriod } from "@/context/PeriodContext";

interface NPAData {
  gnpaAmount: number;
  gnpaPct: number;
  nnpaPct: number;
  auctionCases: number;
  sma0: number;
  sma1: number;
  sma2: number;
  branchNPA: { branch: string; gnpaAmount: number; gnpaPct: number }[];
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

function Pill({ label, value, unit, red }: { label: string; value: string; unit?: string; red?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold leading-none ${red ? "text-red-600" : "text-[#0f172a]"}` }>
        {value}{unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

export default function NPARiskSection() {
  const { period } = usePeriod();
  const [data, setData]       = useState<NPAData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    fetch(`/api/dashboard/gold-loan/npa-risk?period=${period}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => {
        // API returns { npa: { ... } }
        setData(d?.npa ?? null);
        setLoading(false);
      })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [period]);

  if (loading) return <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />;
  if (error)   return <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">Failed to load NPA data: {error}</div>;
  if (!data)   return <div className="text-gray-400 text-sm text-center py-8">No NPA data — upload a Balance Statement.</div>;

  const branchNPA = Array.isArray(data.branchNPA) ? data.branchNPA : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Pill label="GNPA Amount"   value={fmt2(data.gnpaAmount)}  unit="\u20b9 Cr" red={(data.gnpaAmount ?? 0) > 0} />
        <Pill label="GNPA %"        value={fmt2(data.gnpaPct)}     unit="%"       red={(data.gnpaPct ?? 0) > 2} />
        <Pill label="NNPA %"        value={fmt2(data.nnpaPct)}     unit="%" />
        <Pill label="Auction Cases" value={fmt0(data.auctionCases)}               red={(data.auctionCases ?? 0) > 0} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Pill label="SMA-0 (0\u201330 DPD)" value={fmt2(data.sma0)} unit="\u20b9 Cr" />
        <Pill label="SMA-1 (31\u201360 DPD)" value={fmt2(data.sma1)} unit="\u20b9 Cr" red={(data.sma1 ?? 0) > 0} />
        <Pill label="SMA-2 (61\u201390 DPD)" value={fmt2(data.sma2)} unit="\u20b9 Cr" red={(data.sma2 ?? 0) > 0} />
      </div>

      {branchNPA.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0f172a] text-white">
                <th className="px-4 py-2.5 text-left text-xs uppercase tracking-wide">Branch</th>
                <th className="px-4 py-2.5 text-right text-xs uppercase tracking-wide">GNPA (\u20b9 Cr)</th>
                <th className="px-4 py-2.5 text-right text-xs uppercase tracking-wide">GNPA %</th>
              </tr>
            </thead>
            <tbody>
              {branchNPA.filter((b) => b.gnpaAmount > 0).sort((a, b) => b.gnpaPct - a.gnpaPct).map((b, i) => (
                <tr key={b.branch} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{b.branch}</td>
                  <td className="px-4 py-2.5 text-right">{fmt2(b.gnpaAmount)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${ b.gnpaPct > 2 ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700" }`}>
                      {fmt2(b.gnpaPct)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
