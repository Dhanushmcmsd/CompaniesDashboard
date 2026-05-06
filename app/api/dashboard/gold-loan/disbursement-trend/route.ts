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
      select: { disbursementDate: true, disbursementAmount: true },
    });

    // ── Aggregate by slot depending on period ──────────────────────────────
    const buckets = new Map<string, number>();

    for (const r of records) {
      if (!r.disbursementDate) continue;
      const d = new Date(r.disbursementDate);
      let key: string;

      if (period === "FTD") {
        // hourly slots: "09:00", "10:00" …
        key = `${String(d.getHours()).padStart(2, "0")}:00`;
      } else if (period === "MTD") {
        // daily: "01", "02" … "31"
        key = String(d.getDate()).padStart(2, "0");
      } else {
        // YTD: monthly — "Jan", "Feb" …
        key = d.toLocaleString("en-IN", { month: "short" });
      }

      buckets.set(key, (buckets.get(key) ?? 0) + (r.disbursementAmount ?? 0));
    }

    // ── Build sorted labels ────────────────────────────────────────────────
    let labels: string[];
    if (period === "FTD") {
      labels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
    } else if (period === "MTD") {
      const daysInMonth = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
      labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, "0"));
    } else {
      labels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    }

    const result = labels.map((label) => ({
      label,
      amount: parseFloat(((buckets.get(label) ?? 0) / 1e7).toFixed(2)), // → ₹ Cr
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("[disbursement-trend]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
