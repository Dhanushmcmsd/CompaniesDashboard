"use client";

import { useEffect, useState } from "react";
import { usePeriod } from "@/context/PeriodContext";

interface AlertItem {
  key: string;
  icon: string;
  title: string;
  count: number;
  amount: number;
  severity: "red" | "orange" | "yellow";
  href?: string;
}

function fmt2(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function severityClass(severity: AlertItem["severity"]) {
  if (severity === "red") return "border-red-200 bg-red-50 text-red-700";
  if (severity === "orange") return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-yellow-200 bg-yellow-50 text-yellow-700";
}

export default function AlertsPanel() {
  const { period } = usePeriod();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/gold-loan/alerts?period=${period}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: AlertItem[]) => { setAlerts(d); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [period]);

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">{[0,1,2,3,4].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}</div>;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">Failed to load alerts: {error}</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
      {alerts.map(alert => {
        const card = (
          <div className={`rounded-xl border p-4 shadow-sm h-full ${severityClass(alert.severity)}`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none">{alert.icon}</span>
              <div>
                <p className="text-sm font-bold leading-snug">{alert.title}</p>
                <p className="text-xs mt-2">Affected accounts: <span className="font-semibold">{alert.count}</span></p>
                <p className="text-xs mt-1">Amount at risk: <span className="font-semibold">₹ {fmt2(alert.amount)} Cr</span></p>
              </div>
            </div>
          </div>
        );

        return alert.href ? (
          <a key={alert.key} href={alert.href} className="block hover:opacity-90 transition-opacity">{card}</a>
        ) : (
          <div key={alert.key}>{card}</div>
        );
      })}
    </div>
  );
}
