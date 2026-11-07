import "express-async-errors";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { env } from "./env";
import { apiRouter } from "./routes/index";
import { errorHandler } from "./middleware/error";

const app = express();

app.use(express.json({ limit: "2mb" }));

// Serve uploaded files (instrument/service/institution images).
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

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

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[RIX] ${env.platformName} API listening on http://localhost:${env.port}/api`);
});
