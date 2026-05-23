import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const USERS = [
  {
    name: "Admin",
    email: "admin@dashboard.com",
    password: "admin123",
    role: "ADMIN" as const,
    company: null,
  },
  {
    name: "Employee",
    email: "emp@dashboard.com",
    password: "emp123",
    role: "EMPLOYEE" as const,
    company: "supra",
  },
  {
    name: "Management",
    email: "management@dashboard.com",
    password: "mgmt123",
    role: "MANAGEMENT" as const,
    company: "supra",
  },
];

async function main() {
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
