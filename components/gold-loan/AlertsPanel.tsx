"use client";

import { useGoldLoanData } from "@/context/GoldLoanDataContext";

interface AlertItem {
  type: string;
  severity: "high" | "medium" | "low";
  message: string;
  count: number;
}

function fmt0(n: unknown) {
  const num = Number(n);
  return Number.isFinite(num) ? num.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "\u2014";
}

function severityClass(s: AlertItem["severity"]) {
  if (s === "high")   return "border-red-200 bg-red-50 text-red-800";
  if (s === "medium") return "border-orange-200 bg-orange-50 text-orange-800";
  return "border-yellow-200 bg-yellow-50 text-yellow-800";
}

function severityIcon(s: AlertItem["severity"]) {
  if (s === "high")   return "\uD83D\uDD34"; // 🔴
  if (s === "medium") return "\uD83D\uDFE1"; // 🟡
  return "\u2139\uFE0F"; // ℹ️
}

export default function AlertsPanel() {
  const { snapshot, isLoading: loading } = useGoldLoanData();
  const alerts = (snapshot?.alerts ?? []) as AlertItem[];

  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {[0,1,2,3].map((i) => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  );

  if (!alerts.length) return (
    <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-4 text-sm flex items-center gap-2">
      <span>\u2705</span> No alerts — all indicators within acceptable limits.
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {alerts.map((alert) => (
        <div
          key={alert.type}
          className={`rounded-xl border p-4 shadow-sm ${severityClass(alert.severity)}`}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl leading-none">{severityIcon(alert.severity)}</span>
            <div>
              <p className="text-sm font-bold leading-snug capitalize">
                {alert.type.replace(/-/g, " ")}
              </p>
              <p className="text-xs mt-2 leading-relaxed">{alert.message}</p>
              {alert.count > 0 && (
                <p className="text-xs mt-1 font-semibold">
                  Affected: {fmt0(alert.count)} account{alert.count !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
