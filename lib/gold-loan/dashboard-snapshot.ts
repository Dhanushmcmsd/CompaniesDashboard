import type { GoldLoanSnapshot } from "@prisma/client";

/** Daily disbursement trend points (matches disbursement-trend API). */
export type DisbursementTrendPoint = {
  date: string;
  ftd: number;
  mtd: number;
};

export type GoldLoanDashboardSnapshot = {
  kpis: {
    totalAUM: number;
    totalCustomers: number;
    totalAccounts: number;
    avgTicketSize: number;
    avgYield: number;
    gnpaPct: number;
    gnpaAmount: number;
    nnpaPct: number;
    collectionEfficiency: number;
    overdueCollection: number;
    totalOverdue: number;
    overduePercent: number;
    avgLTV: number;
    totalGoldWeight: number;
    avgPresentRate: number;
    avgGoldValuePerLoan: number;
    newDisbursements: number;
    mtdDisbursements: number;
    ytdDisbursements: number;
  } | null;
  alerts: { type: string; severity: string; message: string; count: number }[];
  disbursementTrend: DisbursementTrendPoint[];
  branchDisbursement: { branch: string; ftd: number; mtd: number; ytd: number }[];
  disbVsCollection: {
    mtdDisbursements: number;
    ytdDisbursements: number;
    overdueCollection: number;
    totalOverdue: number;
  } | null;
  overdue: {
    buckets: { label: string; amount: number; pct: number }[];
    totalOverdue: number;
    overduePercent: number;
    overdueCollection: number;
    collectionEfficiency: number;
  };
  newCustomers: {
    totalCustomers: number;
    totalAccounts: number;
    newCustomers: number | string;
    mtdDisbursements: number;
    ftdDisbursements: number;
    newCustomersNote?: string;
  };
  closures: {
    totalGoldWeight: number;
    avgGoldWeightPerLoan: number;
    closedGrams: null;
    note: string;
  } | null;
  highRisk: {
    goldRate: number;
    highRiskCount: number;
    highLTVCount: number;
    accounts: unknown[];
    dataNote?: string;
  };
  npaRisk: {
    gnpaAmount: number;
    gnpaPct: number;
    nnpaPct: number;
    auctionCases: number;
    sma0: number;
    sma1: number;
    sma2: number;
    npa: number;
    branchNPA: { branch: string; gnpaAmount: number; gnpaPct: number }[];
    dataNote?: string;
  } | null;
  goldLtv: {
    avgLTV: number;
    avgPresentRate: number;
    avgGoldValuePerLoan: number;
    totalGoldWeight: number;
    avgGoldWeightPerLoan: number;
    auctionCases: number;
    highLTVAccounts: number;
    goldValueMismatch: number;
  } | null;
  branchPerformance: {
    branch: string;
    aum: number;
    accounts: number;
    gnpaPct: number;
    gnpaAmount: number;
    totalGoldWeight: number;
    avgGoldPerLoan: number;
    mtdDisb: number;
    ytdDisb: number;
  }[];
};

function buildAlerts(snap: GoldLoanSnapshot) {
  const alerts: GoldLoanDashboardSnapshot["alerts"] = [];
  if (snap.goldValueMismatch > 0) {
    alerts.push({
      type: "gold-mismatch",
      severity: "high",
      message: `${snap.goldValueMismatch} loan(s) where outstanding exceeds current gold value`,
      count: snap.goldValueMismatch,
    });
  }
  if (snap.highLTVAccounts > 0) {
    alerts.push({
      type: "high-ltv",
      severity: "medium",
      message: `${snap.highLTVAccounts} account(s) with LTV above 85%`,
      count: snap.highLTVAccounts,
    });
  }
  if (snap.gnpaPct > 2) {
    alerts.push({
      type: "npa-spike",
      severity: "high",
      message: `GNPA at ${snap.gnpaPct.toFixed(2)}% — above 2% threshold`,
      count: snap.auctionCases,
    });
  }
  if (snap.collectionEfficiency < 80) {
    alerts.push({
      type: "low-collection",
      severity: "medium",
      message: `Collection efficiency at ${snap.collectionEfficiency.toFixed(1)}% — below 80% target`,
      count: 0,
    });
  }
  return alerts;
}

function buildBranchPerformance(snap: GoldLoanSnapshot): GoldLoanDashboardSnapshot["branchPerformance"] {
  const branchAUM = (snap.branchAUM ?? []) as { branch: string; aum: number; accounts: number }[];
  const branchNPA = (snap.branchNPA ?? []) as { branch: string; gnpaAmount: number; gnpaPct: number }[];
  const branchGold = (snap.branchGoldWeight ?? []) as { branch: string; totalGoldWeight: number; avgPerLoan: number }[];
  const branchDisb = (snap.branchDisbursement ?? []) as { branch: string; ftd: number; mtd: number; ytd: number }[];

  const npaMap = Object.fromEntries(branchNPA.map((b) => [b.branch, b]));
  const goldMap = Object.fromEntries(branchGold.map((b) => [b.branch, b]));
  const disbMap = Object.fromEntries(branchDisb.map((b) => [b.branch, b]));

  return branchAUM.map((b) => ({
    branch: b.branch,
    aum: b.aum,
    accounts: b.accounts,
    gnpaPct: npaMap[b.branch]?.gnpaPct ?? 0,
    gnpaAmount: npaMap[b.branch]?.gnpaAmount ?? 0,
    totalGoldWeight: goldMap[b.branch]?.totalGoldWeight ?? 0,
    avgGoldPerLoan: goldMap[b.branch]?.avgPerLoan ?? 0,
    mtdDisb: disbMap[b.branch]?.mtd ?? 0,
    ytdDisb: disbMap[b.branch]?.ytd ?? 0,
  }));
}

/**
 * Single-request payload for the gold-loan management dashboard.
 * `trendSnaps` = last N snapshots for the disbursement trend chart (same logic as disbursement-trend API).
 */
export function aggregateGoldLoanDashboard(
  snap: GoldLoanSnapshot | null,
  trendSnaps: Pick<GoldLoanSnapshot, "reportDate" | "createdAt" | "newDisbursements" | "mtdDisbursements">[],
): GoldLoanDashboardSnapshot {
  const disbursementTrend: DisbursementTrendPoint[] = trendSnaps.map((s) => ({
    date: (s.reportDate ?? s.createdAt).toISOString().slice(0, 10),
    ftd: s.newDisbursements,
    mtd: s.mtdDisbursements,
  }));

  if (!snap) {
    return {
      kpis: null,
      alerts: [],
      disbursementTrend,
      branchDisbursement: [],
      disbVsCollection: null,
      overdue: {
        buckets: [],
        totalOverdue: 0,
        overduePercent: 0,
        overdueCollection: 0,
        collectionEfficiency: 0,
      },
      newCustomers: {
        totalCustomers: 0,
        totalAccounts: 0,
        newCustomers: 0,
        mtdDisbursements: 0,
        ftdDisbursements: 0,
      },
      closures: null,
      highRisk: { goldRate: 0, highRiskCount: 0, highLTVCount: 0, accounts: [] },
      npaRisk: null,
      goldLtv: null,
      branchPerformance: [],
    };
  }

  const totalAUM = snap.totalAUM || 1;

  return {
    kpis: {
      totalAUM: snap.totalAUM,
      totalCustomers: snap.totalCustomers,
      totalAccounts: snap.totalAccounts,
      avgTicketSize: snap.avgTicketSize,
      avgYield: snap.avgYield,
      gnpaPct: snap.gnpaPct,
      gnpaAmount: snap.gnpaAmount,
      nnpaPct: snap.nnpaPct,
      collectionEfficiency: snap.collectionEfficiency,
      overdueCollection: snap.overdueCollection,
      totalOverdue: snap.totalOverdue,
      overduePercent: snap.overduePercent,
      avgLTV: snap.avgLTV,
      totalGoldWeight: snap.totalGoldWeight,
      avgPresentRate: snap.avgPresentRate,
      avgGoldValuePerLoan: snap.avgGoldValuePerLoan,
      newDisbursements: snap.newDisbursements,
      mtdDisbursements: snap.mtdDisbursements,
      ytdDisbursements: snap.ytdDisbursements,
    },
    alerts: buildAlerts(snap),
    disbursementTrend,
    branchDisbursement: (snap.branchDisbursement ?? []) as GoldLoanDashboardSnapshot["branchDisbursement"],
    disbVsCollection: {
      mtdDisbursements: snap.mtdDisbursements,
      ytdDisbursements: snap.ytdDisbursements,
      overdueCollection: snap.overdueCollection,
      totalOverdue: snap.totalOverdue,
    },
    overdue: {
      buckets: [
        { label: "0–30 Days", amount: snap.bucket0to30, pct: (snap.bucket0to30 / totalAUM) * 100 },
        { label: "31–60 Days", amount: snap.bucket31to60, pct: (snap.bucket31to60 / totalAUM) * 100 },
        { label: "61–90 Days", amount: snap.bucket61to90, pct: (snap.bucket61to90 / totalAUM) * 100 },
        { label: "90+ Days", amount: snap.bucket90plus, pct: (snap.bucket90plus / totalAUM) * 100 },
      ],
      totalOverdue: snap.totalOverdue,
      overduePercent: snap.overduePercent,
      overdueCollection: snap.overdueCollection,
      collectionEfficiency: snap.collectionEfficiency,
    },
    newCustomers: {
      totalCustomers: snap.totalCustomers,
      totalAccounts: snap.totalAccounts,
      newCustomers: snap.newDisbursements ?? 0,
      newCustomersNote: "FTD disbursement amount (new borrower count not yet available)",
      mtdDisbursements: snap.mtdDisbursements,
      ftdDisbursements: snap.newDisbursements,
    },
    closures: {
      totalGoldWeight: snap.totalGoldWeight,
      avgGoldWeightPerLoan: snap.avgGoldWeightPerLoan,
      closedGrams: null,
      note: "Upload a Closed Loans statement for detailed closure data",
    },
    highRisk: {
      goldRate: snap.avgPresentRate,
      highRiskCount: snap.goldValueMismatch,
      highLTVCount: snap.highLTVAccounts,
      accounts: [],
      dataNote: "Counts based on Rate Per Gram column in uploaded file. Ensure this matches current market gold rate.",
    },
    npaRisk: {
      gnpaAmount: snap.gnpaAmount,
      gnpaPct: snap.gnpaPct,
      nnpaPct: snap.nnpaPct,
      auctionCases: snap.auctionCases,
      sma0: snap.bucket0to30,
      sma1: snap.bucket31to60,
      sma2: snap.bucket61to90,
      npa: snap.bucket90plus,
      branchNPA: (snap.branchNPA ?? []) as {
        branch: string;
        gnpaAmount: number;
        gnpaPct: number;
      }[],
      dataNote: "DPD-based classification. Ensure uploaded file has current-date DPD values for accuracy.",
    },
    goldLtv: {
      avgLTV: snap.avgLTV,
      avgPresentRate: snap.avgPresentRate,
      avgGoldValuePerLoan: snap.avgGoldValuePerLoan,
      totalGoldWeight: snap.totalGoldWeight,
      avgGoldWeightPerLoan: snap.avgGoldWeightPerLoan,
      auctionCases: snap.auctionCases,
      highLTVAccounts: snap.highLTVAccounts,
      goldValueMismatch: snap.goldValueMismatch,
    },
    branchPerformance: buildBranchPerformance(snap),
  };
}
