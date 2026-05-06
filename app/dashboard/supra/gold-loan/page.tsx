"use client";

import PeriodSelector from "@/components/gold-loan/PeriodSelector";
import ExecutiveSummaryGrid from "@/components/gold-loan/ExecutiveSummaryGrid";

function today(): string {
  return new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function GoldLoanPage() {
  return (
    <div>
      {/* ════════════════════════════════════════
          HEADER
      ════════════════════════════════════════ */}
      <header className="bg-[#0f172a] px-6 py-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-white text-2xl font-bold tracking-wide leading-tight">
              Gold Loan NBFC &mdash; Management Dashboard
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              As on {today()}&nbsp;&nbsp;|&nbsp;&nbsp;All figures in ₹ Crore unless noted
            </p>
          </div>
          <div className="mt-1">
            <PeriodSelector />
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════
          MAIN CONTENT
      ════════════════════════════════════════ */}
      <main className="px-6 py-6 space-y-6">

        {/* ── Section 1: Executive Summary ── */}
        <section id="executive-summary">
          <h2 className="text-[#0f172a] text-base font-bold uppercase tracking-widest mb-3 border-b border-gray-300 pb-1">
            Executive Summary
          </h2>
          <ExecutiveSummaryGrid />
        </section>

        {/* ── Section 2: Disbursement & Collection ── */}
        <section id="disbursement-collection">
          <h2 className="text-[#0f172a] text-base font-bold uppercase tracking-widest mb-3 border-b border-gray-300 pb-1">
            Disbursement &amp; Collection
          </h2>
          <Placeholder label="Disbursement vs Target Bar Chart" tall />
        </section>

        {/* ── Section 3: Overdue & Collection Overview ── */}
        <section id="overdue-collection">
          <h2 className="text-[#0f172a] text-base font-bold uppercase tracking-widest mb-3 border-b border-gray-300 pb-1">
            Overdue &amp; Collection Overview
          </h2>
          <Placeholder label="Overdue Bucket Chart + Collection Efficiency" tall />
        </section>

        {/* ── Section 4: New Customers ── */}
        <section id="new-customers">
          <h2 className="text-[#0f172a] text-base font-bold uppercase tracking-widest mb-3 border-b border-gray-300 pb-1">
            New Customers
          </h2>
          <Placeholder label="New Customer Acquisition KPIs" />
        </section>

        {/* ── Section 5: Closed Gold Loan — Grams Released ── */}
        <section id="closed-gold-loan">
          <h2 className="text-[#0f172a] text-base font-bold uppercase tracking-widest mb-3 border-b border-gray-300 pb-1">
            Closed Gold Loan &mdash; Grams Released
          </h2>
          <Placeholder label="Closed Loan / Gold Released Summary" />
        </section>

        {/* ── Section 6: High Risk Table ── */}
        <section id="high-risk">
          <h2 className="text-[#0f172a] text-base font-bold uppercase tracking-widest mb-3 border-b border-red-400 pb-1 flex items-center gap-2">
            <span>⚠</span> High Risk Table
          </h2>
          <Placeholder label="High Risk Customer Table" tall />
        </section>

        {/* ── Section 7: NPA & Risk Monitoring ── */}
        <section id="npa-risk">
          <h2 className="text-[#0f172a] text-base font-bold uppercase tracking-widest mb-3 border-b border-gray-300 pb-1">
            NPA &amp; Risk Monitoring
          </h2>
          <Placeholder label="NPA Trend Chart + Bucket Table" tall />
        </section>

        {/* ── Section 8: Gold Security & LTV ── */}
        <section id="gold-ltv">
          <h2 className="text-[#0f172a] text-base font-bold uppercase tracking-widest mb-3 border-b border-gray-300 pb-1">
            Gold Security &amp; LTV
          </h2>
          <Placeholder label="Gold Weight Pledged / LTV Distribution" tall />
        </section>

        {/* ── Section 9: Branch Performance ── */}
        <section id="branch-performance">
          <h2 className="text-[#0f172a] text-base font-bold uppercase tracking-widest mb-3 border-b border-gray-300 pb-1">
            Branch Performance
          </h2>
          <Placeholder label="Branch-wise AUM / Disbursement / NPA Table" tall />
        </section>

        {/* ── Section 10: Alerts & Exceptions ── */}
        <section id="alerts-exceptions">
          <h2 className="text-[#0f172a] text-base font-bold uppercase tracking-widest mb-3 border-b border-orange-400 pb-1">
            Alerts &amp; Exceptions
          </h2>
          <Placeholder label="Alert Cards / Exception List" />
        </section>

      </main>
    </div>
  );
}

function Placeholder({ label, tall }: { label: string; tall?: boolean }) {
  return (
    <div
      className={`bg-white rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-sm ${
        tall ? "h-48" : "h-20"
      }`}
    >
      {label}
    </div>
  );
}
