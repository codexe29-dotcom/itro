import "dotenv/config";
import { z } from "zod";

const envSchema = {
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),
  port: z.coerce.number().int().positive().default(4000),
  databaseUrl: z.string().trim().default(""),
  jwtSecret: z.string().trim().default(""),
  storageDriver: z.enum(["local", "s3"]).default("local"),
  s3BucketName: z.string().trim().default(""),
  s3Region: z.string().trim().default(""),
  s3AccessKeyId: z.string().trim().default(""),
  s3SecretAccessKey: z.string().trim().default(""),
  s3Endpoint: z.string().trim().default(""),
  storagePublicBaseUrl: z.string().trim().default(""),
  jwtExpiresIn: z.string().trim().default("7d"),
  corsOrigin: z.string().trim().default("http://localhost:5000"),
  publicApiUrl: z.string().trim().default("http://localhost:4000"),
  publicWebUrl: z.string().trim().default("http://localhost:5000"),
  storageLocalRoot: z.string().trim().default(process.cwd()),
  platformName: z.string().trim().default("ITRO"),
  platformTagline: z.string().trim().default("Indian Testing & Research Organisation"),
  platformPrimaryColor: z.string().trim().default("#4f46e5"),
  platformDefaultCurrency: z.string().trim().default("INR"),
  platformDefaultTaxRate: z.coerce.number().default(0.18),
  platformTakeRate: z.coerce.number().default(0.2),
};

const nodeEnv = envSchema.nodeEnv.parse(process.env.NODE_ENV ?? "development");
const port = envSchema.port.parse(process.env.PORT ?? "4000");
const databaseUrl = envSchema.databaseUrl.parse(process.env.DATABASE_URL ?? "").trim();
const jwtSecret = envSchema.jwtSecret.parse(process.env.JWT_SECRET ?? "").trim();
const storageDriverInput = (process.env.STORAGE_DRIVER ?? "").trim().toLowerCase();
const storageDriver = envSchema.storageDriver.parse(
  storageDriverInput || (nodeEnv === "production" ? "s3" : "local"),
);
const s3BucketName = envSchema.s3BucketName.parse(process.env.S3_BUCKET_NAME ?? "").trim();
const s3Region = envSchema.s3Region.parse(process.env.S3_REGION ?? "").trim();
const s3AccessKeyId = envSchema.s3AccessKeyId.parse(process.env.S3_ACCESS_KEY_ID ?? "").trim();
const s3SecretAccessKey = envSchema.s3SecretAccessKey.parse(process.env.S3_SECRET_ACCESS_KEY ?? "").trim();
const s3Endpoint = envSchema.s3Endpoint.parse(process.env.S3_ENDPOINT ?? "").trim();
const storagePublicBaseUrl = envSchema.storagePublicBaseUrl
  .parse(process.env.STORAGE_PUBLIC_BASE_URL ?? "")
  .replace(/\/+$/, "");
const jwtExpiresIn = envSchema.jwtExpiresIn.parse(process.env.JWT_EXPIRES_IN ?? "7d").trim();
const corsOrigin = envSchema.corsOrigin.parse(process.env.CORS_ORIGIN ?? "http://localhost:5000").trim();
const publicApiUrl = envSchema.publicApiUrl.parse(process.env.PUBLIC_API_URL ?? "http://localhost:4000").trim();
const publicWebUrl = envSchema.publicWebUrl.parse(process.env.PUBLIC_WEB_URL ?? "http://localhost:5000").trim();
const storageLocalRoot = envSchema.storageLocalRoot.parse(process.env.STORAGE_LOCAL_ROOT ?? process.cwd()).trim();
const platformName = envSchema.platformName.parse(process.env.PLATFORM_NAME ?? "ITRO").trim();
const platformTagline = envSchema.platformTagline.parse(process.env.PLATFORM_TAGLINE ?? "Indian Testing & Research Organisation").trim();
const platformPrimaryColor = envSchema.platformPrimaryColor.parse(process.env.PLATFORM_PRIMARY_COLOR ?? "#4f46e5").trim();
const platformDefaultCurrency = envSchema.platformDefaultCurrency.parse(process.env.PLATFORM_DEFAULT_CURRENCY ?? "INR").trim();
const platformDefaultTaxRate = envSchema.platformDefaultTaxRate.parse(process.env.PLATFORM_DEFAULT_TAX_RATE ?? "0.18");
const platformTakeRate = envSchema.platformTakeRate.parse(process.env.PLATFORM_TAKE_RATE ?? "0.2");

const isPlaceholderValue = (value: string | undefined): boolean => {
  const normalized = (value ?? "").trim();
  if (!normalized) return true;
  return /^(change-me|replace-with|placeholder|example|demo|your-.*|dummy|test(?:ing)?|<.*>)$/i.test(normalized);
};

function validateDatabaseUrl(value: string): string | undefined {
  if (!value) {
    return nodeEnv === "production"
      ? "DATABASE_URL is required in production. Configure a PostgreSQL connection URL before starting the API."
      : "DATABASE_URL is not set. Development mode will start in degraded mode and /api/health will return 503 until a PostgreSQL URL is configured.";
  }

  if (isPlaceholderValue(value)) {
    return nodeEnv === "production"
      ? "DATABASE_URL contains a placeholder value. Set a real PostgreSQL connection string before starting the API in production."
      : "DATABASE_URL still contains a placeholder value. Update it to a real PostgreSQL URL to enable database-backed local development.";
  }

  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.pathname.length < 2) {
      return "DATABASE_URL must be a PostgreSQL URL with a host and database name.";
    }
  } catch {
    return "DATABASE_URL is not a valid PostgreSQL URL. Check its format and URL-encode special characters in credentials.";
  }

  return undefined;
}

function validateJwtSecret(value: string): string | undefined {
  if (!value) {
    return nodeEnv === "production"
      ? "JWT_SECRET is required in production. Set a random secret of at least 32 characters."
      : "JWT_SECRET is not set. Auth flows will be less secure until a value is configured.";
  }

  if (isPlaceholderValue(value) || value.length < 32) {
    return nodeEnv === "production"
      ? "JWT_SECRET must be at least 32 characters and must not contain placeholder values in production."
      : "JWT_SECRET is shorter than 32 characters or still contains a placeholder value. Update it before production deployment.";
  }

  return undefined;
}

const storageConfigurationError = (() => {
  if (!['local', 's3'].includes(storageDriver)) {
    return "STORAGE_DRIVER must be either 'local' or 's3'.";
  }

  if (nodeEnv === "production" && storageDriver !== "s3") {
    return "STORAGE_DRIVER=local is not allowed in production. Configure durable S3-compatible storage.";
  }

  if (storageDriver === "s3") {
    const missing = [
      !s3BucketName && "S3_BUCKET_NAME",
      !s3Region && "S3_REGION",
      !s3AccessKeyId && "S3_ACCESS_KEY_ID",
      !s3SecretAccessKey && "S3_SECRET_ACCESS_KEY",
      !!s3Endpoint && !storagePublicBaseUrl && "STORAGE_PUBLIC_BASE_URL (required when S3_ENDPOINT is set)",
    ].filter(Boolean);

    const placeholderFields = [
      ["S3_BUCKET_NAME", s3BucketName],
      ["S3_REGION", s3Region],
      ["S3_ACCESS_KEY_ID", s3AccessKeyId],
      ["S3_SECRET_ACCESS_KEY", s3SecretAccessKey],
      ["STORAGE_PUBLIC_BASE_URL", storagePublicBaseUrl],
    ].filter(([, value]) => isPlaceholderValue(value as string));

    if (missing.length > 0 || placeholderFields.length > 0) {
      const details = [...missing, ...placeholderFields.map(([key]) => `${key} is a placeholder value`)]
        .filter(Boolean)
        .join(", ");

      return nodeEnv === "production"
        ? `S3 storage configuration is incomplete or contains placeholder values: ${details}.`
        : `S3 storage configuration is incomplete in development mode: ${details}. Dev mode will continue without S3-backed uploads until you configure these values.`;
    }
  }

  if (storagePublicBaseUrl) {
    try {
      const url = new URL(storagePublicBaseUrl);
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname) {
        return "STORAGE_PUBLIC_BASE_URL must be an absolute HTTP or HTTPS URL.";
      }
    } catch {
      return "STORAGE_PUBLIC_BASE_URL must be an absolute HTTP or HTTPS URL.";
    }
  }

  return undefined;
})();

const databaseConfigurationError = validateDatabaseUrl(databaseUrl);
const jwtSecretError = validateJwtSecret(jwtSecret);

if (nodeEnv === "development") {
  if (databaseConfigurationError) {
    console.warn(`[configuration] DEVELOPMENT MODE: ${databaseConfigurationError}`);
  }

  if (storageConfigurationError) {
    console.warn(`[configuration] DEVELOPMENT MODE: ${storageConfigurationError}`);
  }

  if (jwtSecretError) {
    console.warn(`[configuration] DEVELOPMENT MODE: ${jwtSecretError}`);
  }
} else {
  if (databaseConfigurationError) {
    console.error(`[configuration] ${databaseConfigurationError}`);
    process.exit(1);
  }

  if (jwtSecretError) {
    console.error(`[configuration] ${jwtSecretError}`);
    process.exit(1);
  }

  if (storageConfigurationError) {
    console.error(`[configuration] ${storageConfigurationError}`);
    process.exit(1);
  }
}

export const env = {
  nodeEnv,
  port,
  databaseUrl,
  databaseConfigurationError,
  jwtSecret,
  jwtExpiresIn,
  corsOrigin,
  publicApiUrl,
  publicWebUrl,
  storageDriver,
  storageConfigurationError,
  storageLocalRoot,
  s3BucketName,
  s3Region,
  s3AccessKeyId,
  s3SecretAccessKey,
  s3Endpoint: s3Endpoint || undefined,
  storagePublicBaseUrl: storagePublicBaseUrl || undefined,
  platformName,
  platformTagline,
  platformPrimaryColor,
  platformDefaultCurrency,
  platformDefaultTaxRate,
  platformTakeRate,
};

export type Env = typeof env;
