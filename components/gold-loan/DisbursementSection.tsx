"use client";

import { useEffect, useState } from "react";
import { usePeriod } from "@/context/PeriodContext";
import type { Period } from "@/context/PeriodContext";
import {
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TrendPoint { label: string; amount: number; }
interface BranchDisb  { branch: string; disbursement: number; target: number; }
interface DisbVsColl  { label: string; disbursement: number; collection: number; }

// ─── Shared fetch hook ────────────────────────────────────────────────────────
function useApiData<T>(url: string, period: Period) {
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${url}?period=${period}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: T) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [url, period]);

  return { data, loading, error };
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function ChartSkeleton() {
  return (
    <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200 animate-pulse">
      <span className="text-gray-300 text-sm">Loading chart…</span>
    </div>
  );
}

function ChartError({ msg }: { msg: string }) {
  return (
    <div className="h-64 flex items-center justify-center bg-red-50 rounded-xl border border-red-200">
      <span className="text-red-500 text-sm">Error: {msg}</span>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{title}</p>
      {children}
    </div>
  );
}

// ─── Chart 1: Daily Disbursement Trend ───────────────────────────────────────
function DisbursementTrendChart() {
  const { period } = usePeriod();
  const { data, loading, error } = useApiData<TrendPoint[]>(
    "/api/dashboard/gold-loan/disbursement-trend", period
  );

  return (
    <ChartCard title="Daily Disbursement Trend (₹ Cr)">
      {loading ? <ChartSkeleton /> : error ? <ChartError msg={error} /> : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data ?? []} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
            <Tooltip formatter={(v: number) => [`₹${v} Cr`, "Disbursement"]} />
            <Line
              type="monotone"
              dataKey="amount"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3, fill: "#3b82f6" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

// ─── Chart 2: Branch-wise Disbursement vs Target ──────────────────────────────
function BranchDisbursementChart() {
  const { period } = usePeriod();
  const { data, loading, error } = useApiData<BranchDisb[]>(
    "/api/dashboard/gold-loan/branch-disbursement", period
  );

  return (
    <ChartCard title="Disbursement vs Target — Branch-wise">
      {loading ? <ChartSkeleton /> : error ? <ChartError msg={error} /> : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data ?? []} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="branch" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
            <Tooltip formatter={(v: number, name: string) => [`₹${v} Cr`, name]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="disbursement" name="Disbursement" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="target" name="Target" fill="#d1d5db" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

// ─── Chart 3: Disbursement vs Collection ─────────────────────────────────────
function DisbVsCollectionChart() {
  const { period } = usePeriod();
  const { data, loading, error } = useApiData<DisbVsColl[]>(
    "/api/dashboard/gold-loan/disb-vs-collection", period
  );

  return (
    <ChartCard title="Disbursement vs Collection (₹ Cr)">
      {loading ? <ChartSkeleton /> : error ? <ChartError msg={error} /> : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data ?? []} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
            <Tooltip formatter={(v: number, name: string) => [`₹${v} Cr`, name]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="disbursement" name="Disbursement" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="collection" name="Collection" fill="#22c55e" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

// ─── Main Section Export ──────────────────────────────────────────────────────
export default function DisbursementSection() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <DisbursementTrendChart />
      <BranchDisbursementChart />
      <DisbVsCollectionChart />
    </div>
  );
}
