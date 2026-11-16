import "express-async-errors";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "node:path";
import { env } from "./env";
import { databaseFailureReason, probeDatabase } from "./db";
import { apiRouter } from "./routes/index";
import { errorHandler } from "./middleware/error";
import { publicObjectUrl } from "./lib/storage";

const app = express();

app.disable("x-powered-by");

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "interest-cohort=()");
  if (env.nodeEnv === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use(express.json({ limit: "2mb" }));

// Only the separate public image directory is exposed; private files are never static.
if (env.storageDriver === "local") {
  app.use(
    "/uploads",
    express.static(path.join(env.storageLocalRoot, "public-uploads"), {
      index: false,
      setHeaders: (res) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
      },
    }),
  );
} else {
  app.use("/uploads", (req, res, next) => {
    let key: string;
    try {
      key = decodeURIComponent(req.path.replace(/^\/+/, ""));
    } catch (error) {
      next(error);
      return;
    }
    if (!key || key.split("/").includes("pending")) {
      res.status(404).end();
      return;
    }
    try {
      res.redirect(302, publicObjectUrl(key));
    } catch (error) {
      next(error);
    }
  });
}

const allowedOrigins = env.corsOrigin.split(",").map((s) => s.trim());
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow non-browser clients (curl, server-to-server) with no Origin header.
      if (!origin) return cb(null, true);
      if (env.corsOrigin === "*") return cb(null, true);
      // Dev convenience: allow any localhost / 127.0.0.1 port (Vite may fall back to 5174+).
      if (env.nodeEnv === "development" && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
        return cb(null, true);
      }
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));

app.use("/api", apiRouter);

app.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.use(errorHandler);

async function startServer() {
  if (env.databaseConfigurationError) {
    console.error(`[database] ${env.databaseConfigurationError}`);
    if (env.nodeEnv === "production") {
      console.error("[database] Production startup is blocked because DATABASE_URL is invalid or missing.");
      return;
    }
    console.warn("[database] Development mode fallback: starting in degraded mode; /api/health will return 503 until the database is configured.");
  } else {
    const result = await probeDatabase();
    if (result.connected) {
      console.log("[database] PostgreSQL connectivity check passed.");
    } else {
      const reason = databaseFailureReason(result.code);
      console.error(`[database] Startup connectivity check failed (${result.code ?? "unknown"}): ${reason}`);
      if (env.nodeEnv === "production") {
        console.error("[database] Production startup is blocked until PostgreSQL is reachable.");
        return;
      }
      console.warn("[database] Development mode fallback: starting in degraded mode; /api/health will return 503 until the database is available.");
    }
  }

  app.listen(env.port, () => {
    console.log(`[RIX] ${env.platformName} API listening on http://localhost:${env.port}/api`);
  });
}

void startServer();
