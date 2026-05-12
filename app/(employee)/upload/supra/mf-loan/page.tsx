"use client";

import { useEffect, useRef, useState } from "react";

type UploadResult = {
  fileName:       string;
  fileType:       string;
  confidence:     string;
  matchedColumns: string[];
  missingColumns: string[];
  rowCount:       number;
  status:         string;
  errors:         string[];
};

type HistoryItem = {
  id:           string;
  fileType:     string;
  originalName: string;
  reportDate:   string | null;
  rowCount:     number;
  status:       string;
  uploadedBy:   string;
  uploadedAt:   string;
  errors:       unknown;
};

type Stage = "idle" | "uploading" | "done" | "error";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const STATUS_STYLES: Record<string, string> = {
  done:    "bg-green-100 text-green-800",
  error:   "bg-red-100 text-red-800",
  pending: "bg-yellow-100 text-yellow-800",
  noted:   "bg-blue-100 text-blue-800",
};

export default function MfLoanUploadPage() {
  const [files,      setFiles]      = useState<File[]>([]);
  const [stage,      setStage]      = useState<Stage>("idle");
  const [progress,   setProgress]   = useState(0);
  const [slowNotice, setSlowNotice] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [results,    setResults]    = useState<UploadResult[]>([]);
  const [history,    setHistory]    = useState<HistoryItem[]>([]);
  const xhrRef       = useRef<XMLHttpRequest | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadHistory() {
    try {
      const res  = await fetch("/api/upload/mf-loan/history", { cache: "no-store" });
      const data = await res.json();
      setHistory(data.batches ?? []);
    } catch {
      // silently ignore history load failure
    }
  }

  useEffect(() => { loadHistory(); }, []);

  function resetTransientState() {
    setProgress(0);
    setSlowNotice(false);
    setError(null);
  }

  function abortUpload() {
    xhrRef.current?.abort();
    xhrRef.current = null;
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    setStage("idle");
    resetTransientState();
  }

  function onUpload() {
    if (!files.length) return;
    setStage("uploading");
    setResults([]);
    resetTransientState();

    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", "/api/upload/mf-loan");
    xhr.responseType = "text";
    xhr.timeout = 120_000;

    slowTimerRef.current = setTimeout(() => setSlowNotice(true), 90_000);

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        setProgress(Math.max(1, Math.min(99, Math.round((evt.loaded / evt.total) * 100))));
      }
    };

    xhr.onload = async () => {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      try {
        let data: { results?: UploadResult[]; error?: string } = {};
        try { data = JSON.parse(xhr.responseText || "{}"); } catch {
          setStage("error");
          setError("Server returned invalid JSON");
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          setProgress(100);
          setResults(data.results ?? []);
          setStage("done");
          setFiles([]);
          if (fileInputRef.current) fileInputRef.current.value = '';
          await loadHistory();
        } else {
          setStage("error");
          setError(data.error ?? "Upload failed");
        }
      } finally {
        xhrRef.current = null;
      }
    };

    xhr.onerror   = () => { if (slowTimerRef.current) clearTimeout(slowTimerRef.current); xhrRef.current = null; setStage("error"); setError("Network error — please retry."); };
    xhr.ontimeout = () => { if (slowTimerRef.current) clearTimeout(slowTimerRef.current); xhrRef.current = null; setStage("error"); setError("Server timeout — please retry."); };
    xhr.onabort   = () => { if (slowTimerRef.current) clearTimeout(slowTimerRef.current); xhrRef.current = null; setStage("idle"); };

    xhr.send(fd);
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold text-[#0f172a]">Upload Portal — MF Loan</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload the <strong>Loan Balance Statement</strong> and/or <strong>Transaction Statement</strong>.
          The dashboard updates instantly after upload.
        </p>
      </header>

      {/* Column guide */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm">
          <p className="font-semibold text-blue-800 mb-2">📋 Balance Statement columns</p>
          <ul className="text-blue-700 space-y-1 text-xs list-disc list-inside">
            <li>Customer Number</li>
            <li>Principal Closing Balance</li>
            <li>Rate of Interest</li>
            <li>Disbursed Amount + Issue Date</li>
            <li>DPD (Days Past Due)</li>
            <li>Closing Principal Received + Closed On Date</li>
          </ul>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 text-sm">
          <p className="font-semibold text-purple-800 mb-2">📄 Transaction Statement columns</p>
          <ul className="text-purple-700 space-y-1 text-xs list-disc list-inside">
            <li>Transaction Date</li>
            <li>Principal Dr (disbursement)</li>
            <li>Total Received (collection)</li>
          </ul>
        </div>
      </div>

      {/* Upload area */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <label className="block border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 transition-colors">
          <p className="text-gray-700 font-medium">Click to select .xlsx / .xls files</p>
          <p className="text-xs text-gray-400 mt-1">Multiple files supported · Balance Statement &amp; Transaction Statement</p>
          <input
            ref={fileInputRef}
            type="file" multiple accept=".xlsx,.xls" className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </label>

        {!!files.length && (
          <ul className="space-y-2">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-gray-800">{f.name}</p>
                  <p className="text-xs text-gray-400">{formatBytes(f.size)}</p>
                </div>
                <button
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-red-500 hover:text-red-700 px-2 text-lg leading-none"
                >×</button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <button
            disabled={!files.length || stage === "uploading"}
            onClick={onUpload}
            className="bg-[#0f172a] text-white rounded-xl px-4 py-2 text-sm disabled:opacity-50 hover:bg-slate-700 transition-colors"
          >
            {stage === "uploading"
              ? `Uploading… ${progress}%`
              : `Upload & Process ${files.length} file${files.length !== 1 ? "s" : ""}`}
          </button>
          <button
            disabled={stage !== "uploading"}
            onClick={abortUpload}
            className="bg-gray-100 text-gray-700 rounded-xl px-4 py-2 text-sm disabled:opacity-50"
          >Abort / Reset</button>
        </div>

        {stage === "uploading" && (
          <div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-1">Uploading… {progress}%</p>
            {slowNotice && (
              <p className="text-xs text-amber-600 mt-1">Still working — large file is being processed server-side.</p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {!!results.length && (
          <ul className="space-y-2">
            {results.map((r, idx) => (
              <li
                key={idx}
                className={`rounded-lg border p-3 text-sm ${
                  r.status === "done" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                }`}
              >
                <p className="font-semibold text-gray-800">{r.fileName}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Detected: <strong>{r.fileType || "Unknown"}</strong>
                  {r.confidence && <> · Confidence: <strong>{r.confidence}</strong></>}
                  {" "}· Rows: <strong>{r.rowCount.toLocaleString("en-IN")}</strong>
                  {" "}· Status: <strong>{r.status}</strong>
                </p>
                {r.matchedColumns?.length > 0 && (
                  <p className="text-xs text-green-700 mt-0.5">✅ Matched: {r.matchedColumns.join(", ")}</p>
                )}
                {r.missingColumns?.length > 0 && (
                  <p className="text-xs text-yellow-700 mt-0.5">⚠️ Optional missing: {r.missingColumns.join(", ")}</p>
                )}
                {r.errors?.length > 0 && (
                  <ul className="mt-1 text-xs text-red-600 list-disc list-inside">
                    {r.errors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
                    {r.errors.length > 3 && <li>…and {r.errors.length - 3} more</li>}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Upload history */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-[#0f172a]">Recent Uploads</h2>
          <button onClick={loadHistory} className="text-xs text-blue-600 hover:underline">↻ Refresh</button>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">No uploads yet.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b text-gray-500 text-xs uppercase tracking-wide">
                  <th className="py-2 pr-3">File</th>
                  <th className="pr-3">Type</th>
                  <th className="pr-3">Rows</th>
                  <th className="pr-3">Status</th>
                  <th className="pr-3">Uploaded By</th>
                  <th>Uploaded At</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 pr-3 font-medium text-gray-800 max-w-[180px] truncate">{h.originalName}</td>
                    <td className="pr-3 text-gray-500 text-xs">{h.fileType}</td>
                    <td className="pr-3">{(h.rowCount ?? 0).toLocaleString("en-IN")}</td>
                    <td className="pr-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_STYLES[h.status] ?? "bg-gray-100 text-gray-600"
                      }`}>{h.status}</span>
                    </td>
                    <td className="pr-3 text-gray-500">{h.uploadedBy}</td>
                    <td className="text-gray-500 text-xs whitespace-nowrap">
                      {new Date(h.uploadedAt).toLocaleString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
