'use client';

import { useState, useRef } from 'react';
import { useSession }       from 'next-auth/react';

type ParseResult = {
  fileName:       string;
  fileType:       string;
  detectedVia:    string;
  confidence:     string;
  matchedColumns: string[];
  missingColumns: string[];
  rowCount:       number;
  status:         string;
  errors:         string[];
};

type UploadPhase = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

export default function MfLoanUploadPage() {
  const { data }                        = useSession();
  const [files, setFiles]               = useState<File[]>([]);
  const [phase, setPhase]               = useState<UploadPhase>('idle');
  const [uploadPct, setUploadPct]       = useState(0);
  const [results, setResults]           = useState<ParseResult[] | null>(null);
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);
  const [dragOver, setDragOver]         = useState(false);
  const inputRef                        = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files)
      .filter((f) => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'));
    setFiles((prev) => [...prev, ...dropped]);
  }

  async function handleUpload() {
    if (!files.length) return;
    setPhase('uploading');
    setUploadPct(0);
    setResults(null);
    setErrorMsg(null);

    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));

    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();

      // Phase 1: track actual byte-upload progress (maps to 0–90%)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          // Cap at 90 — last 10% reserved for server-side processing
          setUploadPct(Math.min(90, Math.round((e.loaded / e.total) * 90)));
        }
      };

      // Phase 1 complete — bytes received by server, now processing
      xhr.upload.onload = () => {
        setUploadPct(90);
        setPhase('processing');
      };

      // Phase 2: server responded — parsing + DB write done
      xhr.onload = () => {
        setUploadPct(100);
        try {
          const resp = JSON.parse(xhr.responseText);
          if (xhr.status >= 400) {
            setErrorMsg(resp.error ?? 'Server error');
            setPhase('error');
          } else {
            setResults(resp.results ?? []);
            setPhase('done');
            setFiles([]);
          }
        } catch {
          setErrorMsg('Unexpected server response');
          setPhase('error');
        }
        resolve();
      };

      xhr.onerror = () => {
        setErrorMsg('Network error — check your connection and try again');
        setPhase('error');
        resolve();
      };

      xhr.ontimeout = () => {
        setErrorMsg('Request timed out — file may be too large');
        setPhase('error');
        resolve();
      };

      xhr.timeout = 120_000; // 2 min max
      xhr.open('POST', '/api/upload/mf-loan');
      xhr.send(fd);
    });
  }

  const isUploading = phase === 'uploading' || phase === 'processing';
  const barWidth    = phase === 'done' ? 100 : uploadPct;
  const barColor    = phase === 'error' ? 'bg-red-500' : phase === 'done' ? 'bg-green-500' : 'bg-blue-500';

  function statusLabel() {
    if (phase === 'uploading')   return `Uploading… ${uploadPct}%`;
    if (phase === 'processing')  return 'Processing… (parsing Excel & saving)';
    if (phase === 'done')        return 'Upload complete ✔';
    if (phase === 'error')       return 'Upload failed';
    return files.length > 0
      ? `Upload ${files.length} file${files.length > 1 ? 's' : ''}`
      : 'Select files to upload';
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0f172a]">MF Loan — Upload Statements</h1>
        <p className="text-sm text-gray-500 mt-1">
          {data?.user?.company} · {data?.user?.name}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Upload Balance Statement and/or Transaction Statement.
          <strong className="text-gray-600"> File names don’t matter</strong> —
          file type is auto-detected from column headers.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors ${
          isUploading
            ? 'opacity-40 cursor-not-allowed border-gray-200'
            : dragOver
              ? 'border-blue-400 bg-blue-50 cursor-pointer'
              : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 cursor-pointer'
        }`}
      >
        <p className="text-gray-500 text-sm">
          {isUploading
            ? phase === 'processing'
              ? '⏳ Parsing Excel and saving to database…'
              : '↑ Uploading files…'
            : 'Drag & drop .xlsx files here, or click to browse'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          className="hidden"
          onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
        />
      </div>

      {/* Selected files */}
      {files.length > 0 && !isUploading && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-2 text-sm">
              <span className="text-gray-700 truncate">{f.name}</span>
              <button
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                className="text-red-400 hover:text-red-600 text-xs ml-3 shrink-0"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={isUploading || !files.length}
        className={`w-full rounded-xl py-3 text-sm font-semibold transition-all ${
          isUploading
            ? 'bg-blue-400 text-white cursor-wait'
            : phase === 'done'
              ? 'bg-green-600 text-white'
              : phase === 'error'
                ? 'bg-red-600 text-white'
                : files.length
                  ? 'bg-[#0f172a] hover:bg-[#1e3a5f] text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        {statusLabel()}
      </button>

      {/* Progress bar */}
      {(isUploading || phase === 'done' || phase === 'error') && (
        <div className="space-y-1">
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${barColor} ${
                phase === 'processing' ? 'animate-pulse' : ''
              }`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 text-right">
            {phase === 'uploading'  && `File transfer: ${uploadPct}% — waiting for server to process…`}
            {phase === 'processing' && '⏳ Server is parsing the Excel file and computing KPIs…'}
            {phase === 'done'       && '✅ All done!'}
            {phase === 'error'      && '❌ Upload failed — see error below'}
          </p>
        </div>
      )}

      {/* Error message */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-700 font-medium">{errorMsg}</p>
        </div>
      )}

      {/* Results */}
      {results && results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Upload Results</h2>
          {results.map((r, i) => (
            <div
              key={i}
              className={`rounded-2xl border p-4 space-y-3 ${
                r.status === 'done' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-800 truncate">{r.fileName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Detected as <strong>{r.fileType}</strong>
                    {' '}· via <span className="italic">{r.detectedVia}</span>
                    {' '}·{' '}
                    <span className={r.confidence === 'high' ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>
                      {r.confidence} confidence
                    </span>
                    {' '}· {r.rowCount.toLocaleString()} rows parsed
                  </p>
                </div>
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold ${
                  r.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {r.status}
                </span>
              </div>

              {r.matchedColumns.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">✅ Columns matched:</p>
                  <div className="flex flex-wrap gap-1">
                    {r.matchedColumns.map((c) => (
                      <span key={c} className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {r.missingColumns.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">⚠️ Not found (default to 0):</p>
                  <div className="flex flex-wrap gap-1">
                    {r.missingColumns.map((c) => (
                      <span key={c} className="text-xs bg-yellow-100 text-yellow-700 rounded-full px-2 py-0.5">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {r.errors.filter((e) => !e.startsWith('Optional')).map((e, j) => (
                <p key={j} className="text-xs text-red-600 bg-red-100 rounded px-2 py-1">{e}</p>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
