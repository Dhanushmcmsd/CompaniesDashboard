import { PeriodProvider } from '@/context/PeriodContext';

export default function MfLoanLayout({ children }: { children: React.ReactNode }) {
  return (
    <PeriodProvider>
      {children}
    </PeriodProvider>
  );
}
