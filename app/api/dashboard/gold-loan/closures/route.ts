import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDateRange } from "@/lib/gold-loan/period-utils";
import type { Period } from "@/context/PeriodContext";

export async function GET(req: NextRequest) {
  const period = (req.nextUrl.searchParams.get("period") ?? "MTD") as Period;
  const { from, to } = getDateRange(period);

  try {
    // ── Closures within period ──────────────────────────────────────────────
    const closed = await prisma.goldLoan.findMany({
      where: { closureDate: { gte: from, lte: to } },
      select: {
        branch:          true,
        closedGoldGrams: true,
        closureReason:   true, // e.g. 'REPAYMENT' | 'AUCTION' | 'TAKEOVER' | 'FORECLOSURE'
      },
    });

    const totalClosures      = closed.length;
    const totalGramsReleased = closed.reduce((s, l) => s + (l.closedGoldGrams ?? 0), 0);
    const avgGramsPerClosure = totalClosures > 0 ? totalGramsReleased / totalClosures : 0;

    // ── Branch-wise grams ──────────────────────────────────────────────────
    const branchMap = new Map<string, number>();
    for (const l of closed) {
      const b = l.branch ?? "Unknown";
      branchMap.set(b, (branchMap.get(b) ?? 0) + (l.closedGoldGrams ?? 0));
    }
    const byBranch = Array.from(branchMap.entries()).map(([branch, grams]) => ({ branch, grams: parseFloat(grams.toFixed(2)) }));

    // ── Closure reason split ───────────────────────────────────────────────
    const reasonMap = new Map<string, number>();
    for (const l of closed) {
      const r = l.closureReason ?? "Other";
      reasonMap.set(r, (reasonMap.get(r) ?? 0) + 1);
    }
    const byReason = Array.from(reasonMap.entries()).map(([reason, count]) => ({ reason, count }));

    // ── Last 6 months trend (always, regardless of period) ─────────────────
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const trendRecords = await prisma.goldLoan.findMany({
      where: { closureDate: { gte: sixMonthsAgo, lte: to } },
      select: { closureDate: true, closedGoldGrams: true },
    });

    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    // Build 6 month labels in order
    const monthLabels: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthLabels.push(`${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`);
    }

    const trendMap = new Map<string, number>();
    for (const r of trendRecords) {
      if (!r.closureDate) continue;
      const d = new Date(r.closureDate);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;
      trendMap.set(key, (trendMap.get(key) ?? 0) + (r.closedGoldGrams ?? 0));
    }
    const monthlyTrend = monthLabels.map(month => ({
      month,
      grams: parseFloat((trendMap.get(month) ?? 0).toFixed(2)),
    }));

    return NextResponse.json({
      totalClosures,
      totalGramsReleased: parseFloat(totalGramsReleased.toFixed(2)),
      avgGramsPerClosure: parseFloat(avgGramsPerClosure.toFixed(2)),
      byBranch,
      monthlyTrend,
      byReason,
    });
  } catch (err) {
    console.error("[closures]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
