import { PrismaClient } from "@prisma/client";
import { getDatabaseUrl } from "@/lib/database-url";

function loadEnvIfNeeded() {
  if (process.env.DATABASE_URL?.trim()) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loadEnvConfig } = require("@next/env") as {
      loadEnvConfig: (dir: string, dev: boolean) => void;
    };
    loadEnvConfig(process.cwd(), true);
  } catch {
    // Next.js loads env in dev/prod; scripts should call loadEnvConfig themselves.
  }
}

loadEnvIfNeeded();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  return new PrismaClient({
    datasources: {
      db: { url: getDatabaseUrl() },
    },
  });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? (globalForPrisma.prisma = createPrismaClient());
