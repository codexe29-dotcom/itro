import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { AppError } from "../http";
import { requireAuth, requireRole, currentUser } from "../middleware/auth";
import { creditSummary } from "../lib/discounts";

export const discountsRouter = Router();

const isPlatform = (u: { role: string }) => u.role === "SUPER_ADMIN";
const providerRoles = ["INSTITUTION_ADMIN", "LAB_MANAGER"] as const;
const managerRoles = ["SUPER_ADMIN", "INSTITUTION_ADMIN", "LAB_MANAGER"] as const;

// ============================ COUPONS ============================
const couponSchema = z.object({
  code: z.string().min(2).max(40),
  name: z.string().min(1),
  kind: z.enum(["PERCENT", "FIXED"]),
  value: z.number().positive(),
  funder: z.enum(["PLATFORM", "PROVIDER"]).optional(),
  institutionId: z.string().optional(),
  appliesTo: z.enum(["ALL", "CATEGORY", "SERVICE"]).optional(),
  categories: z.array(z.string()).optional(),
  serviceIds: z.array(z.string()).optional(),
  minOrder: z.number().nonnegative().optional(),
  maxDiscount: z.number().positive().nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  perBuyerLimit: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// GET /coupons — platform admin sees all; a provider sees only its own
discountsRouter.get("/coupons", requireAuth, requireRole(...managerRoles), async (req, res) => {
  const u = currentUser(req);
  const where = isPlatform(u) ? {} : { institutionId: u.institutionId ?? "__none__" };
  const coupons = await prisma.coupon.findMany({
    where, orderBy: { createdAt: "desc" },
    include: { _count: { select: { redemptions: true } }, institution: { select: { name: true } } },
  });
  res.json(coupons);
});

// POST /coupons
discountsRouter.post("/coupons", requireAuth, requireRole(...managerRoles), async (req, res) => {
  const u = currentUser(req);
  const body = couponSchema.parse(req.body);

  // Resolve funder + institution by role.
  let funder: "PLATFORM" | "PROVIDER";
  let institutionId: string | null;
  if (isPlatform(u)) {
    funder = body.funder ?? "PLATFORM";
    institutionId = funder === "PROVIDER" ? (body.institutionId ?? null) : null;
    if (funder === "PROVIDER" && !institutionId) throw new AppError(400, "Provider coupon needs an institution");
  } else {
    funder = "PROVIDER";
    institutionId = u.institutionId ?? null;
    if (!institutionId) throw new AppError(403, "No institution for this user");
  }
  if (body.kind === "PERCENT" && body.value > 100) throw new AppError(400, "Percent discount can't exceed 100");

  try {
    const coupon = await prisma.coupon.create({
      data: {
        code: body.code.trim().toUpperCase(), name: body.name, kind: body.kind, value: body.value,
        funder, institutionId,
        appliesTo: body.appliesTo ?? "ALL", categories: body.categories ?? [], serviceIds: body.serviceIds ?? [],
        minOrder: body.minOrder ?? 0, maxDiscount: body.maxDiscount ?? null,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        usageLimit: body.usageLimit ?? null, perBuyerLimit: body.perBuyerLimit ?? 1,
        isActive: body.isActive ?? true,
      },
    });
    await prisma.auditLog.create({ data: { userId: u.id, action: "create", entity: "Coupon", entityId: coupon.id } });
    res.status(201).json(coupon);
  } catch (e: any) {
    if (e?.code === "P2002") throw new AppError(409, "That code already exists");
    throw e;
  }
});

async function ownCoupon(id: string, u: { role: string; institutionId: string | null }) {
  const c = await prisma.coupon.findUnique({ where: { id } });
  if (!c) throw new AppError(404, "Coupon not found");
  if (!isPlatform(u) && c.institutionId !== u.institutionId) throw new AppError(403, "Not your coupon");
  return c;
}

// PATCH /coupons/:id
discountsRouter.patch("/coupons/:id", requireAuth, requireRole(...managerRoles), async (req, res) => {
  const u = currentUser(req);
  await ownCoupon(req.params.id, u);
  const body = couponSchema.partial().parse(req.body);
  const data: Record<string, unknown> = {};
  for (const k of ["name", "kind", "value", "appliesTo", "categories", "serviceIds", "minOrder", "maxDiscount", "usageLimit", "perBuyerLimit", "isActive"] as const) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  if (body.code !== undefined) data.code = body.code.trim().toUpperCase();
  if (body.startsAt !== undefined) data.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (body.endsAt !== undefined) data.endsAt = body.endsAt ? new Date(body.endsAt) : null;
  const coupon = await prisma.coupon.update({ where: { id: req.params.id }, data });
  res.json(coupon);
});

// DELETE /coupons/:id
discountsRouter.delete("/coupons/:id", requireAuth, requireRole(...managerRoles), async (req, res) => {
  const u = currentUser(req);
  await ownCoupon(req.params.id, u);
  await prisma.coupon.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// ============================ CREDITS ============================
// GET /credits/me — buyer's own wallet balance + recent ledger
discountsRouter.get("/credits/me", requireAuth, requireRole("INDUSTRY_BUYER"), async (req, res) => {
  const u = currentUser(req);
  const summary = await creditSummary(u.id);
  const ledger = await prisma.creditEntry.findMany({
    where: { buyerId: u.id }, orderBy: { createdAt: "desc" }, take: 50,
    include: { institution: { select: { name: true } } },
  });
  res.json({ ...summary, ledger });
});

const issueSchema = z.object({
  buyerEmail: z.string().email(),
  amount: z.number().positive(),
  reason: z.string().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

// POST /credits/issue — platform admin or a provider grants credits to a buyer
discountsRouter.post("/credits/issue", requireAuth, requireRole(...managerRoles), async (req, res) => {
  const u = currentUser(req);
  const body = issueSchema.parse(req.body);
  const buyer = await prisma.user.findUnique({ where: { email: body.buyerEmail.toLowerCase() } });
  if (!buyer || buyer.role !== "INDUSTRY_BUYER") throw new AppError(404, "No buyer found with that email");

  const funder = isPlatform(u) ? "PLATFORM" : "PROVIDER";
  const institutionId = isPlatform(u) ? null : (u.institutionId ?? null);
  if (funder === "PROVIDER" && !institutionId) throw new AppError(403, "No institution for this user");

  const entry = await prisma.creditEntry.create({
    data: {
      buyerId: buyer.id, type: "ISSUE", amount: Math.round(body.amount), funder, institutionId,
      reason: body.reason ?? null, expiresAt: body.expiresAt ? new Date(body.expiresAt) : null, createdById: u.id,
    },
  });
  await prisma.auditLog.create({ data: { userId: u.id, action: "issue-credit", entity: "CreditEntry", entityId: entry.id, meta: { buyerId: buyer.id, amount: body.amount } } });
  const summary = await creditSummary(buyer.id);
  res.status(201).json({ entry, buyerBalance: summary.total });
});

// GET /credits/issued — credits I (platform or provider) have granted
discountsRouter.get("/credits/issued", requireAuth, requireRole(...managerRoles), async (req, res) => {
  const u = currentUser(req);
  const where = isPlatform(u) ? { funder: "PLATFORM" } : { institutionId: u.institutionId ?? "__none__" };
  const entries = await prisma.creditEntry.findMany({
    where, orderBy: { createdAt: "desc" }, take: 100,
    include: { buyer: { select: { name: true, orgName: true, email: true } } },
  });
  res.json(entries);
});
void providerRoles;
