import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !["EMPLOYEE", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.uploadBatch.findMany({
    where: { company: "supra", portfolio: "gold-loan" },
    orderBy: { uploadedAt: "desc" },
    take: 10,
  });

  return NextResponse.json({ items });
}
