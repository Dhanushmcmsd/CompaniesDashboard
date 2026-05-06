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

  return (
    <aside className="w-64 min-h-screen bg-[#0f172a] text-white p-4 flex flex-col">
      <div className="mb-6">
        <p className="font-bold text-lg">Companies</p>
        <p className="text-xs text-gray-400">Management Dashboard</p>
      </div>

      {role === "ADMIN" && (
        <Link href="/admin" className={`mb-3 block rounded-lg px-3 py-2 ${pathname.startsWith("/admin") ? "bg-white/20" : "bg-white/10 hover:bg-white/20"}`}>
          Admin Panel
        </Link>
      )}

      <nav className="flex-1 space-y-3">
        {(role === "MANAGEMENT" || role === "ADMIN") &&
          COMPANIES.filter((c) => (role === "ADMIN" ? true : c.name === company)).map((c) => (
            <div key={c.slug}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{c.name}</p>
              <div className="space-y-1">
                {c.portfolios.map((p) => (
                  <div key={p.slug}>
                    {p.active && "dashboardPath" in p ? (
                      <Link
                        href={p.dashboardPath}
                        className={`block rounded-lg px-3 py-2 text-sm ${pathname.startsWith(p.dashboardPath) ? "bg-white/20" : "hover:bg-white/10 text-gray-200"}`}
                      >
                        {p.name}
                      </Link>
                    ) : (
                      <div className="rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed">{p.name} · Coming Soon</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

        {(role === "EMPLOYEE" || role === "ADMIN") && (
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Uploads</p>
            {COMPANIES.filter((c) => (role === "ADMIN" ? true : c.name === company)).map((c) => (
              <div key={`${c.slug}-upload`} className="space-y-1">
                {c.portfolios.map((p) => (
                  <div key={`${p.slug}-upload`}>
                    {p.active && "uploadPath" in p ? (
                      <Link
                        href={p.uploadPath}
                        className={`block rounded-lg px-3 py-2 text-sm ${pathname.startsWith(p.uploadPath) ? "bg-white/20" : "hover:bg-white/10 text-gray-200"}`}
                      >
                        {c.name} · {p.name}
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
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
