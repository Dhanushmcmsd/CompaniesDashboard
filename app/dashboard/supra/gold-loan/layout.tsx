import { PeriodProvider } from '@/context/PeriodContext';

export default function GoldLoanLayout({ children }: { children: React.ReactNode }) {
  return (
    <PeriodProvider portfolio="gold-loan">
      {children}
    </PeriodProvider>
  );
}
