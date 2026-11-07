import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { env } from "../env";
import { prisma } from "../db";

export interface JwtPayload {
  id: string;
  role: Role;
  institutionId: string | null;
  tokenVersion: number;
}

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as any });
}

export function verifyJwt(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Generate a human-friendly order code ORD-YYYY-#### using a per-year count. */
export async function generateOrderCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}-`;
  const count = await prisma.serviceOrder.count({
    where: { code: { startsWith: prefix } },
  });
  const seq = String(count + 1).padStart(4, "0");
  return `${prefix}${seq}`;
}

/** Generate a parent Order (basket) code ITRO-YYYY-#### using a per-year count. */
export async function generateBasketCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ITRO-${year}-`;
  const count = await prisma.order.count({
    where: { code: { startsWith: prefix } },
  });
  const seq = String(count + 1).padStart(4, "0");
  return `${prefix}${seq}`;
}

/** Generate an invoice number INV-YYYY-#### using a per-year count. */
export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const count = await prisma.invoice.count({
    where: { number: { startsWith: prefix } },
  });
  const seq = String(count + 1).padStart(4, "0");
  return `${prefix}${seq}`;
}
