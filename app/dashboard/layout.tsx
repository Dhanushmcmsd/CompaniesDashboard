"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { status, data } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && data.user.role !== "MANAGEMENT") {
      router.replace("/dashboard");
    }
  }, [status, data, router]);

  if (status !== "authenticated") return <div className="min-h-screen bg-[#f1f5f9] animate-pulse" />;
  if (data.user.role !== "MANAGEMENT") return <div className="min-h-screen bg-[#f1f5f9] animate-pulse" />;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
