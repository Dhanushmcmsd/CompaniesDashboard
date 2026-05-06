"use client";

import { useEffect, useMemo, useState } from "react";
import { usePeriod } from "@/context/PeriodContext";

interface BranchRow {
  branch: string;
  aum: number;
  accounts: number;
  gnpaPct: number;
  gnpaAmount: number;
  totalGoldWeight: number;
  avgGoldPerLoan: number;
  mtdDisb: number;
  ytdDisb: number;
}

type SortKey = keyof BranchRow;

function fmt2(n: unknown) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmt0(n: unknown) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function npaBadge(v: number) {
  return v > 2 ? "bg-red-100 text-red-700" : v > 0 ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700";
}

export default function BranchPerformanceTable() {
  const { period } = usePeriod();
  const [rows, setRows]     = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("aum");
  const [sortDir, setSortDir] = useState<"asc" | "desc": 