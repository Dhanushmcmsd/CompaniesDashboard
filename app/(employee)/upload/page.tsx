"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { COMPANIES } from "@/lib/companies";

export default function EmployeeUploadPage() {
  const { data } = useSession();
  const user = data?.user;

  const companies = COMPANIES.filter((c) => c.name === user?.company || user?.role === "ADMIN");

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[#0f172a]">Upload Portal — {user?.company ?? "Company"}</h1>
        <p className="text-sm text-gray-500 mt-1">{user?.name} · <span className="px-2 py-0.5 rounded bg-gray-100">{user?.role}</span></p>
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="mt-3 bg-[#0f172a] text-white rounded-xl px-3 py-2 hover:bg-[#1e3a5f]">Logout</button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {companies.flatMap((c) => c.portfolios.map((p) => ({ company: c, portfolio: p }))).map(({ company, portfolio }) => (
          portfolio.active && "uploadPath" in portfolio ? (
            <Link key={`${company.slug}-${portfolio.slug}`} href={portfolio.uploadPath} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <p className="font-semibold text-[#0f172a]">{company.name}</p>
              <p className="text-sm text-gray-500">{portfolio.name}</p>
            </Link>
          ) : (
            <div key={`${company.slug}-${portfolio.slug}`} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 opacity-50 grayscale cursor-not-allowed">
              <p className="font-semibold text-[#0f172a]">{portfolio.name}</p>
              <span className="text-xs mt-2 inline-block bg-gray-100 rounded px-2 py-1">Coming Soon</span>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
