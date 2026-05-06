export type Period = 'FTD' | 'MTD' | 'YTD';

export interface GoldLoanKPIs {
  totalAUM: number;             // ₹ Crore
  totalDisbursement: number;    // ₹ Crore
  disbursementTarget: number;   // ₹ Crore
  targetAchievedPct: number;    // %
  activeAccounts: number;       // count
  newAccountsAdded: number;     // count
  collectionEfficiency: number; // %
  totalOverdue: number;         // ₹ Crore
  npaAmount: number;            // ₹ Crore
  npaPct: number;               // %
  avgLTV: number;               // %
  goldUnderCustody: number;     // grams
}

export interface DisbursementRecord {
  date: string;    // 'YYYY-MM-DD'
  branch: string;
  amount: number;  // ₹ Crore
  target: number;  // ₹ Crore
}

export type OverdueBucket = '0-30' | '31-60' | '61-90' | '90+';

export interface OverdueBucketData {
  bucket: OverdueBucket;
  amount: number; // ₹ Crore
  pct: number;    // % of total overdue
}

export interface BranchPerformance {
  branch: string;
  aum: number;               // ₹ Crore
  disbursement: number;      // ₹ Crore
  target: number;            // ₹ Crore
  collectionEff: number;     // %
  npa: number;               // %
  avgGoldWeight: number;     // grams per account
}

export interface HighRiskCustomer {
  customerId: string;
  name: string;
  branch: string;
  outstanding: number;       // ₹ Crore
  goldWeight: number;        // grams
  currentGoldValue: number;  // ₹ Crore (at today's rate)
  excess: number;            // outstanding - goldValue (positive = under-secured)
}
