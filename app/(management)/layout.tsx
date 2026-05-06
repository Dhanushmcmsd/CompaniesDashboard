"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";

export default function ManagementLayout({ children }: { children: React.ReactNode }) {
  const { status, data } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && !["MANAGEMENT", "ADMIN"].includes(data.user.role)) {
      router.replace("/login");
    }
  }, [status, data, router]);

  if (status !== "authenticated") {
    return <div className="min-h-screen bg-[#f1f5f9] animate-pulse" />;
  }

  return (
    <div className="flex min-h-screen bg-[#f1f5f9]">
      <Sidebar />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
