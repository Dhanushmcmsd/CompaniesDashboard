'use client';

import { useEffect, useState } from 'react';
import { usePeriod } from '@/context/PeriodContext';
import KPICard from './KPICard';

interface KPIData {
  totalAUM: number;
  totalCustomers: number;
  avgTicketSize: number;
  yield: number;
  gnpaPct: number;
  collectionEfficiency: number;
  avgLTV: number;
  totalGoldWeight: number;
  avgRatePerGram: number;
  avgGoldValuePerLoan: number;
  newCustomers: number;
  closedLoansGrams: number;
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: decimals });
}

export default function ExecutiveSummaryGrid() {
  const { period } = usePeriod();
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/gold-loan/kpis?period=${period}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period]);

  const gnpaColor  = !data ? 'blue' : data.gnpaPct > 2 ? 'red' : 'green';
  const collColor  = !data ? 'blue' : data.collectionEfficiency >= 90 ? 'green' : data.collectionEfficiency >= 75 ? 'yellow' : 'red';

  const cards = [
    // Row 1
    { label: 'Total AUM',              value: data ? fmt(data.totalAUM)        : '—', unit: '₹ Cr',  color: 'blue'    as const },
    { label: 'Total Customers',        value: data ? fmt(data.totalCustomers, 0) : '—',              color: 'blue'    as const },
    { label: 'Avg Ticket Size',        value: data ? fmt(data.avgTicketSize)   : '—', unit: '₹ L',   color: 'blue'    as const },
    { label: 'Yield',                  value: data ? fmt(data.yield)           : '—', unit: '%',     color: 'green'   as const },
    // Row 2
    { label: 'GNPA',                   value: data ? fmt(data.gnpaPct)         : '—', unit: '%',     color: gnpaColor           },
    { label: 'Collection Efficiency',  value: data ? fmt(data.collectionEfficiency) : '—', unit: '%', color: collColor          },
    { label: 'Avg LTV',               value: data ? fmt(data.avgLTV)           : '—', unit: '%',     color: 'yellow'  as const },
    { label: 'Total Gold Weight',      value: data ? fmt(data.totalGoldWeight, 0) : '—', unit: 'g', color: 'blue'    as const },
    // Row 3
    { label: 'Avg Rate / gram',        value: data ? fmt(data.avgRatePerGram, 0) : '—', unit: '₹',  color: 'blue'    as const },
    { label: 'Avg Gold Value / Loan',  value: data ? fmt(data.avgGoldValuePerLoan) : '—', unit: '₹ Cr', color: 'blue' as const },
    { label: 'New Customers',          value: data ? fmt(data.newCustomers, 0)  : '—',                color: 'green'   as const },
    { label: 'Closed Loans (grams)',   value: data ? fmt(data.closedLoansGrams, 0) : '—', unit: 'g', color: 'red'    as const },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {cards.map((card) => (
        <KPICard key={card.label} {...card} loading={loading} />
      ))}
    </div>
  );
}
