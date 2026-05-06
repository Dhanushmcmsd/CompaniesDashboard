"use client";

import { useEffect, useState } from "react";
import { usePeriod } from "@/context/PeriodContext";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface KPISet {
  gnpaAmount: number;
  gnpaPct: number;
  nnpaAmount: number;
  nnpaPct: number;
  sma0Count: number;
  sma0Amount: number;
  sma1Count: number;
  sma1Amount: number;
  sma2Count: number;
  sma2Amount: number;
}

interface ProductMixItem {
  name: string;
  value: number;
}

interface ApiResponse {
  kpis: KPISet;
  productMix: ProductMixItem[];
}

const COLORS = ["#2563eb", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444"];

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

export default function NPARiskSection() {
  const { period } = usePeriod();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/gold-loan/npa-risk?period=${period}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: ApiResponse) => { setData(d); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [period]);

  if (loading) return <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">Failed to load NPA data: {error}</div>;

  const k = data?.kpis;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="GNPA Amount" value={fmt2(k?.gnpaAmount ?? 0)} unit="₹ Cr" />
        <KPICard label="GNPA %" value={fmt2(k?.gnpaPct ?? 0)} unit="%" />
        <KPICard label="NNPA Amount" value={fmt2(k?.nnpaAmount ?? 0)} unit="₹ Cr" />
        <KPICard label="NNPA %" value={fmt2(k?.nnpaPct ?? 0)} unit="%" />

        <KPICard label="SMA-0 Count" value={String(k?.sma0Count ?? 0)} />
        <KPICard label="SMA-0 Amount" value={fmt2(k?.sma0Amount ?? 0)} unit="₹ Cr" />
        <KPICard label="SMA-1 Count" value={String(k?.sma1Count ?? 0)} />
        <KPICard label="SMA-1 Amount" value={fmt2(k?.sma1Amount ?? 0)} unit="₹ Cr" />

        <KPICard label="SMA-2 Count" value={String(k?.sma2Count ?? 0)} />
        <KPICard label="SMA-2 Amount" value={fmt2(k?.sma2Amount ?? 0)} unit="₹ Cr" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">AUM by Product Mix</p>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={data?.productMix ?? []} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
              {(data?.productMix ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => [`${v}%`, "Share"]} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
