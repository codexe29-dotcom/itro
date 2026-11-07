import { Router } from "express";
import { env } from "../env";

export const configRouter = Router();

// GET /config — public white-label platform config from env
configRouter.get("/", (_req, res) => {
  res.json({
    platformName: env.platformName,
    tagline: env.platformTagline,
    primaryColor: env.platformPrimaryColor,
    defaultCurrency: env.platformDefaultCurrency,
    defaultTaxRate: env.platformDefaultTaxRate,
    takeRate: env.platformTakeRate,
  });
});
