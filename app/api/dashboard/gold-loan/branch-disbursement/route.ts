import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDateRange } from "@/lib/gold-loan/period-utils";
import type { Period } from "@/context/PeriodContext";

export async function GET(req: NextRequest) {
  const period = (req.nextUrl.searchParams.get("period") ?? "MTD") as Period;
  const { from, to } = getDateRange(period);

  try {
    const records = await prisma.goldLoan.findMany({
      where: { disbursementDate: { gte: from, lte: to } },
      select: { branch: true, disbursementAmount: true, disbursementTarget: true },
    });

    // ── Aggregate per branch ───────────────────────────────────────────────
    const map = new Map<string, { disbursement: number; target: number }>();

    for (const r of records) {
      const b = r.branch ?? "Unknown";
      const cur = map.get(b) ?? { disbursement: 0, target: 0 };
      map.set(b, {
        disbursement: cur.disbursement + (r.disbursementAmount ?? 0),
        target: cur.target + (r.disbursementTarget ?? 0),
      });
    }

    const result = Array.from(map.entries()).map(([branch, v]) => ({
      branch,
      disbursement: parseFloat((v.disbursement / 1e7).toFixed(2)),
      target: parseFloat((v.target / 1e7).toFixed(2)),
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("[branch-disbursement]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
