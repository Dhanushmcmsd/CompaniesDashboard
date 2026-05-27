/**
 * Normalize Neon DATABASE_URL for Prisma on Windows/local dev.
 * - Strips channel_binding (often breaks Node/OpenSSL + pooler on Windows)
 * - Ensures sslmode=require
 * - Adds connect_timeout for Neon cold starts after scale-to-zero
 */
export function getDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    throw new Error(
      "DATABASE_URL is missing. Copy .env.local.example to .env.local and set your Neon connection string.",
    );
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }

  url.searchParams.delete("channel_binding");
  if (!url.searchParams.has("sslmode")) {
    url.searchParams.set("sslmode", "require");
  }
  if (!url.searchParams.has("connect_timeout")) {
    url.searchParams.set("connect_timeout", "15");
  }

  return url.toString();
}
