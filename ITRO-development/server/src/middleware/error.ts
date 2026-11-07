import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../http";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ message: err.message, details: err.details });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ message: "Validation failed", details: err.flatten() });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ message: "A record with these unique values already exists", details: err.meta });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ message: "Record not found" });
      return;
    }
    res.status(400).json({ message: "Database request error", details: { code: err.code } });
    return;
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  // eslint-disable-next-line no-console
  console.error("[error]", err);
  res.status(500).json({ message });
}
