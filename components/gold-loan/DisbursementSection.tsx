'use client';

import { useEffect, useState } from 'react';
import { usePeriod } from '@/context/PeriodContext';
import {
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TrendPoint   { label: string; amount: number }
interface BranchPoint  { branch: string; disbursement: number; target: number }
interface DvCData      { disbursement: number; collection: number }

const CHART_H = 260;

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow p-4 flex-1 min-w-0">
      <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Skeleton() {
  return <div className="animate-pulse bg-gray-100 rounded" style={{ height: CHART_H }} />;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DisbursementSection() {
  const { period } = usePeriod();

  const [trend,   setTrend]   = useState<TrendPoint[]  | null>(null);
  const [branch,  setBranch]  = useState<BranchPoint[] | null>(null);
  const [dvc,     setDvc]     = useState<DvCData        | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/dashboard/gold-loan/disbursement-trend?period=${period}`).then((r) => r.json()),
      fetch(`/api/dashboard/gold-loan/branch-disbursement?period=${period}`).then((r) => r.json()),
      fetch(`/api/dashboard/gold-loan/disb-vs-collection?period=${period}`).then((r) => r.json()),
    ]).then(([t, b, d]) => {
      setTrend(t.data);
      setBranch(b.data);
      setDvc(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [period]);

  const dvcBarData = dvc
    ? [{ name: period, Disbursement: dvc.disbursement, Collection: dvc.collection }]
    : [];

  return (
    <div className="flex flex-col lg:flex-row gap-4">

      {/* Chart 1 — Daily Trend */}
      <ChartCard title="Daily Disbursement Trend (₹ Cr)">
        {loading || !trend ? <Skeleton /> : (
          <ResponsiveContainer width="100%" height={CHART_H}>
            <LineChart data={trend} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [`₹${v} Cr`, 'Disbursement']} />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Disbursement"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Chart 2 — Branch-wise Disbursement vs Target */}
      <ChartCard title="Disbursement vs Target — Branch-wise">
        {loading || !branch ? <Skeleton /> : (
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart data={branch} margin={{ top: 4, right: 12, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="branch" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `₹${v} Cr`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="disbursement" fill="#3b82f6" name="Disbursement" radius={[2, 2, 0, 0]} />
              <Bar dataKey="target"       fill="#d1d5db" name="Target"       radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Chart 3 — Disbursement vs Collection */}
      <ChartCard title="Disbursement vs Collection (₹ Cr)">
        {loading || !dvc ? <Skeleton /> : (
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart data={dvcBarData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `₹${v} Cr`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Disbursement" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Collection"   fill="#22c55e" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

    </div>
  );
}
