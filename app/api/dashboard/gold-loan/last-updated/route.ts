import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const latest = await prisma.goldLoanBalance.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });

    return NextResponse.json({ lastUpdated: latest?.updatedAt ?? null });
  } catch {
    return NextResponse.json({ lastUpdated: null });
  }
}
