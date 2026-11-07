import "dotenv/config";

function str(key: string, fallback: string): string {
  const v = process.env[key];
  return v === undefined || v === "" ? fallback : v;
}

function num(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
}

export const env = {
  nodeEnv: str("NODE_ENV", "development"),
  port: num("PORT", 4000),
  databaseUrl: str("DATABASE_URL", "postgresql://rix:rixsecret@localhost:5432/rix?schema=public"),
  jwtSecret: str("JWT_SECRET", "change-me-in-production-a-long-random-string"),
  jwtExpiresIn: str("JWT_EXPIRES_IN", "7d"),
  corsOrigin: str("CORS_ORIGIN", "http://localhost:5173"),
  publicApiUrl: str("PUBLIC_API_URL", "http://localhost:4000"),
  platformName: str("PLATFORM_NAME", "ITRO"),
  platformTagline: str("PLATFORM_TAGLINE", "Indian Testing & Research Organisation"),
  platformPrimaryColor: str("PLATFORM_PRIMARY_COLOR", "#4f46e5"),
  platformDefaultCurrency: str("PLATFORM_DEFAULT_CURRENCY", "INR"),
  platformDefaultTaxRate: num("PLATFORM_DEFAULT_TAX_RATE", 0.18),
  platformTakeRate: num("PLATFORM_TAKE_RATE", 0.2),
};

export type Env = typeof env;
