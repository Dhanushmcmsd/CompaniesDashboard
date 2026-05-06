"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type UploadResult = {
  fileName: string;
  fileType: string;
  rowCount: number;
  inserted: number;
  updated: number;
  errors: string[];
};

type HistoryItem = {
  id: string;
  fileType: string;
  originalName: string;
  reportDate: string | null;
  rowCount: number;
  inserted: number;
  updated: number;
  uploadedBy: string;
  uploadedAt: string;
};

type Stage = "idle" | "uploading" | "processing" | "done" | "error";

function detectTypeByFilename(name: string) {
  const n = name.toLowerCase();
  if (n.includes("balance")) return "Balance Statement";
  if (n.includes("transaction")) return "Transaction Statement";
  if (n.includes("interest")) return "Interest Extract";
  return "Unknown";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function GoldLoanUploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [slowNotice, setSlowNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadHistory() {
    const res = await fetch("/api/upload/gold-loan/history", { cache: "no-store" });
    const data = await res.json();
    setHistory(data.items ?? []);
  }

  useEffect(() => {
    loadHistory();
  }, []);

  const uploadLabel = useMemo(() => `Upload & Process ${files.length} files`, [files.length]);

  function resetTransientState() {
    setProgress(0);
    setSlowNotice(false);
    setError(null);
  }

  function abortUpload() {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    if (slowTimerRef.current) {
      clearTimeout(slowTimerRef.current);
      slowTimerRef.current = null;
    }
    setStage("idle");
    resetTransientState();
  }

  function onUpload() {
    if (!files.length) return;

    setStage("uploading");
    setResults([]);
    resetTransientState();

    const fd = new FormData();
    files.forEach((file) => fd.append("files", file));

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", "/api/upload/gold-loan");
    xhr.responseType = "text";
    xhr.timeout = 120000;

    slowTimerRef.current = setTimeout(() => {
      setSlowNotice(true);
    }, 90000);

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        const pct = Math.max(1, Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
        setProgress(pct);
      }
    };

    xhr.onloadstart = () => {
      setStage("uploading");
    };

    xhr.onload = async () => {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);

      try {
        let data: { results?: UploadResult[]; error?: string } = {};
        try {
          data = JSON.parse(xhr.responseText || "{}");
        } catch {
          setStage("error");
          setError("Server returned invalid JSON response");
          return;
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          setStage("processing");
          setProgress(100);
          setResults(data.results ?? []);
          setStage("done");
          setFiles([]);
          await loadHistory();
        } else {
          setStage("error");
          setError(data.error ?? "Upload failed");
        }
      } finally {
        xhrRef.current = null;
      }
    };

    xhr.onerror = () => {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      xhrRef.current = null;
      setStage("error");
      setError("Upload failed. Please check your network and retry.");
    };

    xhr.ontimeout = () => {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      xhrRef.current = null;
      setStage("error");
      setError("Server timeout while processing upload. Please retry.");
    };

    xhr.onabort = () => {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      xhrRef.current = null;
      setStage("idle");
    };

    xhr.send(fd);
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
            multiple
            accept=".xlsx"
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </label>

        {!!files.length && (
          <div className="mt-4 space-y-2">
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-gray-800">{f.name}</p>
                  <p className="text-xs text-gray-500">{formatBytes(f.size)} · {detectTypeByFilename(f.name)}</p>
                </div>
                <button onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-red-600 px-2">×</button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            disabled={!files.length || stage === "uploading" || stage === "processing"}
            onClick={onUpload}
            className="bg-[#0f172a] text-white rounded-xl px-4 py-2 disabled:opacity-50"
          >
            {uploadLabel}
          </button>
          <button
            disabled={stage !== "uploading" && stage !== "processing"}
            onClick={abortUpload}
            className="bg-gray-200 text-gray-800 rounded-xl px-4 py-2 disabled:opacity-50"
          >
            Abort / Reset
          </button>
        </div>

        {(stage === "uploading" || stage === "processing") && (
          <div className="mt-4">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-[#0f172a]" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-gray-600 mt-1">{stage === "uploading" ? `Uploading... ${progress}%` : "Processing..."}</p>
            {slowNotice && (
              <p className="text-xs text-amber-700 mt-1">Processing is taking longer than expected, but the server is still working.</p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        {!!results.length && (
          <div className="mt-4 space-y-2">
            {results.map((r, idx) => (
              <div key={`${r.fileName}-${idx}`} className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
                <p className="font-medium">{r.fileName}</p>
                <p className="text-xs text-gray-700">
                  {r.fileType} · rows: {r.rowCount.toLocaleString("en-IN")} · inserted: {r.inserted.toLocaleString("en-IN")} · updated: {r.updated.toLocaleString("en-IN")} · errors: {r.errors.length}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-[#0f172a] mb-3">Recent Uploads</h2>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">File Type</th>
                <th>Original File</th>
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
                  <td>{h.originalName}</td>
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
