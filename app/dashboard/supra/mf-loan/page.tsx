'use client';

import { useEffect, useState } from 'react';
import { usePeriod }          from '@/context/PeriodContext';

// ── Types ─────────────────────────────────────────────────────────────────────
interface MfKPIs {
  totalAUM:           number;
  totalCustomers:     number;
  avgYield:           number;
  mtdDisbursement:    number;
  ftdDisbursement:    number;
  overdueAccounts:    number;
  overdueAmount:      number;
  gnpaAmount:         number;
  gnpaPct:            number;
  loanClosureAmount:  number;
  ftdCollection:      number;
  mtdCollection:      number;
  ftdDisburseFromTxn: number;
  branchAUM:          BranchRow[];
  snapshotDate:       string | null;
}

interface BranchRow {
  branch:        string;
  aum:           number;
  customers:     number;
  overdueAmount: number;
  gnpaAmount:    number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function cr(n: number | undefined | null, d = 2): string {
  if (n == null || !Number.isFinite(n)) return '\u2014';
  return n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function pct(n: number | undefined | null, d = 2): string {
  if (n == null || !Number.isFinite(n)) return '\u2014';
  return n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function num(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return '\u2014';
  return n.toLocaleString('en-IN');
}

// ── Small sub-components ──────────────────────────────────────────────────────

function KPICard({ label, value, unit, sub, color = 'blue' }: {
  label: string; value: string; unit?: string; sub?: string; color?: 'blue' | 'green' | 'red' | 'orange';
}) {
  const dot = { blue: 'bg-blue-500', green: 'bg-green-500', red: 'bg-red-500', orange: 'bg-orange-400' }[color];
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</span>
        <span className={`w-2 h-2 rounded-full ${dot}`} />
      </div>
      <p className="text-2xl font-bold text-[#1a2340]">
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-[#1a2340] px-5 py-3">
        <h2 className="text-sm font-semibold text-white uppercase tracking-widest">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function StatBox({ label, value, unit, sub, highlight }: {
  label: string; value: string; unit?: string; sub?: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 ${highlight ? 'bg-[#1a2340] text-white' : 'bg-gray-50 border border-gray-100'}` }>
      <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${highlight ? 'text-gray-300' : 'text-gray-500'}`}>{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-white' : 'text-[#1a2340]'}`}>
        {unit && <span className="text-base font-normal mr-0.5">{unit}</span>}
        {value}
        {!unit && <span className="text-sm font-normal ml-1 opacity-60">Cr</span>}
      </p>
      {sub && <p className={`text-xs mt-1 ${highlight ? 'text-gray-400' : 'text-gray-400'}`}>{sub}</p>}
    </div>
  );
}

// ── Period Selector pill ──────────────────────────────────────────────────────
function PeriodBar() {
  const { period, setPeriod } = usePeriod();
  const tabs: Array<typeof period> = ['FTD', 'MTD', 'YTD'];
  return (
    <div className="flex gap-1 bg-white/20 rounded-lg p-1">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => setPeriod(t)}
          className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
            period === t ? 'bg-white text-[#1a2340] shadow' : 'text-white hover:bg-white/20'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function MfLoanDashboard() {
  const { period, periodParams } = usePeriod();
  const [kpis, setKpis]         = useState<MfKPIs | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/mf-loan/kpis?${periodParams}`)
      .then((r) => r.json())
      .then((d) => { setKpis(d?.kpis ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [periodParams]);

  const dateLabel = kpis?.snapshotDate
    ? new Date(kpis.snapshotDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const gnpaColor = (kpis?.gnpaPct ?? 0) > 3 ? 'red' : 'green';
  const disbValue = period === 'FTD' ? kpis?.ftdDisbursement : kpis?.mtdDisbursement;
  const disbLabel = period === 'FTD' ? 'Daily Disbursement' : 'MTD Disbursement';
  const collValue = period === 'FTD' ? kpis?.ftdCollection : kpis?.mtdCollection;
  const collLabel = period === 'FTD' ? 'Daily Collection' : 'MTD Collection';

  const branches: BranchRow[] = Array.isArray(kpis?.branchAUM) ? kpis!.branchAUM : [];
  const totalBranchAUM = branches.reduce((s, b) => s + b.aum, 0);

  const overdueOfAUM = kpis?.totalAUM && kpis.totalAUM > 0
    ? ((kpis.overdueAmount / kpis.totalAUM) * 100)
    : 0;

  const blur = loading ? 'opacity-50 pointer-events-none' : '';

  return (
    <div className="min-h-screen bg-[#f1f5f9]">

      {/* ── Header ── */}
      <header className="bg-[#1a2340] text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <div>
          <h1 className="text-xl font-bold tracking-wide">Micro Finance Loan — Management Dashboard</h1>
          <p className="text-xs text-gray-300 mt-0.5">As on {dateLabel} | All figures in ₹ Crore</p>
        </div>
        <PeriodBar />
      </header>

      <main className={`p-6 space-y-6 max-w-7xl mx-auto ${blur}`}>

        {/* ── No data notice ── */}
        {!loading && !kpis && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 text-center">
            <p className="text-yellow-800 font-semibold">No snapshot found for this period.</p>
            <p className="text-yellow-600 text-sm mt-1">Ask the employee to upload a Balance Statement to generate data.</p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 1 — Executive Summary
        ══════════════════════════════════════════════════════════════════════ */}
        <Section id="summary" title="📋 Microfinance — Executive Summary">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KPICard label="Total AUM"          value={cr(kpis?.totalAUM)}         unit="₹ Cr"  color="blue" />
            <KPICard label="Active Borrowers"   value={num(kpis?.totalCustomers)}              color="blue" />
            <KPICard label="Avg Yield (ROI)"    value={pct(kpis?.avgYield)}         unit="%"    color="green" />
            <KPICard label={disbLabel}          value={cr(disbValue)}               unit="₹ Cr"  color="blue" />
            <KPICard label="GNPA %"             value={pct(kpis?.gnpaPct)}          unit="%"    color={gnpaColor} />
            <KPICard label="Loan Closures"      value={cr(kpis?.loanClosureAmount)} unit="₹ Cr"  color="blue" />
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 2 — Disbursement (from Balance Statement)
        ══════════════════════════════════════════════════════════════════════ */}
        <Section id="disbursement" title="A. Loan Balance Statement — Disbursement">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatBox
              highlight
              label="Month-to-Date Disbursement"
              value={cr(kpis?.mtdDisbursement)}
              unit="₹"
              sub="SUM(Disbursed Amount) WHERE Issue Date ≥ 1 Apr AND ≤ today"
            />
            <StatBox
              label="Daily / New Disbursement"
              value={cr(kpis?.ftdDisbursement)}
              unit="₹"
              sub="SUM(Disbursed Amount) WHERE Issue Date = today"
            />
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 3 — Overdue & GNPA (from Balance Statement)
        ══════════════════════════════════════════════════════════════════════ */}
        <Section id="overdue" title="A. Loan Balance Statement — Overdue &amp; GNPA">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Overdue Accounts</p>
              <p className="text-3xl font-bold text-[#1a2340]">{num(kpis?.overdueAccounts)}</p>
              <p className="text-xs text-gray-400 mt-1">COUNT WHERE DPD &gt; 0</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Overdue Amount</p>
              <p className="text-2xl font-bold text-[#1a2340]">₹ {cr(kpis?.overdueAmount)} Cr</p>
              <p className="text-xs text-gray-400 mt-1">SUM(Principal Closing Bal) WHERE DPD &gt; 0</p>
              {kpis && kpis.totalAUM > 0 && (
                <span className="inline-block mt-2 text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5">
                  {pct(overdueOfAUM)}% of AUM
                </span>
              )}
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">GNPA Amount</p>
              <p className="text-2xl font-bold text-red-600">₹ {cr(kpis?.gnpaAmount)} Cr</p>
              <p className="text-xs text-gray-400 mt-1">SUM(Principal Closing Bal) WHERE DPD &gt; 90</p>
              {kpis && (
                <span className={`inline-block mt-2 text-xs rounded-full px-2 py-0.5 ${
                  (kpis.gnpaPct ?? 0) > 3 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                }`}>
                  {pct(kpis.gnpaPct)}%
                </span>
              )}
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Loan Closure Amount</p>
              <p className="text-2xl font-bold text-[#1a2340]">₹ {cr(kpis?.loanClosureAmount)} Cr</p>
              <p className="text-xs text-gray-400 mt-1">SUM(Closing Principal Received) WHERE Closed On = today</p>
            </div>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 4 — Collections (from Transaction Statement)
        ══════════════════════════════════════════════════════════════════════ */}
        <Section id="collections" title="B. Transaction Statement — Collections">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatBox
              highlight
              label={collLabel}
              value={cr(collValue)}
              unit="₹"
              sub={period === 'FTD'
                ? 'SUM(Total Received) WHERE Transaction Date = today'
                : 'SUM(Total Received) WHERE Transaction Date in current month'}
            />
            <StatBox
              label="Daily Disbursement (Txn)"
              value={cr(kpis?.ftdDisburseFromTxn)}
              unit="₹"
              sub="SUM(Principal Dr) WHERE Transaction Date = today"
            />
            <StatBox
              label="MTD Collection"
              value={cr(kpis?.mtdCollection)}
              unit="₹"
              sub="SUM(Total Received) WHERE Txn Date in current month"
            />
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 5 — Branch Breakdown
        ══════════════════════════════════════════════════════════════════════ */}
        <Section id="branches" title="Branch Performance">
          {branches.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No branch data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1a2340] text-white">
                    <th className="text-left px-4 py-2 rounded-tl-lg">Branch</th>
                    <th className="text-right px-4 py-2">AUM (₹ Cr)</th>
                    <th className="text-right px-4 py-2">AUM %</th>
                    <th className="text-right px-4 py-2">Customers</th>
                    <th className="text-right px-4 py-2">Overdue (₹ Cr)</th>
                    <th className="text-right px-4 py-2 rounded-tr-lg">GNPA (₹ Cr)</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((b, i) => (
                    <tr key={b.branch} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2 font-medium text-[#1a2340]">{b.branch}</td>
                      <td className="px-4 py-2 text-right">{cr(b.aum)}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-[#1a2340] h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, totalBranchAUM > 0 ? (b.aum / totalBranchAUM) * 100 : 0)}%` }}
                            />
                          </div>
                          <span className="text-xs w-10 text-right">
                            {totalBranchAUM > 0 ? pct((b.aum / totalBranchAUM) * 100, 1) : '0.0'}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">{num(b.customers)}</td>
                      <td className="px-4 py-2 text-right">{cr(b.overdueAmount)}</td>
                      <td className="px-4 py-2 text-right font-medium text-red-600">{cr(b.gnpaAmount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#f1f5f9] font-semibold border-t-2 border-gray-300">
                    <td className="px-4 py-2">Total</td>
                    <td className="px-4 py-2 text-right">{cr(branches.reduce((s, b) => s + b.aum, 0))}</td>
                    <td className="px-4 py-2 text-right">100%</td>
                    <td className="px-4 py-2 text-right">{num(branches.reduce((s, b) => s + b.customers, 0))}</td>
                    <td className="px-4 py-2 text-right">{cr(branches.reduce((s, b) => s + b.overdueAmount, 0))}</td>
                    <td className="px-4 py-2 text-right text-red-600">{cr(branches.reduce((s, b) => s + b.gnpaAmount, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Section>

      </main>
    </div>
  );
}
