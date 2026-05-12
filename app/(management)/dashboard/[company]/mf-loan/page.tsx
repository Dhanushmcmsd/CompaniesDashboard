import { getServerSession } from 'next-auth';
import { authOptions }      from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma }           from '@/lib/prisma';
import MfExecutiveSummary   from '@/components/mf-loan/MfExecutiveSummary';
import MfDisbursementSection from '@/components/mf-loan/MfDisbursementSection';
import MfCollectionSection  from '@/components/mf-loan/MfCollectionSection';
import MfOverdueSection     from '@/components/mf-loan/MfOverdueSection';
import MfBranchTable        from '@/components/mf-loan/MfBranchTable';
import Link                 from 'next/link';
import { PeriodProvider }   from '@/context/PeriodContext';

export const dynamic = 'force-dynamic';

export default async function MfLoanDashboardPage({
  params,
}: {
  params: { company: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  if (params.company !== 'supra') return notFound();

  const snapshot = await prisma.mfLoanSnapshot.findFirst({
    where:   { company: 'supra' },
    orderBy: { snapshotDate: 'desc' },
  });

  const lastUpload = await prisma.uploadBatch.findFirst({
    where:   { company: 'supra', portfolio: 'mf-loan', status: 'done' },
    orderBy: { uploadedAt: 'desc' },
    select:  { uploadedAt: true, originalName: true, uploadedBy: true },
  });

  const asOnDate = snapshot?.snapshotDate
    ? new Date(snapshot.snapshotDate).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : null;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/${params.company}`}
            className="text-sm text-gray-500 hover:underline"
          >
            ← Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#0f172a]">
              Microfinance Loan Dashboard
            </h1>
            {asOnDate && (
              <p className="text-xs text-gray-500 mt-0.5">
                As on {asOnDate} · All figures in ₹ Crore unless noted
              </p>
            )}
          </div>
        </div>

        {lastUpload && (
          <div className="text-xs text-gray-400 text-right shrink-0">
            <span className="text-gray-500 font-medium">Last data upload</span>
            <br />
            <span className="font-semibold text-gray-700">{lastUpload.originalName}</span>
            <br />
            by {lastUpload.uploadedBy} &middot;{' '}
            {new Date(lastUpload.uploadedAt).toLocaleString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </div>
        )}
      </div>

      {/* ── No data state ── */}
      {!snapshot ? (
        <div className="flex flex-col items-center justify-center py-28 text-center bg-white rounded-2xl shadow">
          <div className="text-6xl mb-4">📂</div>
          <h2 className="text-xl font-semibold text-gray-700">No MF Loan data uploaded yet</h2>
          <p className="text-sm text-gray-400 mt-2 max-w-sm">
            Ask your employee to upload the <strong>Loan Balance Statement</strong> (and optionally
            the <strong>Transaction Statement</strong>) to populate this dashboard.
          </p>
          <p className="text-xs text-gray-400 mt-4">
            Upload path: <code className="bg-gray-100 px-1 rounded">/upload/mf-loan</code>
          </p>
        </div>
      ) : (
        <PeriodProvider portfolio="mf-loan">
          {/* ── KPI Summary ── */}
          <MfExecutiveSummary />

          {/* ── Disbursement ── */}
          <section>
            <h2 className="text-base font-semibold text-[#0f172a] mb-3">Disbursement</h2>
            <MfDisbursementSection />
          </section>

          {/* ── Collection ── */}
          <section>
            <h2 className="text-base font-semibold text-[#0f172a] mb-3">Collection</h2>
            <MfCollectionSection />
          </section>

          {/* ── Overdue & NPA ── */}
          <section>
            <h2 className="text-base font-semibold text-[#0f172a] mb-3">Overdue &amp; NPA</h2>
            <MfOverdueSection />
          </section>

          {/* ── Branch Breakdown ── */}
          <section>
            <h2 className="text-base font-semibold text-[#0f172a] mb-3">Branch Performance</h2>
            <MfBranchTable />
          </section>
        </PeriodProvider>
      )}
    </div>
  );
}
