"use client";

import { useEffect, useMemo, useState } from "react";
import { usePeriod } from "@/context/PeriodContext";

interface BranchRow {
  branch: string;
  aum: number;
  disbursement: number;
  target: number;
  vsTargetPct: number;
  collectionEff: number;
  npaPct: number;
  avgGoldWeight: number;
}

type SortKey = keyof BranchRow;

function fmt2(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function badgeClass(value: number) {
  return value >= 100
    ? "bg-green-100 text-green-700"
    : value >= 80
    ? "bg-yellow-100 text-yellow-700"
    : "bg-red-100 text-red-700";
}

function collectionBadge(value: number) {
  return value >= 90
    ? "bg-green-100 text-green-700"
    : value >= 75
    ? "bg-yellow-100 text-yellow-700"
    : "bg-red-100 text-red-700";
}

export default function BranchPerformanceTable() {
  const { period } = usePeriod();
  const [rows, setRows] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("aum");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/gold-loan/branch-performance?period=${period}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: BranchRow[]) => { setRows(d); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [period]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(prev => (prev === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const headerClass = "px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap cursor-pointer select-none";

  if (loading) return <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">Failed to load branch performance: {error}</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#0f172a] text-white">
            <th className={headerClass} onClick={() => toggleSort("branch")}>Branch</th>
            <th className={headerClass} onClick={() => toggleSort("aum")}>AUM (₹ Cr)</th>
            <th className={headerClass} onClick={() => toggleSort("disbursement")}>Disbursement</th>
            <th className={headerClass} onClick={() => toggleSort("target")}>Target</th>
            <th className={headerClass} onClick={() => toggleSort("vsTargetPct")}>Vs Target (%)</th>
            <th className={headerClass} onClick={() => toggleSort("collectionEff")}>Collection Eff (%)</th>
            <th className={headerClass} onClick={() => toggleSort("npaPct")}>NPA (%)</th>
            <th className={headerClass} onClick={() => toggleSort("avgGoldWeight")}>Avg Gold Weight (g)</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((r, idx) => (
            <tr key={r.branch} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="px-4 py-2.5 font-medium text-gray-800">{r.branch}</td>
              <td className="px-4 py-2.5 text-right">{fmt2(r.aum)}</td>
              <td className="px-4 py-2.5 text-right">{fmt2(r.disbursement)}</td>
              <td className="px-4 py-2.5 text-right">{fmt2(r.target)}</td>
              <td className="px-4 py-2.5 text-right"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${badgeClass(r.vsTargetPct)}`}>{fmt2(r.vsTargetPct)}%</span></td>
              <td className="px-4 py-2.5 text-right"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${collectionBadge(r.collectionEff)}`}>{fmt2(r.collectionEff)}%</span></td>
              <td className="px-4 py-2.5 text-right">{fmt2(r.npaPct)}%</td>
              <td className="px-4 py-2.5 text-right">{fmt2(r.avgGoldWeight)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
