"use client";

import PeriodSelector from "@/components/gold-loan/PeriodSelector";
import ExecutiveSummaryGrid from "@/components/gold-loan/ExecutiveSummaryGrid";
import DisbursementSection from "@/components/gold-loan/DisbursementSection";
import OverdueSection from "@/components/gold-loan/OverdueSection";
import NewCustomersSection from "@/components/gold-loan/NewCustomersSection";
import ClosureSection from "@/components/gold-loan/ClosureSection";
import HighRiskTable from "@/components/gold-loan/HighRiskTable";
import NPARiskSection from "@/components/gold-loan/NPARiskSection";
import GoldLTVSection from "@/components/gold-loan/GoldLTVSection";
import BranchPerformanceTable from "@/components/gold-loan/BranchPerformanceTable";
import AlertsPanel from "@/components/gold-loan/AlertsPanel";

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
        <section id="executive-summary">
          <SectionHeading>Executive Summary</SectionHeading>
          <ExecutiveSummaryGrid />
        </section>

        <section id="disbursement-collection">
          <SectionHeading>Disbursement &amp; Collection</SectionHeading>
          <DisbursementSection />
        </section>

        <section id="overdue-collection">
          <SectionHeading>Overdue &amp; Collection Overview</SectionHeading>
          <OverdueSection />
        </section>

        <section id="new-customers">
          <SectionHeading>New Customers</SectionHeading>
          <NewCustomersSection />
        </section>

        <section id="closed-gold-loan">
          <SectionHeading>Closed Gold Loan &mdash; Grams Released</SectionHeading>
          <ClosureSection />
        </section>

        <section id="high-risk">
          <HighRiskTable />
        </section>

        <section id="npa-risk">
          <SectionHeading>NPA &amp; Risk Monitoring</SectionHeading>
          <NPARiskSection />
        </section>

        <section id="gold-ltv">
          <SectionHeading>Gold Security &amp; LTV</SectionHeading>
          <GoldLTVSection />
        </section>

        <section id="branch-performance">
          <SectionHeading>Branch Performance</SectionHeading>
          <BranchPerformanceTable />
        </section>

        <section id="alerts-exceptions">
          <h2 className="text-[#0f172a] text-base font-bold uppercase tracking-widest mb-3 border-b border-orange-400 pb-1">
            Alerts &amp; Exceptions
          </h2>
          <AlertsPanel />
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
