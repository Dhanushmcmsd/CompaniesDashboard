"use client";

import { useEffect, useState } from "react";
import { usePeriod } from "@/context/PeriodContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
  ResponsiveContainer,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────
interface BucketData {
  bucket: "0-30" | "31-60" | "61-90" | "90+";
  amount: number;   // ₹ Cr
  pct: number;      // % of total AUM
}

interface OverdueResponse {
  buckets: BucketData[];
  totalOverdue: number;         // ₹ Cr
  overdueOfAUM: number;         // %
  overdueCollected: number;     // ₹ Cr
  collectionEfficiency: number; // %
}

// ─── Bucket colour palette ──────────────────────────────────────────────────────
const BUCKET_COLORS: Record<string, string> = {
  "0-30":  "#facc15",  // yellow
  "31-60": "#f97316",  // orange
  "61-90": "#ef4444",  // red-orange
  "90+":   "#991b1b",  // deep red
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmt2(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function BucketTooltip({ active, payload }: { active?: boolean; payload?: { payload: BucketData }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-lg px-3 py-2 text-xs">
      <p className="font-bold text-gray-700 mb-1">DPD {d.bucket} days</p>
      <p>Amount: <span className="font-semibold">₹{fmt2(d.amount)} Cr</span></p>
      <p>% of AUM: <span className="font-semibold">{fmt2(d.pct)}%</span></p>
    </div>
  );
}

// ─── Summary stat pill ──────────────────────────────────────────────────────────
function StatPill({
  label, value, unit, highlight,
}: {
  label: string;
  value: string;
  unit?: string;
  highlight?: "red" | "green" | "yellow";
}) {
  const bg = highlight === "red"
    ? "bg-red-50 border-red-200"
    : highlight === "green"
    ? "bg-green-50 border-green-200"
    : highlight === "yellow"
    ? "bg-yellow-50 border-yellow-200"
    : "bg-white border-gray-100";

  const textColor = highlight === "red"
    ? "text-red-700"
    : highlight === "green"
    ? "text-green-700"
    : highlight === "yellow"
    ? "text-yellow-700"
    : "text-[#0f172a]";

  return (
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${bg}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-bold leading-none ${textColor}`}>
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-56 bg-gray-100 rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
      </div>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────────
export default function OverdueSection() {
  const { period } = usePeriod();
  const [data, setData]       = useState<OverdueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/dashboard/gold-loan/overdue-buckets?period=${period}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: OverdueResponse) => { setData(d); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [period]);

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
        Failed to load overdue data: {error}
      </div>
    );
  }

  const buckets = data?.buckets ?? [];
  const collEffColor =
    (data?.collectionEfficiency ?? 0) >= 90 ? "green"
    : (data?.collectionEfficiency ?? 0) >= 75 ? "yellow"
    : "red";

  return (
    <div className="space-y-4">

      {/* Sub-heading */}
      <p className="text-sm font-semibold text-gray-600 tracking-wide">
        Bucket-wise Overdue Analysis
      </p>

      {/* ── Bar Chart ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={buckets}
            margin={{ top: 16, right: 24, left: 8, bottom: 4 }}
            barCategoryGap="35%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="bucket"
              tickFormatter={(v) => `DPD ${v}`}
              tick={{ fontSize: 12, fontWeight: 600 }}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `₹${v}`}
              label={{
                value: "₹ Cr",
                angle: -90,
                position: "insideLeft",
                offset: -4,
                style: { fontSize: 10, fill: "#9ca3af" },
              }}
            />
            <Tooltip content={<BucketTooltip />} />
            <Bar dataKey="amount" name="Overdue (₹ Cr)" radius={[5, 5, 0, 0]}>
              {buckets.map((b) => (
                <Cell key={b.bucket} fill={BUCKET_COLORS[b.bucket]} />
              ))}
              {/* % of AUM label above each bar */}
              <LabelList
                dataKey="pct"
                position="top"
                formatter={(v: number) => `${v.toFixed(1)}%`}
                style={{ fontSize: 10, fill: "#6b7280", fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Colour legend */}
        <div className="flex flex-wrap gap-4 mt-2 px-2">
          {Object.entries(BUCKET_COLORS).map(([label, color]) => (
            <span key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: color }} />
              DPD {label} days
            </span>
          ))}
        </div>
      </div>

      {/* ── Summary Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatPill
          label="Total Overdue"
          value={fmt2(data?.totalOverdue ?? 0)}
          unit="₹ Cr"
          highlight="red"
        />
        <StatPill
          label="Overdue % of AUM"
          value={fmt2(data?.overdueOfAUM ?? 0)}
          unit="%"
          highlight={(data?.overdueOfAUM ?? 0) > 5 ? "red" : "yellow"}
        />
        <StatPill
          label="Overdue Collected"
          value={fmt2(data?.overdueCollected ?? 0)}
          unit="₹ Cr"
          highlight="green"
        />
        <StatPill
          label="Collection Efficiency"
          value={fmt2(data?.collectionEfficiency ?? 0)}
          unit="%"
          highlight={collEffColor}
        />
      </div>
    </div>
  );
}
