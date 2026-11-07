import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { AppError, paginate, pageResult } from "../http";
import { requireAuth, requireRole, currentUser } from "../middleware/auth";
import { ratingsForInstitutions, ratingForInstitution } from "../lib/matching";
import { shapeAccreditation } from "../lib/accreditation";

export const institutionsRouter = Router();

const institutionTypes = [
  "UNIVERSITY",
  "ENGINEERING_COLLEGE",
  "MEDICAL_COLLEGE",
  "NATIONAL_LAB",
  "PRIVATE_RND",
  "INCUBATOR",
  "INDUSTRY",
] as const;

// GET /institutions — public list of published institutions
institutionsRouter.get("/", async (req, res) => {
  const p = paginate(req.query);
  const where: any = { isPublished: true };
  if (p.q) where.name = { contains: p.q, mode: "insensitive" };
  const [data, total] = await Promise.all([
    prisma.institution.findMany({
      where,
      orderBy: { name: "asc" },
      skip: p.skip,
      take: p.take,
      include: {
        accreditationRecords: { orderBy: { body: "asc" } },
        facilities: { select: { id: true, name: true, department: true }, orderBy: { name: "asc" } },
        _count: { select: { services: true } },
      },
    }),
    prisma.institution.count({ where }),
  ]);
  const ratings = await ratingsForInstitutions(data.map((d) => d.id));
  const withRatings = data.map((d) => ({
    ...d,
    rating: ratings.get(d.id) ?? { avg: 0, count: 0 },
    accreditationRecords: d.accreditationRecords.map(shapeAccreditation),
  }));
  res.json(pageResult(withRatings, total, p));
});

// GET /institutions/:slug — public, one institution + facilities + active services
institutionsRouter.get("/:slug", async (req, res) => {
  const inst = await prisma.institution.findUnique({
    where: { slug: req.params.slug },
    include: {
      facilities: { include: { instruments: true } },
      services: { where: { isActive: true }, include: { instrument: true } },
      experts: { where: { isActive: true }, orderBy: { name: "asc" } },
      accreditationRecords: { orderBy: { body: "asc" } },
      events: {
        where: { isPublished: true, startAt: { gte: new Date(Date.now() - 12 * 3600 * 1000) } },
        orderBy: { startAt: "asc" },
        take: 12,
        include: { facility: { select: { id: true, name: true } }, _count: { select: { registrations: true } } },
      },
    },
  });
  if (!inst) throw new AppError(404, "Institution not found");

  const events = inst.events.map((ev) => {
    const registeredCount = ev._count.registrations;
    const { _count, ...rest } = ev;
    return { ...rest, registeredCount, spotsLeft: ev.capacity == null ? null : Math.max(0, ev.capacity - registeredCount) };
  });

  // Aggregate rating + recent reviews across all of this provider's orders.
  const rating = await ratingForInstitution(inst.id);
  const reviewRows = await prisma.review.findMany({
    where: { order: { institutionId: inst.id } },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      order: { select: { code: true, service: { select: { name: true } }, buyer: { select: { orgName: true } } } },
    },
  });
  const distribution: Record<string, number> = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 };
  for (const r of reviewRows) {
    const key = String(r.rating);
    if (key in distribution) distribution[key] += 1;
  }
  const reviews = {
    avg: rating.avg,
    count: rating.count,
    distribution,
    items: reviewRows.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      author: r.order.buyer.orgName || "Verified buyer",
      service: r.order.service.name,
      date: r.createdAt.toISOString(),
      orderCode: r.order.code,
    })),
  };

  res.json({
    ...inst,
    events,
    accreditationRecords: inst.accreditationRecords.map(shapeAccreditation),
    rating,
    reviews,
  });
});

// --- Accreditation records (scope-verified) — managed by the lab's admin or platform ---
const accreditationSchema = z.object({
  body: z.string().min(1),
  certNumber: z.string().optional().nullable(),
  scope: z.array(z.string()).optional(),
  issuedAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  verifyUrl: z.string().url().optional().nullable(),
});

async function assertInstitutionAccess(institutionId: string, u: ReturnType<typeof currentUser>) {
  const inst = await prisma.institution.findUnique({ where: { id: institutionId } });
  if (!inst) throw new AppError(404, "Institution not found");
  if (u.role !== "SUPER_ADMIN" && inst.id !== u.institutionId) throw new AppError(403, "Cannot modify another institution");
  return inst;
}

// GET /institutions/:id/accreditations — a lab's own records (admin management)
institutionsRouter.get("/:id/accreditations", requireAuth, requireRole("INSTITUTION_ADMIN"), async (req, res) => {
  const u = currentUser(req);
  await assertInstitutionAccess(req.params.id, u);
  const rows = await prisma.accreditation.findMany({ where: { institutionId: req.params.id }, orderBy: { body: "asc" } });
  res.json(rows.map(shapeAccreditation));
});

// POST /institutions/:id/accreditations
institutionsRouter.post("/:id/accreditations", requireAuth, requireRole("INSTITUTION_ADMIN"), async (req, res) => {
  const u = currentUser(req);
  await assertInstitutionAccess(req.params.id, u);
  const b = accreditationSchema.parse(req.body);
  const rec = await prisma.accreditation.create({
    data: {
      institutionId: req.params.id,
      body: b.body,
      certNumber: b.certNumber ?? null,
      scope: b.scope ?? [],
      issuedAt: b.issuedAt ? new Date(b.issuedAt) : null,
      expiresAt: b.expiresAt ? new Date(b.expiresAt) : null,
      verifyUrl: b.verifyUrl ?? null,
    },
  });
  res.status(201).json(shapeAccreditation(rec));
});

// PATCH /institutions/accreditations/:accId
institutionsRouter.patch("/accreditations/:accId", requireAuth, requireRole("INSTITUTION_ADMIN"), async (req, res) => {
  const u = currentUser(req);
  const existing = await prisma.accreditation.findUnique({ where: { id: req.params.accId } });
  if (!existing) throw new AppError(404, "Accreditation not found");
  await assertInstitutionAccess(existing.institutionId, u);
  const b = accreditationSchema.partial().parse(req.body);
  const data: Record<string, unknown> = {};
  if (b.body !== undefined) data.body = b.body;
  if (b.certNumber !== undefined) data.certNumber = b.certNumber;
  if (b.scope !== undefined) data.scope = b.scope;
  if (b.issuedAt !== undefined) data.issuedAt = b.issuedAt ? new Date(b.issuedAt) : null;
  if (b.expiresAt !== undefined) data.expiresAt = b.expiresAt ? new Date(b.expiresAt) : null;
  if (b.verifyUrl !== undefined) data.verifyUrl = b.verifyUrl;
  const rec = await prisma.accreditation.update({ where: { id: existing.id }, data });
  res.json(shapeAccreditation(rec));
});

// DELETE /institutions/accreditations/:accId
institutionsRouter.delete("/accreditations/:accId", requireAuth, requireRole("INSTITUTION_ADMIN"), async (req, res) => {
  const u = currentUser(req);
  const existing = await prisma.accreditation.findUnique({ where: { id: req.params.accId } });
  if (!existing) throw new AppError(404, "Accreditation not found");
  await assertInstitutionAccess(existing.institutionId, u);
  await prisma.accreditation.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  type: z.enum(institutionTypes).optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  about: z.string().optional(),
  logoUrl: z.string().optional(),
  themeColor: z.string().optional(),
  currency: z.string().optional(),
  taxRate: z.number().optional(),
  accreditations: z.array(z.string()).optional(),
  isPublished: z.boolean().optional(),
  onExchange: z.boolean().optional(),
});

// POST /institutions — SUPER_ADMIN
institutionsRouter.post("/", requireAuth, requireRole(), async (req, res) => {
  const u = currentUser(req);
  if (u.role !== "SUPER_ADMIN") throw new AppError(403, "Only platform admins can create tenants");
  const body = createSchema.parse(req.body);
  const inst = await prisma.institution.create({ data: body });
  await prisma.auditLog.create({
    data: { userId: u.id, action: "create", entity: "Institution", entityId: inst.id },
  });
  res.status(201).json(inst);
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(institutionTypes).optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  about: z.string().optional(),
  logoUrl: z.string().optional(),
  themeColor: z.string().optional(),
  currency: z.string().optional(),
  taxRate: z.number().optional(),
  accreditations: z.array(z.string()).optional(),
  isPublished: z.boolean().optional(),
  onExchange: z.boolean().optional(),
  // Per-provider platform-fee override (null clears → use the global setting).
  feeMode: z.enum(["MARKUP_PERCENT", "FIXED_FEE", "SETTLEMENT_DEDUCTION"]).nullable().optional(),
  feeValue: z.number().nonnegative().nullable().optional(),
});

// PATCH /institutions/:id — SUPER_ADMIN or INSTITUTION_ADMIN (own)
institutionsRouter.patch(
  "/:id",
  requireAuth,
  requireRole("INSTITUTION_ADMIN"),
  async (req, res) => {
    const u = currentUser(req);
    const inst = await prisma.institution.findUnique({ where: { id: req.params.id } });
    if (!inst) throw new AppError(404, "Institution not found");
    if (u.role !== "SUPER_ADMIN" && inst.id !== u.institutionId) {
      throw new AppError(403, "Cannot modify another institution");
    }
    const body = updateSchema.parse(req.body);
    const updated = await prisma.institution.update({ where: { id: inst.id }, data: body });
    await prisma.auditLog.create({
      data: { userId: u.id, action: "update", entity: "Institution", entityId: inst.id, meta: body },
    });
    res.json(updated);
  }
);
