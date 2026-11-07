import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

// The shared remote Postgres closes idle sessions (idle_session_timeout, SqlState
// 57P05). Prisma's pool can then hand a request a dead connection, which fails with
// "Can't reach database server" / P1001 / P1017 on the FIRST use — a spurious error
// even though the DB is healthy. Retry those transient connection errors once or
// twice; the engine transparently opens a fresh connection on the retry.
function isTransientConnectionError(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  if (code === "P1001" || code === "P1017") return true;
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return /Can't reach database server|terminating connection due to idle-session timeout|idle-session timeout|server has closed the connection|Connection (reset|closed)|57P05|ECONNRESET/i.test(msg);
}

const RETRY_DELAYS_MS = [100, 300, 700];

// $use middleware keeps `prisma` typed as PrismaClient (no ripple through the app).
prisma.$use(async (params, next) => {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await next(params);
    } catch (e) {
      lastErr = e;
      if (attempt === RETRY_DELAYS_MS.length || !isTransientConnectionError(e)) throw e;
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
  throw lastErr;
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
