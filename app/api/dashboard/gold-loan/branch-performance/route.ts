import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const snap = await prisma.goldLoanSnapshot.findFirst({
      where: { company: "supra" },
      orderBy: { createdAt: "desc" },
    });

    if (!snap) return NextResponse.json({ branches: [] });

    const branchAUM   = (snap.branchAUM   ?? []) as { branch: string; aum: number; accounts: number }[];
    const branchNPA   = (snap.branchNPA   ?? []) as { branch: string; gnpaAmount: number; gnpaPct: number }[];
    const branchGold  = (snap.branchGoldWeight ?? []) as { branch: string; totalGoldWeight: number; avgPerLoan: number }[];
    const branchDisb  = (snap.branchDisbursement ?? []) as { branch: string; ftd: number; mtd: number; ytd: number }[];

    const npaMap  = Object.fromEntries(branchNPA.map((b) => [b.branch, b]));
    const goldMap = Object.fromEntries(branchGold.map((b) => [b.branch, b]));
    const disbMap = Object.fromEntries(branchDisb.map((b) => [b.branch, b]));

    const branches = branchAUM.map((b) => ({
      branch:          b.branch,
      aum:             b.aum,
      accounts:        b.accounts,
      gnpaPct:         npaMap[b.branch]?.gnpaPct        ?? 0,
      gnpaAmount:      npaMap[b.branch]?.gnpaAmount      ?? 0,
      totalGoldWeight: goldMap[b.branch]?.totalGoldWeight ?? 0,
      avgGoldPerLoan:  goldMap[b.branch]?.avgPerLoan      ?? 0,
      mtdDisb:         disbMap[b.branch]?.mtd             ?? 0,
      ytdDisb:         disbMap[b.branch]?.ytd             ?? 0,
    }));

    return NextResponse.json({ branches });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
