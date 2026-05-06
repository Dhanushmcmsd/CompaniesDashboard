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
  nnpaPct: number;
  collectionEfficiency: number;
  avgLTV: number;
  totalGoldWeight: number;
  avgPresentRate: number;
  avgGoldValuePerLoan: number;
  totalAccounts: number;
  newDisbursements: number;
  mtdDisbursements: number;
  ytdDisbursements: number;
  gnpaAmount: number;
  totalOverdue: number;
  overduePercent: number;
}

function fmt(n: unknown, decimals = 2): string {
  const num = Number(n);
  if (n == null || !Number.isFinite(num)) return '\u2014';
  return num.toLocaleString('en-IN', { maximumFractionDigits: decimals });
}

function fmtFull(n: unknown, decimals = 6): string {
  const num = Number(n);
  if (n == null || !Number.isFinite(num)) return '\u2014';
  return num.toLocaleString('en-IN', { maximumFractionDigits: decimals });
}

export default function ExecutiveSummaryGrid() {
  const { period } = usePeriod();
  const [data, setData]     = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/gold-loan/kpis?period=${period}`)
      .then((r) => r.json())
      .then((d) => { setData(d?.kpis ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period]);

  const gnpaColor = !data ? 'blue' : (data.gnpaPct ?? 0) > 2 ? 'red' : 'green';
  const collColor = !data ? 'blue'
    : (data.collectionEfficiency ?? 0) >= 90 ? 'green'
    : (data.collectionEfficiency ?? 0) >= 75 ? 'yellow' : 'red';

  const disbValue = !data ? '\u2014'
    : period === 'MTD' ? fmt(data.mtdDisbursements)
    : period === 'YTD' ? fmt(data.ytdDisbursements)
    : fmt(data.newDisbursements);

  const disbFull = !data ? undefined
    : period === 'MTD' ? fmtFull(data.mtdDisbursements)
    : period === 'YTD' ? fmtFull(data.ytdDisbursements)
    : fmtFull(data.newDisbursements);

  const cards = [
    {
      label: 'Total AUM', value: fmt(data?.totalAUM), unit: '\u20b9 Cr', color: 'blue' as const,
      fullValue: fmtFull(data?.totalAUM),
      description: 'Total portfolio outstanding = SUM of all closing balances',
      drilldown: [
        { label: 'Total Accounts',  value: fmt(data?.totalAccounts, 0) },
        { label: 'Avg Ticket Size', value: `${fmt(data?.avgTicketSize)} \u20b9 Cr` },
        { label: 'Total Overdue',   value: `${fmt(data?.totalOverdue)} \u20b9 Cr` },
        { label: 'Overdue %',       value: `${fmt(data?.overduePercent)}%` },
      ],
    },
    {
      label: 'Total Customers', value: fmt(data?.totalCustomers, 0), color: 'blue' as const,
      fullValue: fmtFull(data?.totalCustomers, 0),
      description: 'Count of distinct customer IDs across all active accounts',
      drilldown: [
        { label: 'Total Accounts',         value: fmt(data?.totalAccounts, 0) },
        { label: 'Accounts per Customer',  value: fmt(data?.totalAccounts && data?.totalCustomers ? (data.totalAccounts / data.totalCustomers) : 0) },
      ],
    },
    {
      label: 'Avg Ticket Size', value: fmt(data?.avgTicketSize), unit: '\u20b9 Cr', color: 'blue' as const,
      fullValue: fmtFull(data?.avgTicketSize),
      description: 'Average outstanding per account = Total AUM \u00f7 Total Accounts',
    },
    {
      label: 'Yield', value: fmt(data?.avgYield), unit: '%', color: 'green' as const,
      fullValue: fmtFull(data?.avgYield),
      description: 'Average annualised interest rate across all active accounts',
    },
    {
      label: 'GNPA', value: fmt(data?.gnpaPct), unit: '%', color: gnpaColor,
      fullValue: fmtFull(data?.gnpaPct),
      description: 'Gross NPA % = Accounts with DPD > 90 / Total AUM \u00d7 100. Threshold: 2%',
      drilldown: [
        { label: 'GNPA Amount',  value: `${fmt(data?.gnpaAmount)} \u20b9 Cr` },
        { label: 'NNPA %',       value: `${fmt(data?.nnpaPct)}%` },
        { label: 'Status',       value: (data?.gnpaPct ?? 0) > 2 ? '\u26a0\ufe0f Above threshold' : '\u2705 Within limit' },
      ],
    },
    {
      label: 'Collection Efficiency', value: fmt(data?.collectionEfficiency), unit: '%', color: collColor,
      fullValue: fmtFull(data?.collectionEfficiency),
      description: 'Collections received on overdue accounts \u00f7 Total overdue \u00d7 100',
      drilldown: [
        { label: 'Overdue Collection', value: `${fmt(data?.totalOverdue)} \u20b9 Cr` },
        { label: 'Target',             value: '\u2265 90%' },
        { label: 'Status',             value: (data?.collectionEfficiency ?? 0) >= 90 ? '\u2705 On target' : '\u26a0\ufe0f Below target' },
      ],
    },
    {
      label: 'Avg LTV', value: fmt(data?.avgLTV), unit: '%', color: 'yellow' as const,
      fullValue: fmtFull(data?.avgLTV),
      description: 'Average Loan-to-Value = Closing Balance \u00f7 (Gold Weight \u00d7 Present Rate) \u00d7 100. RBI limit: 75%',
      drilldown: [
        { label: 'Avg Gold Value / Loan', value: `${fmt(data?.avgGoldValuePerLoan)} \u20b9 L` },
        { label: 'Avg Rate / gram',       value: `\u20b9${fmt(data?.avgPresentRate, 0)}` },
        { label: 'RBI Limit',             value: '75%' },
      ],
    },
    {
      label: 'Total Gold Weight', value: fmt(data?.totalGoldWeight, 0), unit: 'g', color: 'blue' as const,
      fullValue: fmtFull(data?.totalGoldWeight, 2),
      description: 'Total net gold weight (in grams) held as collateral across all active accounts',
      drilldown: [
        { label: 'Avg per Loan',    value: `${fmt(data?.avgGoldValuePerLoan)} g` },
        { label: 'Avg Rate / gram', value: `\u20b9${fmt(data?.avgPresentRate, 0)}` },
      ],
    },
    {
      label: 'Avg Rate / gram', value: fmt(data?.avgPresentRate, 0), unit: '\u20b9', color: 'blue' as const,
      fullValue: `\u20b9 ${fmtFull(data?.avgPresentRate, 2)}`,
      description: 'Average present market rate per gram of gold used for LTV calculation',
    },
    {
      label: 'Avg Gold Value / Loan', value: fmt(data?.avgGoldValuePerLoan), unit: '\u20b9 L', color: 'blue' as const,
      fullValue: fmtFull(data?.avgGoldValuePerLoan),
      description: 'Average market value of gold pledged per account = Avg Gold Weight \u00d7 Avg Rate',
    },
    {
      label: 'Total Accounts', value: fmt(data?.totalAccounts, 0), color: 'green' as const,
      fullValue: fmtFull(data?.totalAccounts, 0),
      description: 'Total number of active loan accounts in the portfolio',
    },
    {
      label: 'Disbursement', value: disbValue, unit: '\u20b9 Cr', color: 'blue' as const,
      fullValue: disbFull,
      description: `${period} disbursement = SUM of all disbursed amounts for the selected period`,
      drilldown: [
        { label: 'FTD', value: `${fmt(data?.newDisbursements)} \u20b9 Cr` },
        { label: 'MTD', value: `${fmt(data?.mtdDisbursements)} \u20b9 Cr` },
        { label: 'YTD', value: `${fmt(data?.ytdDisbursements)} \u20b9 Cr` },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {cards.map((card) => (
        <KPICard key={card.label} {...card} loading={loading} />
      ))}
    </div>
  );
}
