import Link from "next/link";

export default function DashboardHome() {
  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Companies Dashboard</h1>
      <p className="text-gray-500 text-sm mb-8">Select a company and portfolio to view.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl">
        {/* Supra Pacific */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Supra Pacific</p>
          <div className="space-y-2">
            <Link
              href="/dashboard/supra/gold-loan"
              className="flex items-center gap-3 px-4 py-3 bg-[#0f172a] text-white rounded-xl hover:bg-[#1e2a38] transition text-sm font-medium"
            >
              <span>🏅</span>
              <span>Gold Loan Portfolio</span>
            </Link>
            <Link
              href="/dashboard/supra/gold-loan/upload"
              className="flex items-center gap-3 px-4 py-3 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 transition text-sm"
            >
              <span>⬆️</span>
              <span>Upload Data</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
