"use client";

import { useEffect, useState } from "react";
import { getParseMetaFromBatch, parseUploadErrors, type UploadParseMeta } from "@/lib/upload-errors";

type HistoryAlert = {
  id: string;
  originalName: string;
  fileType: string;
  status: string;
  uploadedAt: string;
  parseMeta: UploadParseMeta | null;
  errors: unknown;
};

export default function UploadAlertsPanel({
  portfolio,
  refreshKey,
}: {
  portfolio: "gold-loan" | "mf-loan";
  refreshKey?: number;
}) {
  const [items, setItems] = useState<HistoryAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const path =
          portfolio === "gold-loan"
            ? "/api/upload/gold-loan/history"
            : "/api/upload/mf-loan/history";
        const res = await fetch(path, { cache: "no-store" });
        const data = await res.json();
        const rows = (data.items ?? data.batches ?? []) as HistoryAlert[];
        if (!cancelled) {
          setItems(
            rows.filter((r) => {
              const meta = getParseMetaFromBatch(r);
              const errs = parseUploadErrors(r.errors).messages;
              const hasMissing =
                (meta?.missingColumns?.length ?? 0) > 0 ||
                (meta?.missingRequired?.length ?? 0) > 0;
              const hasError = r.status === "error" || r.status === "warning";
              return hasMissing || hasError || errs.some((e) => /missing|error/i.test(e));
            }),
          );
        }
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [portfolio, refreshKey]);

  if (loading) {
    return (
      <aside className="w-72 shrink-0 bg-white border border-gray-200 rounded-2xl p-4 h-fit sticky top-4">
        <p className="text-sm font-semibold text-[#0f172a]">Upload alerts</p>
        <div className="mt-3 h-24 animate-pulse bg-gray-100 rounded-lg" />
      </aside>
    );
  }

  if (!items.length) {
    return (
      <aside className="w-72 shrink-0 bg-white border border-gray-200 rounded-2xl p-4 h-fit sticky top-4">
        <p className="text-sm font-semibold text-[#0f172a]">Upload alerts</p>
        <p className="text-xs text-gray-500 mt-2">No column issues on recent uploads.</p>
      </aside>
    );
  }

  return (
    <aside className="w-72 shrink-0 bg-white border border-amber-200 rounded-2xl p-4 h-fit sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
      <p className="text-sm font-semibold text-amber-900">Upload alerts</p>
      <p className="text-xs text-amber-700 mt-0.5">Missing columns &amp; parse issues</p>
      <ul className="mt-3 space-y-3">
        {items.slice(0, 8).map((item) => {
          const meta = getParseMetaFromBatch(item) ?? {};
          const errs = parseUploadErrors(item.errors).messages;
          return (
            <li key={item.id} className="border border-amber-100 rounded-lg p-2.5 bg-amber-50/60 text-xs">
              <p className="font-medium text-gray-900 truncate" title={item.originalName}>
                {item.originalName}
              </p>
              <p className="text-gray-500 mt-0.5">
                {item.fileType} · {new Date(item.uploadedAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
              </p>
              {(meta.missingRequired?.length ?? 0) > 0 && (
                <p className="text-red-700 mt-1">
                  <span className="font-semibold">Required missing:</span>{" "}
                  {meta.missingRequired!.join(", ")}
                </p>
              )}
              {(meta.missingColumns?.length ?? 0) > 0 && (
                <p className="text-amber-800 mt-1">
                  <span className="font-semibold">Optional missing:</span>{" "}
                  {meta.missingColumns!.join(", ")}
                </p>
              )}
              {errs.length > 0 && (
                <p className="text-red-600 mt-1 line-clamp-2">{errs[0]}</p>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
