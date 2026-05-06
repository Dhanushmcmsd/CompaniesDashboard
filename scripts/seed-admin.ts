import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("admin123", 10);

  await prisma.user.upsert({
    where: { email: "admin@supra.com" },
    update: {
      name: "Admin",
      password,
      role: "ADMIN",
      company: "Supra Pacific",
      approvedAt: new Date(),
      approvedBy: "seed-script",
    },
    create: {
      name: "Admin",
      email: "admin@supra.com",
      password,
      role: "ADMIN",
      company: "Supra Pacific",
      approvedAt: new Date(),
      approvedBy: "seed-script",
    },
  });

  console.log("Admin user seeded: admin@supra.com / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
