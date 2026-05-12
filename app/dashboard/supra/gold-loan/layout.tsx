import { PeriodProvider } from '@/context/PeriodContext';
import { GoldLoanDataProvider } from '@/context/GoldLoanDataContext';

export default function GoldLoanLayout({ children }: { children: React.ReactNode }) {
  return (
    <PeriodProvider portfolio="gold-loan">
      <GoldLoanDataProvider>{children}</GoldLoanDataProvider>
    </PeriodProvider>
  );
}
