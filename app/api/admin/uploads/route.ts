import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const portfolio = searchParams.get("portfolio") ?? undefined;
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);

  const items = await prisma.uploadBatch.findMany({
    where: portfolio ? { portfolio } : undefined,
    orderBy: { uploadedAt: "desc" },
    take: limit,
    select: {
      id: true,
      company: true,
      portfolio: true,
      fileType: true,
      originalName: true,
      reportDate: true,
      rowCount: true,
      status: true,
      uploadedBy: true,
      uploadedAt: true,
      errors: true,
      parseMeta: true,
    },
  });

  return NextResponse.json({ items });
}
