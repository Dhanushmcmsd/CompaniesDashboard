"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { COMPANIES } from "@/lib/companies";

export default function Sidebar() {
  const pathname = usePathname();
  const { data } = useSession();
  const user = data?.user;

  const role = user?.role;
  const company = user?.company;

  const mgmtCompany = COMPANIES.find((c) => c.slug === company);

  return (
    <aside className="w-64 min-h-screen bg-[#0f172a] text-white p-4 flex flex-col">
      <div className="mb-6">
        <p className="font-bold text-lg">Companies</p>
        <p className="text-xs text-gray-400">Management Dashboard</p>
      </div>

      <nav className="flex-1 space-y-3">
        {role === "ADMIN" && (
          <div className="space-y-1">
            <Link href="/admin" className={`block rounded-lg px-3 py-2 text-sm ${pathname.startsWith("/admin") ? "bg-white/20" : "hover:bg-white/10 text-gray-200"}`}>
              Admin Panel
            </Link>
            <Link href="/admin" className={`block rounded-lg px-3 py-2 text-sm ${pathname.startsWith("/admin") ? "bg-white/20" : "hover:bg-white/10 text-gray-200"}`}>
              Logs / Access Requests
            </Link>
          </div>
        )}

        {role === "MANAGEMENT" && mgmtCompany && (
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{mgmtCompany.name}</p>
            <div className="space-y-1">
              <Link href="/dashboard" className={`block rounded-lg px-3 py-2 text-sm ${pathname === "/dashboard" ? "bg-white/20" : "hover:bg-white/10 text-gray-200"}`}>
                Company Selector
              </Link>
              {mgmtCompany.portfolios.map((p) => (
                p.active && "dashboardPath" in p ? (
                  <Link
                    key={p.slug}
                    href={p.dashboardPath!}
                    className={`block rounded-lg px-3 py-2 text-sm ${pathname.startsWith(p.dashboardPath!) ? "bg-white/20" : "hover:bg-white/10 text-gray-200"}`}
                  >
                    {p.name}
                  </Link>
                ) : (
                  <div key={p.slug} className="rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed">{p.name} · Coming Soon</div>
                )
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="pt-4 border-t border-white/10">
        <p className="text-sm font-medium">{user?.name ?? "User"}</p>
        <p className="text-xs text-gray-400 mb-2">{role ?? "Unknown"}</p>
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="w-full bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 text-sm">
          Sign Out
        </button>
      </div>
    </aside>
  );
}
