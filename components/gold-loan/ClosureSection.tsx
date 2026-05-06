"use client";

import { useEffect, useState } from "react";
import { usePeriod } from "@/context/PeriodContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
  PieChart, Pie, Cell, Legend,
} from "recharts";

interface ClosureData {
  totalClosures: number;
  totalGramsReleased: number;
  avgGramsPerClosure: number;
  byBranch: { branch: string; grams: number }[];
  monthlyTrend: { month: string; grams: number }[]; // last 6 months always
  byReason: { reason: string; count: number }[];
}

const REASON_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4",
];

function fmt2(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function ChartCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 ${className}`}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">{title}</p>
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[0,1,2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[0,1,2].map(i => <div key={i} className="h-56 bg-gray-100 rounded-xl" />)}
      </div>
    </div>
  );
}

// Custom label for donut chart
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
  cx: number; cy: number; midAngle: number;
  innerRadius: number; outerRadius: number; percent: number;
}) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 10, fill: "#fff", fontWeight: 700 }}>
      {(percent * 100).toFixed(0)}%
    </text>
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
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: ClosureData) => { setData(d); setLoading(false); })
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
      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KPIPill label="Total Closures" value={String(data?.totalClosures ?? 0)} />
        <KPIPill label="Total Grams Released" value={fmt2(data?.totalGramsReleased ?? 0)} unit="g" />
        <KPIPill label="Avg Grams / Closure" value={fmt2(data?.avgGramsPerClosure ?? 0)} unit="g" />
      </div>

      {/* 3 Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Chart 1: Grams Released by Branch — horizontal bars */}
        <ChartCard title="Grams Released by Branch">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={data?.byBranch ?? []}
              layout="vertical"
              margin={{ top: 0, right: 32, left: 8, bottom: 0 }}
              barCategoryGap="30%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v}g`} />
              <YAxis type="category" dataKey="branch" tick={{ fontSize: 10 }} width={64} />
              <Tooltip formatter={(v: number) => [`${fmt2(v)} g`, "Grams Released"]} />
              <Bar dataKey="grams" fill="#f59e0b" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="grams" position="right"
                  formatter={(v: number) => `${v.toFixed(0)}g`}
                  style={{ fontSize: 9, fill: "#6b7280" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 2: Closure Trend — last 6 months */}
        <ChartCard title="Closure Trend — Grams Released (6 Months)">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={data?.monthlyTrend ?? []}
              margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}g`} />
              <Tooltip formatter={(v: number) => [`${fmt2(v)} g`, "Grams"]} />
              <Line
                type="monotone" dataKey="grams"
                stroke="#f59e0b" strokeWidth={2}
                dot={{ r: 3, fill: "#f59e0b" }} activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 3: Closure Reason Split — Donut */}
        <ChartCard title="Closure Reason Split">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data?.byReason ?? []}
                dataKey="count"
                nameKey="reason"
                cx="50%" cy="45%"
                innerRadius={55} outerRadius={85}
                labelLine={false}
                label={PieLabel}
              >
                {(data?.byReason ?? []).map((_, i) => (
                  <Cell key={i} fill={REASON_COLORS[i % REASON_COLORS.length]} />
                ))}
              </Pie>
              <Legend
                iconType="circle" iconSize={8}
                wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
              />
              <Tooltip formatter={(v: number, name: string) => [v, name]} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>
    </div>
  );
}
