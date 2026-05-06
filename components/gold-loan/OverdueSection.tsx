"use client";

import { useEffect, useState } from "react";
import { usePeriod } from "@/context/PeriodContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface BucketItem {
  label: string;
  amount: number;
  pct: number;
}

interface OverdueData {
  buckets: BucketItem[];
  totalOverdue: number;
  overduePercent: number;
  overdueCollection: number;
  collectionEfficiency: number;
}

const BUCKET_COLORS = ["#f59e0b", "#f97316", "#ef4444", "#7f1d1d"];

function fmt2(n: unknown) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "\u2014";
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function KPIPill({ label, value, unit, color = "" }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold leading-none ${color}`}>
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

export default function OverdueSection() {
  const { period } = usePeriod();
  const [data, setData]       = useState<OverdueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    fetch(`/api/dashboard/gold-loan/overdue-buckets?period=${period}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [period]);

  if (loading) return <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />;
  if (error)   return <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">Failed to load overdue data: {error}</div>;
  if (!data)   return null;

  const buckets = Array.isArray(data.buckets) ? data.buckets : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPIPill label="Total Overdue"        value={fmt2(data.totalOverdue)}       unit="\u20b9 Cr" />
        <KPIPill label="Overdue %"            value={fmt2(data.overduePercent)}     unit="%" />
        <KPIPill label="Collection Received" value={fmt2(data.overdueCollection)}  unit="\u20b9 Cr" />
        <KPIPill
          label="Collection Efficiency"
          value={fmt2(data.collectionEfficiency)}
          unit="%"
          color={(data.collectionEfficiency ?? 0) >= 90 ? "text-green-600" : (data.collectionEfficiency ?? 0) >= 75 ? "text-yellow-600" : "text-red-600"}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">DPD Bucket Breakdown</p>
        {buckets.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No overdue data — upload a Balance Statement.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={buckets} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v} Cr`} />
              <Tooltip formatter={(v: number) => [`\u20b9 ${fmt2(v)} Cr`, "Amount"]} />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {buckets.map((_, i) => <Cell key={i} fill={BUCKET_COLORS[i % BUCKET_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
