'use client';

import { useEffect, useState } from 'react';
import { usePeriod }          from '@/context/PeriodContext';

interface DisbData {
  ftdDisbursement: number;
  mtdDisbursement: number;
}

function fmt(n: unknown, d = 2): string {
  const num = Number(n);
  if (n == null || !Number.isFinite(num)) return '\u2014';
  return num.toLocaleString('en-IN', { maximumFractionDigits: d });
}

export default function MfDisbursementSection() {
  const { period }            = usePeriod();
  const [data, setData]       = useState<DisbData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/mf-loan/kpis?period=${period}`)
      .then((r) => r.json())
      .then((d) => { setData(d?.kpis ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period]);

  const rows = [
    {
      label:  'Month-to-Date Disbursement',
      value:  fmt(data?.mtdDisbursement),
      sub:    'SUM(Disbursed Amount) WHERE Issue Date >= 1 Apr AND <= today',
      accent: true,
    },
    {
      label:  'Daily / New Disbursement',
      value:  fmt(data?.ftdDisbursement),
      sub:    'SUM(Disbursed Amount) WHERE Issue Date = today',
      accent: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {rows.map((r) => (
        <div
          key={r.label}
          className={`rounded-xl p-5 border ${
            r.accent
              ? 'bg-[#1a2340] text-white border-transparent'
              : 'bg-white border-gray-100'
          }`}
        >
          <p className={`text-xs font-medium uppercase tracking-wide ${
            r.accent ? 'text-slate-300' : 'text-gray-500'
          }`}>{r.label}</p>
          {loading ? (
            <div className="h-7 w-24 bg-gray-300 rounded animate-pulse mt-2" />
          ) : (
            <p className={`text-2xl font-bold mt-1 ${
              r.accent ? 'text-white' : 'text-[#1a2340]'
            }`}>\u20b9 {r.value} <span className="text-sm font-normal">Cr</span></p>
          )}
          <p className={`text-xs mt-1 ${
            r.accent ? 'text-slate-400' : 'text-gray-400'
          }`}>{r.sub}</p>
        </div>
      ))}
    </div>
  );
}
