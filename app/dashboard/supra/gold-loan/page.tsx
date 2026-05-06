"use client";

import { Suspense, useEffect, useState } from "react";
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
    day: "2-digit", month: "long", year: "numeric",
  });
}

function SectionSkeleton({ rows = 1 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

function LastUpdated() {
  const [ts, setTs] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/dashboard/gold-loan/last-updated")
      .then(r => r.json())
      .then(d => setTs(d.lastUpdated ?? null))
      .catch(() => setTs(null));
  }, []);
  if (!ts) return null;
  return (
    <p className="text-xs text-gray-400 mt-0.5">
      Last updated:{" "}
      <span className="text-gray-300 font-medium">
        {new Date(ts).toLocaleString("en-IN", {
          day: "2-digit", month: "short", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        })}
      </span>
    </p>
  );
}

export default function GoldLoanPage() {
  return (
    <div>
      <header className="bg-[#0f172a] px-6 py-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-white text-2xl font-bold tracking-wide leading-tight">
              Gold Loan NBFC — Management Dashboard
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              As on {today()}&nbsp;&nbsp;|&nbsp;&nbsp;All figures in ₹ Crore unless noted
            </p>
            <LastUpdated />
          </div>
          <div className="mt-1"><PeriodSelector /></div>
        </div>
      </header>

      <main className="px-6 py-6 space-y-6">
        <section id="executive-summary">
          <SectionHeading>Executive Summary</SectionHeading>
          <Suspense fallback={<SectionSkeleton rows={3} />}>
            <ExecutiveSummaryGrid />
          </Suspense>
        </section>

        <section id="disbursement-collection">
          <SectionHeading>Disbursement &amp; Collection</SectionHeading>
          <Suspense fallback={<SectionSkeleton />}>
            <DisbursementSection />
          </Suspense>
        </section>

        <section id="overdue-collection">
          <SectionHeading>Overdue &amp; Collection Overview</SectionHeading>
          <Suspense fallback={<SectionSkeleton />}>
            <OverdueSection />
          </Suspense>
        </section>

        <section id="new-customers">
          <SectionHeading>New Customers</SectionHeading>
          <Suspense fallback={<SectionSkeleton />}>
            <NewCustomersSection />
          </Suspense>
        </section>

        <section id="closed-gold-loan">
          <SectionHeading>Closed Gold Loan — Grams Released</SectionHeading>
          <Suspense fallback={<SectionSkeleton />}>
            <ClosureSection />
          </Suspense>
        </section>

        <section id="high-risk">
          <Suspense fallback={<SectionSkeleton />}>
            <HighRiskTable />
          </Suspense>
        </section>

        <section id="npa-risk">
          <SectionHeading>NPA &amp; Risk Monitoring</SectionHeading>
          <Suspense fallback={<SectionSkeleton />}>
            <NPARiskSection />
          </Suspense>
        </section>

        <section id="gold-ltv">
          <SectionHeading>Gold Security &amp; LTV</SectionHeading>
          <Suspense fallback={<SectionSkeleton />}>
            <GoldLTVSection />
          </Suspense>
        </section>

        <section id="branch-performance">
          <SectionHeading>Branch Performance</SectionHeading>
          <Suspense fallback={<SectionSkeleton />}>
            <BranchPerformanceTable />
          </Suspense>
        </section>

        <section id="alerts-exceptions">
          <h2 className="text-[#0f172a] text-base font-bold uppercase tracking-widest mb-3 border-b border-orange-400 pb-1">
            Alerts &amp; Exceptions
          </h2>
          <Suspense fallback={<div className="grid grid-cols-5 gap-3">{[0,1,2,3,4].map(i=><div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse"/>)}</div>}>
            <AlertsPanel />
          </Suspense>
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
