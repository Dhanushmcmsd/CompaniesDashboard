import MfPeriodSelector      from '@/components/mf-loan/MfPeriodSelector';
import MfExecutiveSummary    from '@/components/mf-loan/MfExecutiveSummary';
import MfDisbursementSection from '@/components/mf-loan/MfDisbursementSection';
import MfOverdueSection      from '@/components/mf-loan/MfOverdueSection';
import MfCollectionSection   from '@/components/mf-loan/MfCollectionSection';
import MfBranchTable         from '@/components/mf-loan/MfBranchTable';

function today(): string {
  return new Date().toLocaleDateString('en-IN', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
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

export default function MfLoanDashboard() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-[#1a2340] text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <div>
          <h1 className="text-xl font-bold tracking-wide">Micro Finance Loan — Management Dashboard</h1>
          <p className="text-xs text-gray-300 mt-0.5">As on {today()} | All figures in ₹ Crore</p>
        </div>
        <MfPeriodSelector />
      </header>

      <main className="p-6 space-y-6">
        <Section title="Executive Summary — Total AUM">
          <MfExecutiveSummary />
        </Section>

        <Section title="A. Loan Balance Statement — Disbursement">
          <MfDisbursementSection />
        </Section>

        <Section title="A. Loan Balance Statement — Overdue &amp; GNPA">
          <MfOverdueSection />
        </Section>

        <Section title="B. Transaction Statement — Collections">
          <MfCollectionSection />
        </Section>

        <Section title="Branch-wise Breakdown">
          <MfBranchTable />
        </Section>
      </main>
    </div>
  );
}
