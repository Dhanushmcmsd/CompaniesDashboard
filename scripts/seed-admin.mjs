import nextEnv from "@next/env";
import bcrypt from "bcryptjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true);

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const USERS = [
  {
    name: "Admin",
    email: "admin@dashboard.com",
    password: "admin123",
    role: "ADMIN",
    company: null,
  },
  {
    name: "Employee",
    email: "emp@dashboard.com",
    password: "emp123",
    role: "EMPLOYEE",
    company: "supra",
  },
  {
    name: "Management",
    email: "management@dashboard.com",
    password: "mgmt123",
    role: "MANAGEMENT",
    company: "supra",
  },
];

try {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is missing. Copy .env.local.example to .env.local first.");
  }

  await prisma.accessRequest.deleteMany();
  await prisma.user.deleteMany();

  for (const user of USERS) {
    const password = await bcrypt.hash(user.password, 10);
    await prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        password,
        role: user.role,
        company: user.company,
        approvedAt: new Date(),
        approvedBy: "seed-script",
      },
    });
    console.log(`Seeded: ${user.email} / ${user.password} (${user.role})`);
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
