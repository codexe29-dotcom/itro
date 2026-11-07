import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

export interface DatabaseProbe {
  connected: boolean;
  code?: string;
}

function databaseErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }

  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/Can't reach database server|ECONNREFUSED|ECONNRESET/i.test(message)) return "P1001";
  if (/Authentication failed/i.test(message)) return "P1000";
  if (/database .* does not exist/i.test(message)) return "P1003";
  if (/server has closed the connection/i.test(message)) return "P1017";
  if (/invalid database url/i.test(message)) return "P1013";
  return undefined;
}

export async function probeDatabase(): Promise<DatabaseProbe> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT 1`;
      },
      { maxWait: 1_000, timeout: 2_000 },
    );
    return { connected: true };
  } catch (error) {
    return { connected: false, code: databaseErrorCode(error) };
  }
}

export function databaseFailureReason(code?: string): string {
  switch (code) {
    case "P1000":
      return "The database rejected the configured credentials.";
    case "P1001":
      return "The database server could not be reached. Check its address, port, firewall, and availability.";
    case "P1003":
      return "The configured database does not exist.";
    case "P1013":
      return "The database URL is malformed. Check its format and URL-encode special characters in credentials.";
    case "P1017":
      return "The database server closed the connection.";
    default:
      return "The database query failed. Check the API logs and database configuration.";
  }
}

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
