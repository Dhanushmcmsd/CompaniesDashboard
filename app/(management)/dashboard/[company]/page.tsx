import Link from "next/link";
import { notFound } from "next/navigation";
import { COMPANIES } from "@/lib/companies";

export default function CompanyPage({ params }: { params: { company: string } }) {
  const company = COMPANIES.find((c) => c.slug === params.company);
  if (!company) return notFound();

  const isSupra = company.slug === "supra";

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:underline">← Back</Link>
        <h1 className="text-2xl font-bold text-[#0f172a]">{company.name}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isSupra ? (
          company.portfolios.map((p) => (
            p.active && "dashboardPath" in p ? (
              <Link key={p.slug} href={p.dashboardPath!} className="bg-[#0f172a] text-white rounded-2xl shadow p-5 hover:bg-slate-700 transition-colors">
                <p className="font-semibold text-lg">{p.name}</p>
                <p className="text-xs text-slate-300 mt-1">View Dashboard →</p>
              </Link>
            ) : (
              <div key={p.slug} className="bg-white rounded-2xl shadow p-5 opacity-50 grayscale cursor-not-allowed">
                <p className="font-semibold">{p.name}</p>
                <span className="text-xs mt-2 inline-block bg-gray-100 rounded px-2 py-1">Coming Soon</span>
              </div>
            )
          ))
        ) : (
          <div className="bg-white rounded-2xl shadow p-5 opacity-50 grayscale cursor-not-allowed">
            <p className="font-semibold">No configured portfolios</p>
            <span className="text-xs mt-2 inline-block bg-gray-100 rounded px-2 py-1">Coming Soon</span>
          </div>
        )}
      </div>
    </div>
  );
}
