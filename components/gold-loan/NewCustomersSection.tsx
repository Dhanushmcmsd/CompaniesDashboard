"use client";

import { useEffect, useState } from "react";
import { usePeriod } from "@/context/PeriodContext";

interface NewCustomerData {
  totalCustomers: number;
  totalAccounts: number;
  newCustomers: number | string;
  mtdDisbursements: number;
}

function fmt0(n: unknown) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "\u2014";
  return num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function fmt2(n: unknown) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "\u2014";
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Pill({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#0f172a] leading-none">
        {value}{unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

export default function NewCustomersSection() {
  const { period } = usePeriod();
  const [data, setData]       = useState<NewCustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    fetch(`/api/dashboard/gold-loan/new-customers?period=${period}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [period]);

  if (loading) return <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />;
  if (error)   return <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">Failed to load new customer data: {error}</div>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Pill label="Total Customers"   value={fmt0(data?.totalCustomers)} />
      <Pill label="Total Accounts"    value={fmt0(data?.totalAccounts)} />
      <Pill label="MTD Disbursements" value={fmt2(data?.mtdDisbursements)} unit="\u20b9 Cr" />
      <Pill
        label="New Today"
        value={typeof data?.newCustomers === "number" ? fmt0(data.newCustomers) : "\u2014"}
      />
    </div>
  );
}
