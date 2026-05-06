'use client';

import { useEffect, useState } from 'react';
import { usePeriod } from '@/context/PeriodContext';
import KPICard from './KPICard';

interface KPIData {
  totalAUM: number;
  totalCustomers: number;
  avgTicketSize: number;
  avgYield: number;
  gnpaPct: number;
  collectionEfficiency: number;
  avgLTV: number;
  totalGoldWeight: number;
  avgPresentRate: number;
  avgGoldValuePerLoan: number;
  totalAccounts: number;
  newDisbursements: number;
  mtdDisbursements: number;
  ytdDisbursements: number;
}

// Safe formatter — never throws on undefined/null/NaN
function fmt(n: unknown, decimals = 2): string {
  const num = Number(n);
  if (n == null || !Number.isFinite(num)) return '—';
  return num.toLocaleString('en-IN', { maximumFractionDigits: decimals });
}

export default function ExecutiveSummaryGrid() {
  const { period } = usePeriod();
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/gold-loan/kpis?period=${period}`)
      .then((r) => r.json())
      .then((d) => {
        // API returns { kpis: { ... } } — unwrap it
        setData(d?.kpis ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period]);

  const gnpaColor = !data ? 'blue' : (data.gnpaPct ?? 0) > 2 ? 'red' : 'green';
  const collColor = !data
    ? 'blue'
    : (data.collectionEfficiency ?? 0) >= 90
    ? 'green'
    : (data.collectionEfficiency ?? 0) >= 75
    ? 'yellow'
    : 'red';

  // Pick disbursement figure based on selected period
  const disbValue = !data
    ? '—'
    : period === 'MTD'
    ? fmt(data.mtdDisbursements)
    : period === 'YTD'
    ? fmt(data.ytdDisbursements)
    : fmt(data.newDisbursements);

  const cards = [
    // Row 1
    { label: 'Total AUM',             value: fmt(data?.totalAUM),             unit: '₹ Cr', color: 'blue'   as const },
    { label: 'Total Customers',       value: fmt(data?.totalCustomers, 0),                  color: 'blue'   as const },
    { label: 'Avg Ticket Size',       value: fmt(data?.avgTicketSize),        unit: '₹ L',  color: 'blue'   as const },
    { label: 'Yield',                 value: fmt(data?.avgYield),             unit: '%',    color: 'green'  as const },
    // Row 2
    { label: 'GNPA',                  value: fmt(data?.gnpaPct),              unit: '%',    color: gnpaColor          },
    { label: 'Collection Efficiency', value: fmt(data?.collectionEfficiency), unit: '%',    color: collColor          },
    { label: 'Avg LTV',               value: fmt(data?.avgLTV),               unit: '%',    color: 'yellow' as const },
    { label: 'Total Gold Weight',     value: fmt(data?.totalGoldWeight, 0),   unit: 'g',    color: 'blue'   as const },
    // Row 3
    { label: 'Avg Rate / gram',       value: fmt(data?.avgPresentRate, 0),    unit: '₹',    color: 'blue'   as const },
    { label: 'Avg Gold Value / Loan', value: fmt(data?.avgGoldValuePerLoan),  unit: '₹ L',  color: 'blue'   as const },
    { label: 'Total Accounts',        value: fmt(data?.totalAccounts, 0),                   color: 'green'  as const },
    { label: 'Disbursement',          value: disbValue,                       unit: '₹ Cr', color: 'blue'   as const },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {cards.map((card) => (
        <KPICard key={card.label} {...card} loading={loading} />
      ))}
    </div>
  );
}
