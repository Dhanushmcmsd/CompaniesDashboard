"use client";

import { useEffect, useState } from "react";
import { usePeriod } from "@/context/PeriodContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
  PieChart, Pie, Cell, Legend,
  LabelList,
} from "recharts";

interface ClosureData {
  totalGoldWeight: number;
  avgGoldWeightPerLoan: number;
  closedGrams: null;
  note: string;
}

const REASON_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4",
];

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

function KPIPill({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#0f172a] leading-none">
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
      </div>
    </div>
  );
}

export default function ClosureSection() {
  const { period } = usePeriod();
  const [data, setData]       = useState<ClosureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    fetch(`/api/dashboard/gold-loan/closures?period=${period}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [period]);

  if (loading) return <Skeleton />;
  if (error) return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
      Failed to load closure data: {error}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <KPIPill
          label="Total Gold on Book"
          value={fmt0(data?.totalGoldWeight)}
          unit="g"
        />
        <KPIPill
          label="Avg Gold / Loan"
          value={fmt2(data?.avgGoldWeightPerLoan)}
          unit="g"
        />
      </div>

      {data?.note && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-xl px-4 py-3">
          ℹ️  {data.note}
        </div>
      )}
    </div>
  );
}
