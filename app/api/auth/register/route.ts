import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { name, email, password, confirmPassword, company, note } = await req.json();
    const allowedCompanies = ["supra", "ideal", "cfcici", "centralbazar", "centora", "centralbiofuel"];

    if (!name || !email || !password || !confirmPassword || !company) {
      return NextResponse.json({ error: "All required fields must be provided" }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!allowedCompanies.includes(company)) {
      return NextResponse.json({ error: "Invalid company" }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
    }

    const existing = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });
    if (existing) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashed,
        role: "PENDING",
        company,
      },
    });

    await prisma.accessRequest.create({
      data: {
        userId: user.id,
        company,
        note: note || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to submit request" }, { status: 500 });
  }
}
