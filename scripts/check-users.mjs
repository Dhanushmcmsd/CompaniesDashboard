import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true);

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  const users = await prisma.user.findMany({
    select: { email: true, role: true, approvedAt: true },
    orderBy: { email: "asc" },
  });
  console.log(JSON.stringify(users, null, 2));
} catch (error) {
  console.error("ERR", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
