'use client';

import { useEffect, useState } from 'react';
import { usePeriod }          from '@/context/PeriodContext';

interface BranchRow {
  branch:        string;
  aum:           number;
  customers:     number;
  overdueAmount: number;
  gnpaAmount:    number;
}

function fmt(n: unknown, d = 2): string {
  const num = Number(n);
  if (n == null || !Number.isFinite(num)) return '\u2014';
  return num.toLocaleString('en-IN', { maximumFractionDigits: d });
}

export default function MfBranchTable() {
  const { period }              = usePeriod();
  const [rows, setRows]         = useState<BranchRow[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/mf-loan/kpis?period=${period}`)
      .then((r) => r.json())
      .then((d) => {
        const raw = d?.kpis?.branchAUM;
        setRows(Array.isArray(raw) ? raw : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-8 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return <p className="text-sm text-gray-400">No branch data available. Upload a Balance Statement first.</p>;
  }

  const totalAUM = rows.reduce((s, r) => s + r.aum, 0);

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wide">
            <th className="py-2 pr-4">Branch</th>
            <th className="pr-4">AUM (\u20b9 Cr)</th>
            <th className="pr-4">AUM %</th>
            <th className="pr-4">Customers</th>
            <th className="pr-4">Overdue (\u20b9 Cr)</th>
            <th className="pr-4">GNPA (\u20b9 Cr)</th>
            <th>GNPA %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const aumPct  = totalAUM > 0 ? ((row.aum / totalAUM) * 100).toFixed(1) : '0.0';
            const gnpaPct = row.aum > 0  ? ((row.gnpaAmount / row.aum) * 100).toFixed(2) : '0.00';
            const isHighGnpa = parseFloat(gnpaPct) > 3;
            return (
              <tr key={row.branch} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 pr-4 font-medium text-gray-800">{row.branch}</td>
                <td className="pr-4">{fmt(row.aum)}</td>
                <td className="pr-4 text-gray-500">{aumPct}%</td>
                <td className="pr-4">{fmt(row.customers, 0)}</td>
                <td className="pr-4">{fmt(row.overdueAmount)}</td>
                <td className="pr-4">{fmt(row.gnpaAmount)}</td>
                <td>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    isHighGnpa
                      ? 'bg-red-100 text-red-700'
                      : 'bg-green-100 text-green-700'
                  }`}>{gnpaPct}%</span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-300 font-semibold text-[#1a2340]">
            <td className="py-2 pr-4">Total</td>
            <td className="pr-4">{fmt(totalAUM)}</td>
            <td className="pr-4">100%</td>
            <td className="pr-4">{fmt(rows.reduce((s, r) => s + r.customers, 0), 0)}</td>
            <td className="pr-4">{fmt(rows.reduce((s, r) => s + r.overdueAmount, 0))}</td>
            <td className="pr-4">{fmt(rows.reduce((s, r) => s + r.gnpaAmount, 0))}</td>
            <td>{totalAUM > 0 ? ((rows.reduce((s, r) => s + r.gnpaAmount, 0) / totalAUM) * 100).toFixed(2) : '0.00'}%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
