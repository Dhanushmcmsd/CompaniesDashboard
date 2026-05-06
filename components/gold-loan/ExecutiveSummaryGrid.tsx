"use client";

import { useEffect, useState } from "react";
import { usePeriod } from "@/context/PeriodContext";
import KPICard from "./KPICard";

interface KPIData {
  totalAUM: number;
  totalCustomers: number;
  avgTicketSize: number;
  yield: number;
  gnpaPct: number;
  collectionEfficiency: number;
  avgLTV: number;
  totalGoldWeight: number;
  avgRatePerGram: number;
  avgGoldValuePerLoan: number;
  newCustomers: number;
  closedLoansGrams: number;
}

function fmt(n: number, decimals = 2): string {
  if (n === undefined || n === null || isNaN(n)) return "—";
  return n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtInt(n: number): string {
  if (n === undefined || n === null || isNaN(n)) return "—";
  return n.toLocaleString("en-IN");
}

export default function ExecutiveSummaryGrid() {
  const { period } = usePeriod();
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/dashboard/gold-loan/kpis?period=${period}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: KPIData) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [period]);

  if (error) {
    return (
      <div className="col-span-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
        Failed to load KPIs: {error}
      </div>
    );
  }

  const gnpaColor = !data ? "blue" : data.gnpaPct > 2 ? "red" : "green";
  const collEff = !data
    ? "blue"
    : data.collectionEfficiency >= 90
    ? "green"
    : data.collectionEfficiency >= 75
    ? "yellow"
    : "red";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Row 1 */}
      <KPICard label="Total AUM" value={fmt(data?.totalAUM ?? 0)} unit="₹ Cr" color="blue" loading={loading} />
      <KPICard label="Total Customers" value={fmtInt(data?.totalCustomers ?? 0)} color="blue" loading={loading} />
      <KPICard label="Avg Ticket Size" value={fmt(data?.avgTicketSize ?? 0)} unit="₹ L" color="blue" loading={loading} />
      <KPICard label="Yield" value={fmt(data?.yield ?? 0)} unit="%" color="blue" loading={loading} />

      {/* Row 2 */}
      <KPICard label="GNPA" value={fmt(data?.gnpaPct ?? 0)} unit="%" color={gnpaColor} loading={loading} />
      <KPICard label="Collection Efficiency" value={fmt(data?.collectionEfficiency ?? 0)} unit="%" color={collEff} loading={loading} />
      <KPICard label="Avg LTV" value={fmt(data?.avgLTV ?? 0)} unit="%" color="blue" loading={loading} />
      <KPICard label="Total Gold Weight" value={fmt(data?.totalGoldWeight ?? 0, 0)} unit="g" color="yellow" loading={loading} />

      {/* Row 3 */}
      <KPICard label="Avg Rate / gram" value={fmt(data?.avgRatePerGram ?? 0)} unit="₹" color="blue" loading={loading} />
      <KPICard label="Avg Gold Value / Loan" value={fmt(data?.avgGoldValuePerLoan ?? 0)} unit="₹ L" color="blue" loading={loading} />
      <KPICard label="New Customers" value={fmtInt(data?.newCustomers ?? 0)} color="green" loading={loading} />
      <KPICard label="Closed Loans (Grams)" value={fmt(data?.closedLoansGrams ?? 0, 0)} unit="g" color="blue" loading={loading} />
    </div>
  );
}
