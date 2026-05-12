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

export default function MfLoanUploadPage() {
  const { data }                      = useSession();
  const [files, setFiles]             = useState<File[]>([]);
  const [uploading, setUploading]     = useState(false);
  const [progress, setProgress]       = useState(0);
  const [results, setResults]         = useState<ParseResult[] | null>(null);
  const [dragOver, setDragOver]       = useState(false);
  const inputRef                      = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'));
    setFiles((prev) => [...prev, ...dropped]);
  }

  async function handleUpload() {
    if (!files.length) return;
    setUploading(true);
    setProgress(0);
    setResults(null);

    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));

    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        const data = JSON.parse(xhr.responseText);
        setResults(data.results ?? []);
        setUploading(false);
        setFiles([]);
        resolve();
      };
      xhr.onerror = () => { setUploading(false); resolve(); };
      xhr.open('POST', '/api/upload/mf-loan');
      xhr.send(fd);
    });
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0f172a]">MF Loan — Upload Statements</h1>
        <p className="text-sm text-gray-500 mt-1">{data?.user?.company} · {data?.user?.name}</p>
        <p className="text-xs text-gray-400 mt-1">
          Upload Balance Statement and/or Transaction Statement.
          <strong className="text-gray-600"> File names don’t matter</strong> — file type is auto-detected from column headers.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
        }`}
      >
        <p className="text-gray-500 text-sm">Drag & drop .xlsx files here, or click to browse</p>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" multiple className="hidden"
          onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
        />
      </div>

      {/* Selected files list */}
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-2 text-sm">
              <span className="text-gray-700">{f.name}</span>
              <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
            </li>
          ))}
        </ul>
      )}

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={uploading || !files.length}
        className="w-full bg-[#0f172a] text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40 hover:bg-[#1e3a5f] transition"
      >
        {uploading ? `Uploading… ${progress}%` : `Upload ${files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : ''}`}
      </button>

      {uploading && (
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Upload Results</h2>
          {results.map((r, i) => (
            <div key={i} className={`rounded-2xl border p-4 space-y-2 ${
              r.status === 'done' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm text-gray-800">{r.fileName}</p>
                  <p className="text-xs text-gray-500">
                    Detected as <strong>{r.fileType}</strong> via <span className="italic">{r.detectedVia}</span>
                    {' '}· <span className={r.confidence === 'high' ? 'text-green-600' : 'text-yellow-600'}>{r.confidence} confidence</span>
                    {' '}· {r.rowCount} rows
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  r.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>{r.status}</span>
              </div>

              {/* Matched columns */}
              {r.matchedColumns.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">✅ Matched columns:</p>
                  <div className="flex flex-wrap gap-1">
                    {r.matchedColumns.map((c) => (
                      <span key={c} className="text-xs bg-green-100 text-green-700 rounded px-2 py-0.5">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing columns */}
              {r.missingColumns.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">⚠️ Optional columns not found (will default to 0):</p>
                  <div className="flex flex-wrap gap-1">
                    {r.missingColumns.map((c) => (
                      <span key={c} className="text-xs bg-yellow-100 text-yellow-700 rounded px-2 py-0.5">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {r.errors.filter((e) => !e.startsWith('Optional')).map((e, j) => (
                <p key={j} className="text-xs text-red-600">{e}</p>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
