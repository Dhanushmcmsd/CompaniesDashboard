import { PeriodProvider } from "@/context/PeriodContext";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

const ALLOWED_ROLES = ["admin", "supra_employee"];

export default async function GoldLoanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const role = cookieStore.get("role")?.value ?? null;

  if (!role || !ALLOWED_ROLES.includes(role)) {
    redirect("/dashboard?error=unauthorized");
  }

  return (
    <PeriodProvider>
      <div className="min-h-screen bg-[#f1f5f9] font-sans">{children}</div>
    </PeriodProvider>
  );
}
