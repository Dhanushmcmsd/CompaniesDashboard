'use client';
import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';

type HistoryBatch = {
  id:           string;
  originalName: string;
  fileType:     string;
  rowCount:     number;
  status:       string;
  errors:       string[] | null;
  uploadedBy:   string;
  createdAt:    string;
  reportDate:   string | null;
};

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

const statusStyle = (s: string) =>
  s === 'done'  ? 'text-green-700 bg-green-50 border border-green-200' :
  s === 'error' ? 'text-red-700 bg-red-50 border border-red-200'       :
                  'text-yellow-700 bg-yellow-50 border border-yellow-200';

const statusBadge = (s: string) =>
  s === 'done'  ? 'bg-green-100 text-green-700' :
  s === 'error' ? 'bg-red-100 text-red-700'     :
                  'bg-yellow-100 text-yellow-700';

export default function MfLoanUploadPage() {
  const [uploading,   setUploading]   = useState(false);
  const [results,     setResults]     = useState<UploadResult[]>([]);
  const [history,     setHistory]     = useState<HistoryBatch[]>([]);
  const [loadingHist, setLoadingHist] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoadingHist(true);
    try {
      const res  = await fetch('/api/upload/mf-loan/history');
      const data = await res.json();
      setHistory(data.batches ?? []);
    } finally {
      setLoadingHist(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) return;
      setUploading(true);
      setResults([]);
      const fd = new FormData();
      acceptedFiles.forEach((f) => fd.append('files', f));
      try {
        const res  = await fetch('/api/upload/mf-loan', { method: 'POST', body: fd });
        const data = await res.json();
        setResults(data.results ?? []);
        fetchHistory();
      } catch (e) {
        setResults([{
          fileName: 'Upload Error', fileType: '', confidence: '', matchedColumns: [],
          missingColumns: [], rowCount: 0, status: 'error',
          errors: [(e as Error).message],
        }]);
      } finally {
        setUploading(false);
      }
    },
    [fetchHistory],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    multiple: true,
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0f172a]">Microfinance Loan — Upload Data</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload the <strong>Loan Balance Statement</strong> and/or <strong>Transaction Statement</strong> (.xlsx / .xls).
          The dashboard updates instantly after upload.
        </p>
      </div>

      {/* Expected columns guide */}
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

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/30'
        }`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-blue-600 font-medium">Uploading &amp; processing…</p>
          </div>
        ) : isDragActive ? (
          <p className="text-blue-600 font-medium text-lg">Drop files here…</p>
        ) : (
          <>
            <div className="text-4xl mb-3">📂</div>
            <p className="text-gray-700 font-medium">Drag &amp; drop Excel files here, or click to browse</p>
            <p className="text-xs text-gray-400 mt-2">You can upload both files at once — auto-detected by column headers</p>
          </>
        )}
      </div>

      {/* Upload results */}
      {results.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-5 space-y-3">
          <h2 className="font-semibold text-[#0f172a] text-lg mb-1">Upload Results</h2>
          {results.map((r, i) => (
            <div key={i} className={`rounded-xl p-4 text-sm ${statusStyle(r.status)}`}>
              <div className="flex justify-between items-start">
                <span className="font-semibold">{r.fileName}</span>
                <span className={`uppercase text-xs font-bold px-2 py-0.5 rounded-full ${statusBadge(r.status)}`}>
                  {r.status}
                </span>
              </div>
              <div className="text-xs mt-1 opacity-70">
                Detected as: <strong>{r.fileType || 'Unknown'}</strong> · Confidence:{' '}
                <strong>{r.confidence}</strong> · {r.rowCount.toLocaleString()} rows
              </div>
              {r.matchedColumns.length > 0 && (
                <div className="text-xs mt-1">
                  ✅ Matched columns: {r.matchedColumns.join(', ')}
                </div>
              )}
              {r.missingColumns.length > 0 && (
                <div className="text-xs mt-0.5 text-yellow-700">
                  ⚠️ Optional missing: {r.missingColumns.join(', ')}
                </div>
              )}
              {r.errors.length > 0 && (
                <ul className="mt-1 list-disc list-inside text-xs space-y-0.5">
                  {r.errors.map((e, j) => <li key={j}>{e}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload history */}
      <div className="bg-white rounded-2xl shadow p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[#0f172a] text-lg">Upload History</h2>
          <button
            onClick={fetchHistory}
            className="text-xs text-blue-600 hover:underline"
          >
            ↻ Refresh
          </button>
        </div>

        {loadingHist ? (
          <p className="text-sm text-gray-400 animate-pulse">Loading history…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400">No uploads yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="pb-2 pr-4 font-medium">File</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Rows</th>
                  <th className="pb-2 pr-4 font-medium">Uploaded By</th>
                  <th className="pb-2 pr-4 font-medium">Date &amp; Time</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2 pr-4 font-medium max-w-[220px] truncate" title={b.originalName}>
                      {b.originalName}
                    </td>
                    <td className="py-2 pr-4 text-gray-600 text-xs">{b.fileType}</td>
                    <td className="py-2 pr-4 text-gray-600">{b.rowCount.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-gray-600 text-xs">{b.uploadedBy}</td>
                    <td className="py-2 pr-4 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(b.createdAt).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadge(b.status)}`}>
                        {b.status}
                      </span>
                      {b.errors && b.errors.length > 0 && !b.errors[0].startsWith('Optional') && (
                        <div className="text-xs text-red-500 mt-0.5 max-w-[200px] truncate" title={b.errors[0]}>
                          {b.errors[0]}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
