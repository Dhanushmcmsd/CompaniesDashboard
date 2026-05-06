import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const batch = await prisma.uploadBatch.findFirst({
      where:   { company: "supra", portfolio: "gold-loan", status: "done" },
      orderBy: { uploadedAt: "desc" },
      select:  { uploadedAt: true, uploadedBy: true, originalName: true, reportDate: true },
    });

    return NextResponse.json({
      lastUpdated: batch?.uploadedAt ?? null,
      uploadedBy:  batch?.uploadedBy ?? null,
      fileName:    batch?.originalName ?? null,
      reportDate:  batch?.reportDate ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
