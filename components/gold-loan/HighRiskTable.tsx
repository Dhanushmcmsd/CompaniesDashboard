"use client";

import { useEffect, useState } from "react";

interface HighRiskCustomer {
  customerId: string;
  name: string;
  branch: string;
  outstanding: number;       // ₹
  goldWeight: number;        // g
  currentGoldValue: number;  // ₹
  excessRisk: number;        // outstanding − goldValue  (positive = under-collateralised)
}

interface HighRiskResponse {
  goldRate: number;
  customers: HighRiskCustomer[];
}

// ── Formatters ──────────────────────────────────────────────────────────────
function fmtINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtG(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " g";
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="h-10 bg-red-50 rounded" />
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function HighRiskTable() {
  const [data, setData]       = useState<HighRiskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // No period dependency — always reflects current state
  useEffect(() => {
    fetch("/api/dashboard/gold-loan/high-risk")
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: HighRiskResponse) => { setData(d); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, []);

  const customers = data?.customers ?? [];
  const goldRate  = data?.goldRate ?? 0;

  return (
    <div className="rounded-xl overflow-hidden border border-red-300 shadow-md">

      {/* ── Alert Header Bar ─────────────────────────────────────────────── */}
      <div className="bg-red-700 px-5 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-white font-bold text-sm">
              ⚠&nbsp; High Risk — Outstanding Exceeds Current Gold Value
            </p>
            <p className="text-red-200 text-xs mt-0.5">
              Customers where loan outstanding &gt; current gold collateral value
              &nbsp;|&nbsp; Gold rate:&nbsp;
              <span className="font-semibold text-white">
                ₹{goldRate.toLocaleString("en-IN")}/g
              </span>
            </p>
          </div>
          <span className="bg-red-900 text-red-100 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
            Requires Immediate Management Action
          </span>
        </div>
      </div>

      {/* ── Row Count Banner ─────────────────────────────────────────────── */}
      <div className="bg-red-50 border-b border-red-200 px-5 py-2">
        {loading ? (
          <div className="h-3 w-40 bg-red-200 rounded animate-pulse" />
        ) : (
          <p className="text-xs font-semibold text-red-700">
            {customers.length === 0
              ? "✅ No high-risk customers flagged"
              : `${customers.length} customer${customers.length > 1 ? "s" : ""} flagged`}
          </p>
        )}
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 px-5 py-3 text-red-700 text-sm">
          Failed to load high-risk data: {error}
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {!error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0f172a] text-white">
                {[
                  "Customer ID",
                  "Customer Name",
                  "Branch",
                  "Outstanding (₹)",
                  "Gold Weight (g)",
                  "Current Gold Value (₹)",
                  "Excess Risk (₹)",
                ].map(h => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8">
                    <Skeleton />
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No customers currently exceed their gold collateral value.
                  </td>
                </tr>
              ) : (
                customers.map((c, idx) => (
                  <tr
                    key={c.customerId}
                    className={idx % 2 === 0 ? "bg-red-50" : "bg-white"}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600 whitespace-nowrap">
                      {c.customerId}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                      {c.name}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                      {c.branch}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-800 whitespace-nowrap">
                      {fmtINR(c.outstanding)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700 whitespace-nowrap">
                      {fmtG(c.goldWeight)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700 whitespace-nowrap">
                      {fmtINR(c.currentGoldValue)}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <span className="inline-block bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                        {fmtINR(c.excessRisk)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
