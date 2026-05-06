"use client";

import { useEffect, useState } from "react";
import { usePeriod } from "@/context/PeriodContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from "recharts";

interface NewCustomersData {
  count: number;
  disbursementAmount: number; // ₹ Cr
  avgTicketSize: number;      // ₹ L
  byBranch: { branch: string; count: number }[];
}

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

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[0,1,2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
      </div>
      <div className="h-56 bg-gray-100 rounded-xl" />
    </div>
  );
}

export default function NewCustomersSection() {
  const { period } = usePeriod();
  const [data, setData]       = useState<NewCustomersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    fetch(`/api/dashboard/gold-loan/new-customers?period=${period}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: NewCustomersData) => { setData(d); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [period]);

  if (loading) return <Skeleton />;
  if (error) return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
      Failed to load new customer data: {error}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* KPI Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KPIPill label="New Customers" value={String(data?.count ?? 0)} />
        <KPIPill label="New Disbursement" value={fmt2(data?.disbursementAmount ?? 0)} unit="₹ Cr" />
        <KPIPill label="Avg New Ticket Size" value={fmt2(data?.avgTicketSize ?? 0)} unit="₹ L" />
      </div>

      {/* Bar Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
          New Customers — Branch-wise Acquisition
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={data?.byBranch ?? []}
            margin={{ top: 4, right: 20, left: 0, bottom: 4 }}
            barCategoryGap="35%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="branch" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip formatter={(v: number) => [v, "New Customers"]} />
            <Bar dataKey="count" name="New Customers" fill="#14b8a6" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="count" position="top" style={{ fontSize: 10, fill: "#6b7280" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
