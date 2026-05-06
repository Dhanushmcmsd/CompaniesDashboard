import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // Gold rate from env — fallback to 9240 ₹/g if not set
  const goldRate = parseFloat(process.env.GOLD_RATE_PER_GRAM ?? "9240");

  try {
    // Fetch all active loans with gold collateral data
    const loans = await prisma.goldLoan.findMany({
      where: {
        status: { not: "CANCELLED" },
        loanStatus: { not: "CLOSED" },
        goldWeight: { gt: 0 },
      },
      select: {
        customerId:     true,
        customerName:   true,
        branch:         true,
        closingBalance: true,  // loan outstanding (₹ paise or direct ₹ — see note)
        goldWeight:     true,  // grams
      },
    });

    // ── Filter: outstanding > gold_weight × gold_rate ──────────────────────
    const highRisk = loans
      .map(l => ({
        customerId:       l.customerId,
        name:             l.customerName ?? "—",
        branch:           l.branch ?? "Unknown",
        outstanding:      l.closingBalance ?? 0,
        goldWeight:       l.goldWeight ?? 0,
        currentGoldValue: (l.goldWeight ?? 0) * goldRate,
        excessRisk:       (l.closingBalance ?? 0) - (l.goldWeight ?? 0) * goldRate,
      }))
      .filter(c => c.excessRisk > 0)
      .sort((a, b) => b.excessRisk - a.excessRisk); // highest risk first

    return NextResponse.json({ goldRate, customers: highRisk });
  } catch (err) {
    console.error("[high-risk]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
