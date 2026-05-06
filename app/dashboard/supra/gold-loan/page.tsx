"use client";

import PeriodSelector from "@/components/gold-loan/PeriodSelector";
import ExecutiveSummaryGrid from "@/components/gold-loan/ExecutiveSummaryGrid";
import DisbursementSection from "@/components/gold-loan/DisbursementSection";
import OverdueSection from "@/components/gold-loan/OverdueSection";

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
      {/* ══ HEADER ══ */}
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
          <div className="mt-1"><PeriodSelector /></div>
        </div>
      </header>

      <main className="px-6 py-6 space-y-6">

        {/* §1 Executive Summary */}
        <section id="executive-summary">
          <SectionHeading>Executive Summary</SectionHeading>
          <ExecutiveSummaryGrid />
        </section>

        {/* §2 Disbursement & Collection */}
        <section id="disbursement-collection">
          <SectionHeading>Disbursement &amp; Collection</SectionHeading>
          <DisbursementSection />
        </section>

        {/* §3 Overdue & Collection Overview */}
        <section id="overdue-collection">
          <SectionHeading>Overdue &amp; Collection Overview</SectionHeading>
          <OverdueSection />
        </section>

        {/* §4 New Customers */}
        <section id="new-customers">
          <SectionHeading>New Customers</SectionHeading>
          <Placeholder label="New Customer Acquisition KPIs" />
        </section>

        {/* §5 Closed Gold Loan — Grams Released */}
        <section id="closed-gold-loan">
          <SectionHeading>Closed Gold Loan &mdash; Grams Released</SectionHeading>
          <Placeholder label="Closed Loan / Gold Released Summary" />
        </section>

        {/* §6 High Risk Table */}
        <section id="high-risk">
          <h2 className="text-[#0f172a] text-base font-bold uppercase tracking-widest mb-3 border-b border-red-400 pb-1 flex items-center gap-2">
            <span>⚠</span> High Risk Table
          </h2>
          <Placeholder label="High Risk Customer Table" tall />
        </section>

        {/* §7 NPA & Risk Monitoring */}
        <section id="npa-risk">
          <SectionHeading>NPA &amp; Risk Monitoring</SectionHeading>
          <Placeholder label="NPA Trend Chart + Bucket Table" tall />
        </section>

        {/* §8 Gold Security & LTV */}
        <section id="gold-ltv">
          <SectionHeading>Gold Security &amp; LTV</SectionHeading>
          <Placeholder label="Gold Weight Pledged / LTV Distribution" tall />
        </section>

        {/* §9 Branch Performance */}
        <section id="branch-performance">
          <SectionHeading>Branch Performance</SectionHeading>
          <Placeholder label="Branch-wise AUM / Disbursement / NPA Table" tall />
        </section>

        {/* §10 Alerts & Exceptions */}
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

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[#0f172a] text-base font-bold uppercase tracking-widest mb-3 border-b border-gray-300 pb-1">
      {children}
    </h2>
  );
}

function Placeholder({ label, tall }: { label: string; tall?: boolean }) {
  return (
    <div className={`bg-white rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-sm ${tall ? "h-48" : "h-20"}`}>
      {label}
    </div>
  );
}
