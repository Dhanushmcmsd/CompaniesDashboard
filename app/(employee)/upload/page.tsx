"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { COMPANIES } from "@/lib/companies";

export default function EmployeeUploadPage() {
  const { data } = useSession();
  const user = data?.user;

  const company = COMPANIES.find((c) => c.slug === user?.company);

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[#0f172a]">
          Upload Portal — {company?.name ?? "Company"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {user?.name} · <span className="px-2 py-0.5 rounded bg-gray-100">EMPLOYEE</span>
        </p>
        <p className="text-xs text-gray-500 mt-2">Upload statements for your assigned portfolios</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(company?.portfolios ?? []).map((portfolio) => {
          const isActive = portfolio.active && "uploadPath" in portfolio;
          const uploadPath = isActive ? (portfolio as { uploadPath: string }).uploadPath : null;

          return isActive && uploadPath ? (
            <Link
              key={portfolio.slug}
              href={uploadPath}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-blue-200 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-[#0f172a] group-hover:text-blue-700 transition-colors">
                    {portfolio.name}
                  </p>
                  <p className="text-sm text-gray-400 mt-0.5">{company?.name}</p>
                </div>
                <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
                  Active
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-3">Click to upload Excel statements →</p>
            </Link>
          ) : (
            <div
              key={portfolio.slug}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 opacity-50 cursor-not-allowed"
            >
              <p className="font-semibold text-[#0f172a]">{portfolio.name}</p>
              <span className="text-xs mt-2 inline-block bg-gray-100 text-gray-500 rounded px-2 py-1">
                Coming Soon
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
