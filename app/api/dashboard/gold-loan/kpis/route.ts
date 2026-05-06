import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDateRange } from "@/lib/gold-loan/period-utils";
import type { Period } from "@/context/PeriodContext";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const period = (searchParams.get("period") ?? "MTD") as Period;

  const { from, to } = getDateRange(period);

  try {
    // ── All active loan records in period ──────────────────────────────────
    const loans = await prisma.goldLoan.findMany({
      where: {
        updatedAt: { gte: from, lte: to },
        status: { not: "CANCELLED" },
      },
      select: {
        customerId: true,
        closingBalance: true,
        interestRate: true,
        dpd: true,
        goldWeight: true,
        goldRate: true,
        disbursementDate: true,
        collectedFromOverdue: true,
        overdueBalance: true,
        closedGoldGrams: true,
        loanStatus: true,
      },
    });

    const n = loans.length;

    // ── Total AUM ──────────────────────────────────────────────────────────
    const totalAUM = loans.reduce((s, l) => s + (l.closingBalance ?? 0), 0) / 1e7; // paise → ₹ Cr

    // ── Unique active customers ─────────────────────────────────────────────
    const totalCustomers = new Set(loans.map((l) => l.customerId)).size;

    // ── Avg Ticket Size (₹ Lakh) ───────────────────────────────────────────
    const avgTicketSize = totalCustomers > 0 ? (totalAUM * 100) / totalCustomers : 0; // Cr → L

    // ── Yield % ───────────────────────────────────────────────────────────
    const yieldPct =
      n > 0 ? loans.reduce((s, l) => s + (l.interestRate ?? 0), 0) / n : 0;

    // ── GNPA % ────────────────────────────────────────────────────────────
    const npaBalance = loans
      .filter((l) => (l.dpd ?? 0) > 90)
      .reduce((s, l) => s + (l.closingBalance ?? 0), 0);
    const gnpaPct = totalAUM > 0 ? (npaBalance / 1e7 / totalAUM) * 100 : 0;

    // ── Collection Efficiency % ───────────────────────────────────────────
    const totalCollected = loans.reduce((s, l) => s + (l.collectedFromOverdue ?? 0), 0);
    const totalOverdue = loans.reduce((s, l) => s + (l.overdueBalance ?? 0), 0);
    const collectionEfficiency = totalOverdue > 0 ? (totalCollected / totalOverdue) * 100 : 100;

    // ── Avg LTV % ─────────────────────────────────────────────────────────
    const ltvValues = loans
      .filter((l) => l.goldWeight && l.goldRate && l.goldWeight * l.goldRate > 0)
      .map((l) => (l.closingBalance! / (l.goldWeight! * l.goldRate!)) * 100);
    const avgLTV = ltvValues.length > 0 ? ltvValues.reduce((a, b) => a + b, 0) / ltvValues.length : 0;

    // ── Total Gold Weight (g) ──────────────────────────────────────────────
    const totalGoldWeight = loans.reduce((s, l) => s + (l.goldWeight ?? 0), 0);

    // ── Avg Rate per Gram (₹) ─────────────────────────────────────────────
    const avgRatePerGram =
      n > 0 ? loans.reduce((s, l) => s + (l.goldRate ?? 0), 0) / n : 0;

    // ── Avg Gold Value per Loan (₹ L) ─────────────────────────────────────
    const goldValues = loans.map((l) => (l.goldWeight ?? 0) * (l.goldRate ?? 0));
    const avgGoldValuePerLoan =
      n > 0 ? goldValues.reduce((a, b) => a + b, 0) / n / 1e5 : 0; // paise → ₹ L

    // ── New Customers (first disbursement in range) ────────────────────────
    const newCustomers = new Set(
      loans
        .filter(
          (l) =>
            l.disbursementDate &&
            new Date(l.disbursementDate) >= from &&
            new Date(l.disbursementDate) <= to
        )
        .map((l) => l.customerId)
    ).size;

    // ── Closed Loans — Grams Released ─────────────────────────────────────
    const closedLoansGrams = loans
      .filter((l) => l.loanStatus === "CLOSED")
      .reduce((s, l) => s + (l.closedGoldGrams ?? 0), 0);

    return NextResponse.json({
      totalAUM,
      totalCustomers,
      avgTicketSize,
      yield: yieldPct,
      gnpaPct,
      collectionEfficiency,
      avgLTV,
      totalGoldWeight,
      avgRatePerGram,
      avgGoldValuePerLoan,
      newCustomers,
      closedLoansGrams,
    });
  } catch (err) {
    console.error("[kpis] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
