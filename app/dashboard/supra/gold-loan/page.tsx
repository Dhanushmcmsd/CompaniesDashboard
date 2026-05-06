import PeriodSelector from '@/components/gold-loan/PeriodSelector';

function today(): string {
  return new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const SECTIONS = [
  'Executive Summary',
  'Disbursement & Collection',
  'Overdue & Collection Overview',
  'New Customers',
  'Closed Gold Loan — Grams Released',
  '⚠ High Risk Table',
  'NPA & Risk Monitoring',
  'Gold Security & LTV',
  'Branch Performance',
  'Alerts & Exceptions',
] as const;

export default function GoldLoanDashboard() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* ── Header ───────────────────────────────────────────── */}
      <header className="bg-[#1a2340] text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <div>
          <h1 className="text-xl font-bold tracking-wide">
            Gold Loan NBFC — Management Dashboard
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            As on {today()} &nbsp;|&nbsp; All figures in ₹ Crore unless noted
          </p>
        </div>
        <PeriodSelector />
      </header>

      {/* ── Dashboard body ───────────────────────────────────── */}
      <main className="p-6 space-y-6">
        {SECTIONS.map((section) => (
          <section
            key={section}
            className="bg-white rounded-lg shadow p-5 border-l-4 border-[#1a2340]"
          >
            <h2 className="text-sm font-semibold text-[#1a2340] uppercase tracking-wider mb-3">
              {section}
            </h2>
            <div className="h-24 bg-gray-50 rounded flex items-center justify-center text-gray-400 text-sm">
              — content coming in next phase —
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
