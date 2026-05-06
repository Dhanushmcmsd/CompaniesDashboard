"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const { status, data } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && data.user.role !== "EMPLOYEE") {
      router.replace("/upload");
    }
  }, [status, data, router]);

  if (status !== "authenticated") return <div className="min-h-screen bg-[#f8fafc] animate-pulse" />;
  if (data.user.role !== "EMPLOYEE") return <div className="min-h-screen bg-[#f8fafc] animate-pulse" />;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="bg-[#0f172a] text-white px-6 py-4 flex items-center justify-between">
        <div>
          <p className="font-semibold">Upload Portal</p>
          <p className="text-xs text-gray-300">{data.user.company ?? "Company"}</p>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="bg-white/10 px-3 py-2 rounded-lg text-sm">Logout</button>
      </header>
      {children}
    </div>
  );
}
