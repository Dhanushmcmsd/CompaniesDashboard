"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { COMPANIES } from "@/lib/companies";

export default function ManagementDashboardPage() {
  const { data } = useSession();
  const userCompany = data?.user.company;

  const company = COMPANIES.find((c) => c.slug === userCompany);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#0f172a] mb-5">Companies Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {company?.slug === "supra" ? (
          <Link href="/dashboard/supra" className="bg-[#0f172a] text-white rounded-2xl shadow p-5">
            <p className="font-bold">Supra Pacific</p>
            <p className="text-xs text-gray-300 mt-1">Open company portfolios</p>
          </Link>
        ) : (
          <div className="bg-white rounded-2xl shadow p-5 opacity-50 grayscale cursor-not-allowed">
            <p className="font-bold">{company?.name ?? "Assigned Company"}</p>
            <span className="text-xs mt-2 inline-block bg-gray-100 rounded px-2 py-1">Coming Soon</span>
          </div>
        )}
      </div>
    </div>
  );
}
