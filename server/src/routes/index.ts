import { Router } from "express";
import { databaseFailureReason, probeDatabase } from "../db";
import { env } from "../env";
import { authRouter } from "./auth";
import { configRouter } from "./config";
import { institutionsRouter } from "./institutions";
import { facilitiesRouter } from "./facilities";
import { instrumentsRouter } from "./instruments";
import { servicesRouter } from "./services";
import { expertsRouter } from "./experts";
import { exchangeRouter } from "./exchange";
import { ordersRouter } from "./orders";
import { invoicesRouter } from "./invoices";
import { bookingsRouter } from "./bookings";
import { usersRouter } from "./users";
import { analyticsRouter } from "./analytics";
import { operatorRouter } from "./operator";
import { settlementsRouter } from "./settlements";
import { uploadsRouter } from "./uploads";
import { platformRouter } from "./platform";
import { cartRouter } from "./cart";
import { industriesRouter } from "./industries";
import { providerCatalogRouter } from "./providerCatalog";
import { searchRouter } from "./search";
import { paymentsRouter } from "./payments";
import { discountsRouter } from "./discounts";
import { bundlesRouter } from "./bundles";
import { eventsRouter } from "./events";

export const apiRouter = Router();

apiRouter.get("/health", async (_req, res) => {
  const result = await probeDatabase();
  if (result.connected) {
    res.json({ status: "ok", database: "connected" });
    return;
  }

  const reason = env.databaseConfigurationError ?? databaseFailureReason(result.code);
  console.error(`[health] Database connectivity check failed (${result.code ?? "unknown"}): ${reason}`);
  res.status(503).json({ status: "error", database: "disconnected", reason });
});

apiRouter.use("/", uploadsRouter);
apiRouter.use("/", cartRouter);
apiRouter.use("/", industriesRouter);
apiRouter.use("/", providerCatalogRouter);
apiRouter.use("/", searchRouter);
apiRouter.use("/", paymentsRouter);
apiRouter.use("/", discountsRouter);
apiRouter.use("/", bundlesRouter);

apiRouter.use("/auth", authRouter);
apiRouter.use("/config", configRouter);
apiRouter.use("/institutions", institutionsRouter);
apiRouter.use("/facilities", facilitiesRouter);
apiRouter.use("/instruments", instrumentsRouter);
apiRouter.use("/services", servicesRouter);
apiRouter.use("/experts", expertsRouter);
apiRouter.use("/exchange", exchangeRouter);
apiRouter.use("/orders", ordersRouter);
apiRouter.use("/invoices", invoicesRouter);
apiRouter.use("/bookings", bookingsRouter);
apiRouter.use("/events", eventsRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/analytics", analyticsRouter);
apiRouter.use("/operator", operatorRouter);
apiRouter.use("/settlements", settlementsRouter);
apiRouter.use("/platform", platformRouter);
