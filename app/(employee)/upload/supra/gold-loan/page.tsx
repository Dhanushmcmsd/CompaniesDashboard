"use client";

import { useEffect, useMemo, useState } from "react";

type UploadResult = {
  fileName: string;
  fileType: string;
  reportDate: string | null;
  inserted: number;
  updated: number;
  errors: string[];
  rowCount: number;
};

type HistoryItem = {
  id: string;
  fileType: string;
  reportDate: string | null;
  rowCount: number;
  inserted: number;
  updated: number;
  uploadedBy: string;
  uploadedAt: string;
};

function prettyTypeFromName(name: string) {
  const n = name.toLowerCase();
  if (n.includes("balance") || n.includes("loan balance")) return "Balance Statement";
  if (n.includes("transaction")) return "Transaction Statement";
  if (n.includes("interest")) return "Interest Extract";
  return "Unknown";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function GoldLoanUploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  async function loadHistory() {
    const res = await fetch("/api/upload/gold-loan/history", { cache: "no-store" });
    const data = await res.json();
    setHistory(data.items ?? []);
  }

  useEffect(() => {
    loadHistory();
  }, []);

  const label = useMemo(() => `Upload & Process ${files.length} files`, [files.length]);

  async function onUpload() {
    if (!files.length) return;
    setUploading(true);
    setError(null);
    setResults([]);

    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files[]", f));
      const res = await fetch("/api/upload/gold-loan", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setResults(data.results ?? []);
      await loadHistory();
    } catch {
      setError("Upload failed due to network/server issue. Please retry.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="p-6 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-[#0f172a]">Upload Portal — Supra Pacific Gold Loan</h1>
        <p className="text-sm text-gray-500 mt-1">Upload one or more Excel statement files for processing</p>
      </header>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <label className="block border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-gray-400">
          <p className="text-gray-700 font-medium">Click to upload .xlsx files</p>
          <p className="text-xs text-gray-500 mt-1">Multiple files supported</p>
          <input
            type="file"
            accept=".xlsx"
            multiple
            className="hidden"
            onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
          />
        </label>

        {!!files.length && (
          <div className="mt-4 space-y-2">
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-gray-800">{f.name}</p>
                  <p className="text-xs text-gray-500">{formatBytes(f.size)} · {prettyTypeFromName(f.name)}</p>
                </div>
                <button
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-red-500 px-2"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          disabled={!files.length || uploading}
          onClick={onUpload}
          className="mt-4 bg-[#0f172a] text-white rounded-xl px-4 py-2 disabled:opacity-50"
        >
          {uploading ? "Uploading..." : label}
        </button>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {!!results.length && (
          <div className="mt-4 space-y-2">
            {results.map((r) => (
              <div key={r.fileName} className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm">
                <p>
                  ✅ {r.fileName} — {r.fileType} — ✓ {r.rowCount.toLocaleString("en-IN")} rows processed
                </p>
                <p className="text-xs text-gray-700">
                  (inserted: {r.inserted.toLocaleString("en-IN")} · updated: {r.updated.toLocaleString("en-IN")} · errors: {r.errors.length})
                </p>
                {!!r.errors.length && (
                  <ul className="text-xs text-red-700 mt-1 list-disc pl-5">
                    {r.errors.slice(0, 3).map((e, idx) => <li key={idx}>{e}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-[#0f172a] mb-3">Upload History</h2>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">File Type</th>
                <th>Report Date</th>
                <th>Rows</th>
                <th>Inserted</th>
                <th>Updated</th>
                <th>Uploaded By</th>
                <th>Uploaded At</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b">
                  <td className="py-2">{h.fileType}</td>
                  <td>{h.reportDate ? new Date(h.reportDate).toLocaleDateString("en-IN") : "-"}</td>
                  <td>{h.rowCount.toLocaleString("en-IN")}</td>
                  <td>{h.inserted.toLocaleString("en-IN")}</td>
                  <td>{h.updated.toLocaleString("en-IN")}</td>
                  <td>{h.uploadedBy}</td>
                  <td>{new Date(h.uploadedAt).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
