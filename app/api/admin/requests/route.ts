import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requests = await prisma.accessRequest.findMany({
    include: {
      user: {
        select: { name: true, email: true, role: true, company: true },
      },
    },
    orderBy: { requestedAt: "desc" },
  });

  return NextResponse.json({ requests });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId, action, role, company } = await req.json();

  if (!requestId || !action) {
    return NextResponse.json({ error: "requestId and action are required" }, { status: 400 });
  }

  const existing = await prisma.accessRequest.findUnique({ where: { id: requestId } });
  if (!existing) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (action === "approve") {
    if (!role || !["EMPLOYEE", "MANAGEMENT"].includes(role)) {
      return NextResponse.json({ error: "Valid role required for approval" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: existing.userId },
        data: {
          role,
          company: company ?? existing.company,
          approvedAt: new Date(),
          approvedBy: session.user.email,
        },
      }),
      prisma.accessRequest.update({
        where: { id: requestId },
        data: {
          status: "approved",
          reviewedAt: new Date(),
          reviewedBy: session.user.email,
        },
      }),
    ]);
  } else if (action === "reject") {
    await prisma.accessRequest.update({
      where: { id: requestId },
      data: {
        status: "rejected",
        reviewedAt: new Date(),
        reviewedBy: session.user.email,
      },
    });
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
