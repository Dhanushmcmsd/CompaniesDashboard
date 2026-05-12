'use client';

import { useEffect, useState } from 'react';
import { usePeriod }          from '@/context/PeriodContext';
import MfKPICard             from './MfKPICard';

interface MfKPIs {
  totalAUM:        number;
  totalCustomers:  number;
  avgYield:        number;
  mtdDisbursement: number;
  ftdDisbursement: number;
  gnpaAmount:      number;
  gnpaPct:         number;
  overdueAmount:   number;
  overdueAccounts: number;
  loanClosureAmount: number;
  ftdCollection:      number;
  mtdCollection:      number;
  ftdDisburseFromTxn: number;
}

function fmt(n: unknown, d = 2): string {
  const num = Number(n);
  if (n == null || !Number.isFinite(num)) return '\u2014';
  return num.toLocaleString('en-IN', { maximumFractionDigits: d });
}

export default function MfExecutiveSummary() {
  const { period }            = usePeriod();
  const [data, setData]       = useState<MfKPIs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/mf-loan/kpis?period=${period}`)
      .then((r) => r.json())
      .then((d) => { setData(d?.kpis ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period]);

  const disbValue = !data ? '\u2014'
    : period === 'FTD' ? fmt(data.ftdDisbursement)
    : fmt(data.mtdDisbursement);

  const gnpaColor: 'blue' | 'green' | 'red' = !data ? 'blue' : (data.gnpaPct ?? 0) > 3 ? 'red' : 'green';

  const cards = [
    {
      label: 'Total AUM', value: fmt(data?.totalAUM), unit: '\u20b9 Cr', color: 'blue' as const,
      description: 'SUM of Principal Closing Balance across all active MF Loan accounts',
      drilldown: [
        { label: 'Total Customers',  value: fmt(data?.totalCustomers, 0) },
        { label: 'Avg Yield (ROI)',   value: `${fmt(data?.avgYield)}%` },
        { label: 'Overdue Amount',    value: `${fmt(data?.overdueAmount)} \u20b9 Cr` },
      ],
    },
    {
      label: 'Total Customers', value: fmt(data?.totalCustomers, 0), color: 'blue' as const,
      description: 'COUNT DISTINCT(Customer Number) from the Loan Balance Statement',
    },
    {
      label: 'Avg Yield (ROI)', value: fmt(data?.avgYield), unit: '%', color: 'green' as const,
      description: 'Average Rate of Interest across all active accounts',
    },
    {
      label: period === 'FTD' ? 'Daily Disbursement' : 'MTD Disbursement',
      value: disbValue, unit: '\u20b9 Cr', color: 'blue' as const,
      description: period === 'FTD'
        ? 'SUM(Disbursed Amount) WHERE Issue Date = today'
        : 'SUM(Disbursed Amount) WHERE Issue Date >= Apr 1 AND <= today',
      drilldown: [
        { label: 'FTD (Today)',  value: `${fmt(data?.ftdDisbursement)} \u20b9 Cr` },
        { label: 'MTD (Apr\u2013today)', value: `${fmt(data?.mtdDisbursement)} \u20b9 Cr` },
      ],
    },
    {
      label: 'GNPA', value: fmt(data?.gnpaPct), unit: '%', color: gnpaColor,
      description: 'Gross NPA % = SUM(Principal Closing Bal WHERE DPD > 90) / Total AUM \u00d7 100',
      drilldown: [
        { label: 'GNPA Amount', value: `${fmt(data?.gnpaAmount)} \u20b9 Cr` },
        { label: 'Status',      value: (data?.gnpaPct ?? 0) > 3 ? '\u26a0\ufe0f Above 3%' : '\u2705 Within limit' },
      ],
    },
    {
      label: 'Loan Closures', value: fmt(data?.loanClosureAmount), unit: '\u20b9 Cr', color: 'blue' as const,
      description: 'SUM(Closing Principal Received) WHERE Closed On = today',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {cards.map((card) => (
        <MfKPICard key={card.label} {...card} loading={loading} />
      ))}
    </div>
  );
}
