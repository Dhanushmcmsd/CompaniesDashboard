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
    month: "short",
    year: "numeric",
  });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-lg shadow p-5 border-l-4 border-[#1a2340]">
      <h2 className="text-sm font-semibold text-[#1a2340] uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </section>
  );
}

export default function GoldLoanDashboard() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-[#1a2340] text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <div>
          <h1 className="text-xl font-bold tracking-wide">Gold Loan NBFC — Management Dashboard</h1>
          <p className="text-xs text-gray-300 mt-0.5">As on {today()} | All figures in ₹ Crore</p>
        </div>
        <PeriodSelector />
      </header>

      <main className="p-6 space-y-6">
        <Section title="Executive Summary"><ExecutiveSummaryGrid /></Section>
        <Section title="Disbursement & Collection"><DisbursementSection /></Section>
        <Section title="Overdue & Collection Overview"><OverdueSection /></Section>
        <Section title="New Customers"><NewCustomersSection /></Section>
        <Section title="Closed Gold Loan — Grams Released"><ClosureSection /></Section>
        <Section title="High Risk"><HighRiskTable /></Section>
        <Section title="NPA & Risk Monitoring"><NPARiskSection /></Section>
        <Section title="Gold Security & LTV"><GoldLTVSection /></Section>
        <Section title="Branch Performance"><BranchPerformanceTable /></Section>
        <Section title="Alerts & Exceptions"><AlertsPanel /></Section>
      </main>
    </div>
  );
}
