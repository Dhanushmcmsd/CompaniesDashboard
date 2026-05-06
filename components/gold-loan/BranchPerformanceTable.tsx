"use client";

import { useEffect, useMemo, useState } from "react";
import { usePeriod } from "@/context/PeriodContext";

interface BranchRow {
  branch: string;
  aum: number;
  accounts: number;
  gnpaPct: number;
  gnpaAmount: number;
  totalGoldWeight: number;
  avgGoldPerLoan: number;
  mtdDisb: number;
  ytdDisb: number;
}

type SortKey = keyof BranchRow;

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

function npaBadge(v: number) {
  return v > 2
    ? "bg-red-100 text-red-700"
    : v > 0
    ? "bg-yellow-100 text-yellow-700"
    : "bg-green-100 text-green-700";
}

export default function BranchPerformanceTable() {
  const { period } = usePeriod();
  const [rows, setRows]         = useState<BranchRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [sortKey, setSortKey]   = useState<SortKey>("aum");
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("desc");

  useEffect(() => {
    setLoading(true); setError(null);
    fetch(`/api/dashboard/gold-loan/branch-performance?period=${period}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => {
        // API returns { branches: [...] } — unwrap
        setRows(Array.isArray(d?.branches) ? d.branches : []);
        setLoading(false);
      })
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
    if (sortKey === key) setSortDir((p) => (p === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const th = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap cursor-pointer select-none";

  if (loading) return <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />;
  if (error)   return <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">Failed to load branch performance: {error}</div>;
  if (!rows.length) return <div className="bg-gray-50 text-gray-400 text-sm rounded-xl px-4 py-6 text-center">No branch data yet — upload a Balance Statement to populate.</div>;

  const disbLabel = period === "YTD" ? "YTD Disb (\u20b9 Cr)" : "MTD Disb (\u20b9 Cr)";
  const disbField: SortKey = period === "YTD" ? "ytdDisb" : "mtdDisb";

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#0f172a] text-white">
            <th className={th} onClick={() => toggleSort("branch")}>Branch</th>
            <th className={th} onClick={() => toggleSort("aum")}>AUM (\u20b9 Cr)</th>
            <th className={th} onClick={() => toggleSort("accounts")}>Accounts</th>
            <th className={th} onClick={() => toggleSort(disbField)}>{disbLabel}</th>
            <th className={th} onClick={() => toggleSort("gnpaPct")}>GNPA (%)</th>
            <th className={th} onClick={() => toggleSort("totalGoldWeight")}>Gold Wt (g)</th>
            <th className={th} onClick={() => toggleSort("avgGoldPerLoan")}>Avg Gold/Loan (g)</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((r, idx) => (
            <tr key={r.branch} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">{r.branch}</td>
              <td className="px-3 py-2.5 text-right">{fmt2(r.aum)}</td>
              <td className="px-3 py-2.5 text-right">{fmt0(r.accounts)}</td>
              <td className="px-3 py-2.5 text-right">{fmt2(period === "YTD" ? r.ytdDisb : r.mtdDisb)}</td>
              <td className="px-3 py-2.5 text-right">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${npaBadge(r.gnpaPct)}`}>
                  {fmt2(r.gnpaPct)}%
                </span>
              </td>
              <td className="px-3 py-2.5 text-right">{fmt0(r.totalGoldWeight)}</td>
              <td className="px-3 py-2.5 text-right">{fmt2(r.avgGoldPerLoan)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
