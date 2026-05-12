'use client';

import { useEffect, useState } from 'react';
import { usePeriod }          from '@/context/PeriodContext';

interface OverdueData {
  overdueAccounts: number;
  overdueAmount:   number;
  gnpaAmount:      number;
  gnpaPct:         number;
  loanClosureAmount: number;
  totalAUM:        number;
}

function fmt(n: unknown, d = 2): string {
  const num = Number(n);
  if (n == null || !Number.isFinite(num)) return '\u2014';
  return num.toLocaleString('en-IN', { maximumFractionDigits: d });
}

export default function MfOverdueSection() {
  const { period }            = usePeriod();
  const [data, setData]       = useState<OverdueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/mf-loan/kpis?period=${period}`)
      .then((r) => r.json())
      .then((d) => { setData(d?.kpis ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period]);

  const overduePct = data && data.totalAUM > 0
    ? ((data.overdueAmount / data.totalAUM) * 100).toFixed(2)
    : '\u2014';

  const items = [
    {
      label:  'Overdue Accounts',
      value:  loading ? '\u2014' : fmt(data?.overdueAccounts, 0),
      sub:    'COUNT WHERE DPD > 0',
      tag:    null,
      accent: false,
    },
    {
      label:  'Overdue Amount',
      value:  loading ? '\u2014' : `\u20b9 ${fmt(data?.overdueAmount)} Cr`,
      sub:    'SUM(Principal Closing Bal) WHERE DPD > 0',
      tag:    `${overduePct}% of AUM`,
      accent: false,
    },
    {
      label:  'GNPA Amount',
      value:  loading ? '\u2014' : `\u20b9 ${fmt(data?.gnpaAmount)} Cr`,
      sub:    'SUM(Principal Closing Bal) WHERE DPD > 90',
      tag:    loading ? null : `${fmt(data?.gnpaPct)}%`,
      accent: (data?.gnpaPct ?? 0) > 3,
    },
    {
      label:  'Loan Closure Amount',
      value:  loading ? '\u2014' : `\u20b9 ${fmt(data?.loanClosureAmount)} Cr`,
      sub:    'SUM(Closing Principal Received) WHERE Closed On = today',
      tag:    null,
      accent: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-xl p-4 border ${
            item.accent
              ? 'bg-red-50 border-red-200'
              : 'bg-white border-gray-100'
          }`}
        >
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{item.label}</p>
          <p className="text-xl font-bold text-[#1a2340] mt-1">{item.value}</p>
          <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
          {item.tag && (
            <span className={`mt-1 inline-block text-xs px-1.5 py-0.5 rounded ${
              item.accent
                ? 'bg-red-100 text-red-700'
                : 'bg-blue-100 text-blue-700'
            }`}>{item.tag}</span>
          )}
        </div>
      ))}
    </div>
  );
}
