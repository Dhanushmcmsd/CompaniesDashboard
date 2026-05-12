'use client';

import { useState, useRef } from 'react';

type UploadResult = {
  fileName: string;
  fileType: string;
  rowCount: number;
  status: string;
  errors: string[];
};

export default function GoldLoanUploadPage() {
  const [loanFile, setLoanFile] = useState<File | null>(null);
  const [txnFile, setTxnFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ results: UploadResult[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const loanRef = useRef<HTMLInputElement>(null);
  const txnRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanFile || !txnFile) {
      setError('Please select both files before uploading.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(20);

    const formData = new FormData();
    formData.append('files', loanFile);
    formData.append('files', txnFile);

    try {
      setProgress(50);
      const res = await fetch('/api/upload/gold-loan', {
        method: 'POST',
        body: formData,
      });
      setProgress(80);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      if (!Array.isArray(data.results)) throw new Error('Invalid response from server');
      setResult({ results: data.results as UploadResult[] });
      setProgress(100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setLoanFile(null);
    setTxnFile(null);
    setResult(null);
    setError(null);
    setProgress(0);
    if (loanRef.current) loanRef.current.value = '';
    if (txnRef.current) txnRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="bg-[#1e2a38] text-white px-6 py-4 rounded-xl mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-wide">Gold Loan Portfolio</h1>
          <p className="text-sm text-gray-300 mt-0.5">Data Upload — Supra Pacific</p>
        </div>
        <a
          href="/dashboard/supra/gold-loan"
          className="text-sm bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition"
        >
          ← Back to Dashboard
        </a>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Upload Statements</h2>
          <p className="text-sm text-gray-500 mb-6">
            Upload both the Loan Balance Statement and Transaction Statement (.xlsx) to update the portfolio data.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Loan Balance File */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                A. Loan Balance Statement
                <span className="ml-2 text-xs text-gray-400 font-normal">.xlsx required</span>
              </label>
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition"
                onClick={() => loanRef.current?.click()}
              >
                {loanFile ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-green-600 font-medium">
                    <span>✓</span>
                    <span>{loanFile.name}</span>
                    <span className="text-gray-400 font-normal">({(loanFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Click to select file</p>
                )}
                <input
                  ref={loanRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => setLoanFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            {/* Transaction Statement File */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                B. Transaction Statement
                <span className="ml-2 text-xs text-gray-400 font-normal">.xlsx required</span>
              </label>
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/30 transition"
                onClick={() => txnRef.current?.click()}
              >
                {txnFile ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-green-600 font-medium">
                    <span>✓</span>
                    <span>{txnFile.name}</span>
                    <span className="text-gray-400 font-normal">({(txnFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Click to select file</p>
                )}
                <input
                  ref={txnRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => setTxnFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            {/* Progress Bar */}
            {loading && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Processing files...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Success Result */}
            {result && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-green-700 mb-2">✓ Upload Successful</p>
                <ul className="space-y-3">
                  {result.results.map((r, idx) => (
                    <li
                      key={`${r.fileName}-${idx}`}
                      className="bg-white rounded-lg border border-green-100 p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium text-gray-800 truncate" title={r.fileName}>
                          {r.fileName}
                        </p>
                        <span
                          className={`text-xs font-semibold uppercase shrink-0 ${
                            r.status === 'done'
                              ? 'text-green-600'
                              : r.status === 'error'
                                ? 'text-red-600'
                                : 'text-amber-600'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Type: <span className="text-gray-700">{r.fileType}</span>
                        {' · '}
                        Rows: <span className="text-gray-700">{r.rowCount}</span>
                      </p>
                      {r.errors.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-xs font-medium text-red-600 mb-1">
                            Warnings / errors ({r.errors.length})
                          </p>
                          <ul className="text-xs text-red-500 space-y-0.5 max-h-24 overflow-y-auto">
                            {r.errors.map((err, i) => (
                              <li key={i}>• {err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-3 text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Upload another batch
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-red-600">✗ Upload Failed</p>
                <p className="text-sm text-red-500 mt-1">{error}</p>
              </div>
            )}

            {/* Submit / Reset */}
            {!result && (
              <button
                type="submit"
                disabled={loading || !loanFile || !txnFile}
                className="w-full bg-[#1e2a38] hover:bg-[#2c3e50] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition text-sm"
              >
                {loading ? 'Uploading & Parsing...' : 'Upload & Process Files'}
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Only authorised Supra Pacific employees can upload data. Files are not stored — only parsed records are saved.
        </p>
      </div>
    </div>
  );
}
