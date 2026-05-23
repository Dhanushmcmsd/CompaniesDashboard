"use client";

import { Fragment, useEffect, useState } from "react";
import { getParseMetaFromBatch, parseUploadErrors, type UploadParseMeta } from "@/lib/upload-errors";

type UploadLogItem = {
  id: string;
  company: string;
  portfolio: string;
  fileType: string;
  originalName: string;
  reportDate: string | null;
  rowCount: number;
  status: string;
  uploadedBy: string;
  uploadedAt: string;
  errors: unknown;
  parseMeta: UploadParseMeta | null;
};

const STATUS_STYLES: Record<string, string> = {
  done:    "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  error:   "bg-red-100 text-red-800",
  pending: "bg-yellow-100 text-yellow-800",
  noted:   "bg-blue-100 text-blue-800",
};

export default function UploadLogsSection() {
  const [items, setItems] = useState<UploadLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [portfolio, setPortfolio] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const qs = portfolio ? `?portfolio=${encodeURIComponent(portfolio)}&limit=50` : "?limit=50";
    const res = await fetch(`/api/admin/uploads${qs}`, { cache: "no-store" });
    const data = await res.json();
    setItems((data.items ?? []) as UploadLogItem[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [portfolio]);

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[#0f172a] text-lg">Employee Upload Logs</h2>
          <p className="text-xs text-gray-500 mt-0.5">Parse status, missing columns, and errors per file</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={portfolio}
            onChange={(e) => setPortfolio(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
          >
            <option value="">All portfolios</option>
            <option value="gold-loan">Gold Loan</option>
            <option value="mf-loan">MF Loan</option>
          </select>
          <button onClick={load} className="text-sm text-blue-600 hover:underline px-2">
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-32 animate-pulse bg-gray-100 rounded-xl" />
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No uploads recorded yet.</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b text-gray-500 text-xs uppercase tracking-wide">
                <th className="py-2 pr-2">File</th>
                <th className="pr-2">Portfolio</th>
                <th className="pr-2">Employee</th>
                <th className="pr-2">Rows</th>
                <th className="pr-2">Status</th>
                <th className="pr-2">Uploaded</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const meta = getParseMetaFromBatch(item) ?? {};
                const missing = [
                  ...(meta.missingRequired ?? []),
                  ...(meta.missingColumns ?? []),
                ];
                const errs = parseUploadErrors(item.errors).messages;
                const expanded = expandedId === item.id;

                return (
                  <Fragment key={item.id}>
                    <tr className="border-b align-top hover:bg-gray-50">
                      <td className="py-2 pr-2 max-w-[200px]">
                        <p className="font-medium text-gray-900 truncate" title={item.originalName}>
                          {item.originalName}
                        </p>
                        <p className="text-xs text-gray-500">{item.fileType}</p>
                      </td>
                      <td className="pr-2 text-gray-600">{item.portfolio}</td>
                      <td className="pr-2 text-gray-600 text-xs">{item.uploadedBy}</td>
                      <td className="pr-2">{item.rowCount.toLocaleString("en-IN")}</td>
                      <td className="pr-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_STYLES[item.status] ?? "bg-gray-100 text-gray-600"
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="pr-2 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(item.uploadedAt).toLocaleString("en-IN")}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : item.id)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {expanded ? "Hide" : "View"}
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-slate-50 border-b">
                        <td colSpan={7} className="py-3 px-2 text-xs space-y-2">
                          {(meta.matchedColumns?.length ?? 0) > 0 && (
                            <p className="text-green-800">
                              <span className="font-semibold">Matched columns:</span>{" "}
                              {meta.matchedColumns!.join(", ")}
                            </p>
                          )}
                          {(meta.missingRequired?.length ?? 0) > 0 && (
                            <p className="text-red-700">
                              <span className="font-semibold">Required missing:</span>{" "}
                              {meta.missingRequired!.join(", ")}
                            </p>
                          )}
                          {(meta.missingColumns?.length ?? 0) > 0 && (
                            <p className="text-amber-800">
                              <span className="font-semibold">Optional missing (KPIs may be 0):</span>{" "}
                              {meta.missingColumns!.join(", ")}
                            </p>
                          )}
                          {!missing.length && !errs.length && (
                            <p className="text-gray-600">No missing columns or errors for this upload.</p>
                          )}
                          {errs.length > 0 && (
                            <ul className="text-red-700 list-disc list-inside">
                              {errs.map((e, i) => (
                                <li key={i}>{e}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
