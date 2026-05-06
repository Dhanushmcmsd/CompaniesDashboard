import { PeriodProvider } from "@/context/PeriodContext";

export default function GoldLoanLayout({ children }: { children: React.ReactNode }) {
  return (
    <PeriodProvider>
      <div className="min-h-screen bg-[#f1f5f9] font-sans">{children}</div>
    </PeriodProvider>
  );
}
