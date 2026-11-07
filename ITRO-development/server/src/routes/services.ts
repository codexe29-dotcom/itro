import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { AppError, paginate, pageResult, strParam, numParam } from "../http";
import { requireAuth, requireRole, currentUser } from "../middleware/auth";
import { scopedInstitutionId, requireInstitutionId } from "../lib/tenant";
import { distanceKmOrNull, ratingsForServices, ratingForService } from "../lib/matching";
import { attachBuyerPrices, resolveFee, computeBreakdown } from "../lib/pricing";
import { instrumentAvailability, estimateSchedule } from "../lib/scheduling";

export const servicesRouter = Router();

const WORK_START = 9; // 09:00 — retained for legacy utilization capacity math
const WORK_END = 17; // 17:00

/** Unique union of accreditation strings (falsy filtered). */
function certifications(service: { accreditation: string | null }, institution: { accreditations: string[] }): string[] {
  const set = new Set<string>();
  if (service.accreditation) set.add(service.accreditation);
  for (const a of institution.accreditations) if (a) set.add(a);
  return [...set];
}

/**
 * Compute trailing-30d utilization for an instrument from APPROVED+PENDING bookings.
 * Returns a 0..1 fraction of booked hours over working-hour capacity.
 */
async function utilizationPct(instrumentId: string): Promise<number> {
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const bookings = await prisma.booking.findMany({
    where: {
      instrumentId,
      status: { in: ["APPROVED", "PENDING"] },
      startAt: { lt: now },
      endAt: { gt: from },
    },
    select: { startAt: true, endAt: true },
  });
  let bookedHours = 0;
  for (const b of bookings) {
    const s = b.startAt < from ? from : b.startAt;
    const e = b.endAt > now ? now : b.endAt;
    const h = (e.getTime() - s.getTime()) / (60 * 60 * 1000);
    if (h > 0) bookedHours += h;
  }
  // Working-hour capacity over 30 days: 8h/day, ~6 working days/week (skip Sundays).
  const hoursPerDay = WORK_END - WORK_START; // 8
  const workingDays = Math.round(30 * (6 / 7));
  const capacity = hoursPerDay * workingDays;
  const pct = capacity > 0 ? bookedHours / capacity : 0;
  return Math.round(Math.min(pct, 1) * 100) / 100;
}

function healthLabel(
  status: string,
  nextCalibrationAt: Date | null,
  calibrationDueSoon: boolean,
  uptimePct: number | null
): "Excellent" | "Good" | "Due for calibration" | "Under maintenance" {
  if (status === "MAINTENANCE" || status === "OFFLINE") return "Under maintenance";
  if (calibrationDueSoon) return "Due for calibration";
  if (uptimePct !== null && uptimePct >= 0.95) return "Excellent";
  return "Good";
}

// GET /services — own institution services (admin roles)
servicesRouter.get(
  "/",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "LAB_MANAGER", "OPERATOR"),
  async (req, res) => {
    const u = currentUser(req);
    const p = paginate(req.query);
    const instId = scopedInstitutionId(u, strParam(req.query, "institutionId"));
    const where: any = {};
    if (instId) where.institutionId = instId;
    const category = strParam(req.query, "category");
    if (category) where.category = category;
    if (p.q) where.name = { contains: p.q, mode: "insensitive" };

    const [rows, total] = await Promise.all([
      prisma.service.findMany({
        where,
        orderBy: { name: "asc" },
        skip: p.skip,
        take: p.take,
        include: { instrument: true, institution: true },
      }),
      prisma.service.count({ where }),
    ]);
    const data = await attachBuyerPrices(rows);
    res.json(pageResult(data, total, p));
  }
);

// GET /services/:id/availability?days=10 — engine-driven capacity grid. Public.
servicesRouter.get("/:id/availability", async (req, res) => {
  const service = await prisma.service.findUnique({
    where: { id: req.params.id },
    include: { instrument: true },
  });
  if (!service) throw new AppError(404, "Service not found");

  const days = Math.min(Math.max(numParam(req.query, "days") ?? 10, 1), 60);
  const instrument = service.instrument;
  if (!instrument) {
    res.json({ instrumentId: null, capacityType: null, nextAvailable: null, days: [] });
    return;
  }

  const result = await instrumentAvailability(instrument, days);
  res.json(result);
});

// GET /services/:id/similar?lat=&lng= — same category across the exchange
servicesRouter.get("/:id/similar", async (req, res) => {
  const service = await prisma.service.findUnique({ where: { id: req.params.id } });
  if (!service) throw new AppError(404, "Service not found");

  const lat = numParam(req.query, "lat");
  const lng = numParam(req.query, "lng");

  const services = await prisma.service.findMany({
    where: {
      category: service.category,
      isActive: true,
      institution: { isPublished: true, onExchange: true },
    },
    include: {
      institution: {
        select: { id: true, name: true, slug: true, city: true, state: true, latitude: true, longitude: true },
      },
    },
  });

  const ratings = await ratingsForServices(services.map((s) => s.id));

  const rows = services.map((s) => {
    const distanceKm = distanceKmOrNull(lat, lng, s.institution.latitude, s.institution.longitude);
    return {
      id: s.id,
      name: s.name,
      category: s.category,
      priceIndustry: s.priceIndustry,
      priceAcademic: s.priceAcademic,
      turnaroundDays: s.turnaroundDays,
      accreditation: s.accreditation,
      rating: ratings.get(s.id) ?? { avg: 0, count: 0 },
      institution: s.institution,
      distanceKm,
      isCurrent: s.id === service.id,
    };
  });

  // This panel compares FACILITIES, so show at most one row per institution.
  // Keep the current service for its own institution; for others pick the cheapest.
  const byInst = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const cur = byInst.get(r.institution.id);
    if (!cur) { byInst.set(r.institution.id, r); continue; }
    if (r.isCurrent) byInst.set(r.institution.id, r);
    else if (!cur.isCurrent && r.priceIndustry < cur.priceIndustry) byInst.set(r.institution.id, r);
  }
  const deduped = [...byInst.values()];

  deduped.sort((a, b) => {
    if (a.distanceKm === null && b.distanceKm === null) return a.priceIndustry - b.priceIndustry;
    if (a.distanceKm === null) return 1;
    if (b.distanceKm === null) return -1;
    if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    return a.priceIndustry - b.priceIndustry;
  });

  res.json(deduped.slice(0, 8));
});

// GET /services/:id/recommended — up to 4 other active services at same institution
servicesRouter.get("/:id/recommended", async (req, res) => {
  const service = await prisma.service.findUnique({ where: { id: req.params.id } });
  if (!service) throw new AppError(404, "Service not found");

  const others = await prisma.service.findMany({
    where: { institutionId: service.institutionId, isActive: true, id: { not: service.id } },
    orderBy: { name: "asc" },
    take: 4,
    select: {
      id: true,
      name: true,
      category: true,
      priceIndustry: true,
      turnaroundDays: true,
      accreditation: true,
    },
  });
  res.json(others);
});

// GET /services/:id/reviews — reviews via orders → review for this service
servicesRouter.get("/:id/reviews", async (req, res) => {
  const service = await prisma.service.findUnique({ where: { id: req.params.id } });
  if (!service) throw new AppError(404, "Service not found");

  const reviews = await prisma.review.findMany({
    where: { order: { serviceId: service.id } },
    orderBy: { createdAt: "desc" },
    include: {
      order: { select: { code: true, buyer: { select: { orgName: true } } } },
    },
  });

  const distribution: Record<string, number> = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 };
  let sum = 0;
  for (const r of reviews) {
    sum += r.rating;
    const key = String(r.rating);
    if (key in distribution) distribution[key] += 1;
  }
  const count = reviews.length;
  const avg = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;

  const items = reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    author: r.order.buyer.orgName || "Verified buyer",
    date: r.createdAt.toISOString(),
    orderCode: r.order.code,
  }));

  res.json({ avg, count, distribution, items });
});

// GET /services/:id/insights — lab-facing: fulfilled catalog tests + demand
servicesRouter.get("/:id/insights", requireAuth, requireRole("INSTITUTION_ADMIN", "LAB_MANAGER"), async (req, res) => {
  const u = currentUser(req);
  const svc = await prisma.service.findUnique({ where: { id: req.params.id }, select: { institutionId: true } });
  if (!svc) throw new AppError(404, "Service not found");
  if (u.role !== "SUPER_ADMIN" && svc.institutionId !== u.institutionId) throw new AppError(403, "Not your service");

  const [links, byStatus, recent] = await Promise.all([
    prisma.testProvider.findMany({
      where: { serviceId: req.params.id },
      include: { test: { select: { id: true, slug: true, name: true, category: true, samplesRequired: true, sampleRequirements: true, sampleDestructive: true, sampleReturned: true, deliverables: true, forms: { select: { name: true, required: true } } } } },
    }),
    prisma.serviceOrder.groupBy({ by: ["status"], where: { serviceId: req.params.id }, _count: { _all: true } }),
    prisma.serviceOrder.findMany({ where: { serviceId: req.params.id }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, code: true, status: true, buyerAmount: true, quotedPrice: true, createdAt: true, buyer: { select: { id: true, name: true, orgName: true } } } }),
  ]);
  let total = 0, completed = 0, active = 0;
  const idle = ["DRAFT", "CANCELLED", "QUOTE_REJECTED"];
  for (const g of byStatus) { total += g._count._all; if (g.status === "COMPLETED") completed += g._count._all; else if (!idle.includes(g.status)) active += g._count._all; }

  res.json({
    fulfilledTests: links.map((l) => l.test),
    orders: { total, active, completed },
    recentOrders: recent.map((o) => ({ id: o.id, code: o.code, status: o.status, amount: o.buyerAmount ?? o.quotedPrice, createdAt: o.createdAt, buyer: o.buyer })),
  });
});

// GET /services/:id — public, enriched service detail
servicesRouter.get("/:id", async (req, res) => {
  const service = await prisma.service.findUnique({
    where: { id: req.params.id },
    include: {
      institution: true,
      instrument: { include: { facility: true } },
    },
  });
  if (!service) throw new AppError(404, "Service not found");

  const rating = await ratingForService(service.id);
  const certs = certifications(service, service.institution);
  const fee = await resolveFee(service.institution);
  const discFactor = 1 - (service.discountPct ?? 0) / 100;
  const buyerPrice = computeBreakdown(Math.round(service.priceIndustry * discFactor), fee).buyerAmount;
  const listPrice = (service.discountPct ?? 0) > 0 ? computeBreakdown(service.priceIndustry, fee).buyerAmount : null;
  const schedule = await estimateSchedule(service);

  const inst = service.institution;
  const institution = {
    id: inst.id,
    name: inst.name,
    slug: inst.slug,
    city: inst.city,
    state: inst.state,
    country: inst.country,
    accreditations: inst.accreditations,
    themeColor: inst.themeColor,
    currency: inst.currency,
    latitude: inst.latitude,
    longitude: inst.longitude,
  };

  let instrumentOut: any = null;
  let condition: any = null;

  if (service.instrument) {
    const i = service.instrument;
    const util = await utilizationPct(i.id);
    const calibrationDueSoon =
      i.nextCalibrationAt !== null &&
      i.nextCalibrationAt.getTime() - Date.now() <= 30 * 24 * 60 * 60 * 1000;

    instrumentOut = {
      id: i.id,
      name: i.name,
      category: i.category,
      make: i.make,
      model: i.model,
      specs: i.specs ?? {},
      images: i.images,
      applications: i.applications,
      status: i.status,
      hourlyRate: i.hourlyRate,
      description: i.description,
      lastCalibratedAt: i.lastCalibratedAt,
      nextCalibrationAt: i.nextCalibrationAt,
      uptimePct: i.uptimePct,
      facility: {
        name: i.facility.name,
        department: i.facility.department,
        location: i.facility.location,
      },
    };

    condition = {
      status: i.status,
      healthLabel: healthLabel(i.status, i.nextCalibrationAt, calibrationDueSoon, i.uptimePct),
      lastCalibratedAt: i.lastCalibratedAt,
      nextCalibrationAt: i.nextCalibrationAt,
      calibrationDueSoon,
      utilizationPct: util,
      uptimePct: i.uptimePct ?? 0,
    };
  }

  res.json({
    id: service.id,
    institutionId: service.institutionId,
    instrumentId: service.instrumentId,
    name: service.name,
    category: service.category,
    description: service.description,
    images: service.images,
    deliverable: service.deliverable,
    // Provider-editable buyer requirements (null/empty = inherit catalog).
    samplesRequired: service.samplesRequired,
    sampleRequirements: service.sampleRequirements,
    sampleDestructive: service.sampleDestructive,
    sampleReturned: service.sampleReturned,
    deliverables: service.deliverables,
    intakeForms: service.intakeForms ?? [],
    turnaroundDays: service.turnaroundDays,
    rushDays: service.rushDays,
    rushSurchargePct: service.rushSurchargePct,
    priceInternal: service.priceInternal,
    priceAcademic: service.priceAcademic,
    priceIndustry: service.priceIndustry,
    pricingMethod: service.pricingMethod,
    unitLabel: service.unitLabel,
    setupFee: service.setupFee,
    minCharge: service.minCharge,
    accreditation: service.accreditation,
    pricingMode: service.pricingMode,
    discountPct: service.discountPct,
    discountLabel: service.discountLabel,
    buyerPrice,
    listPrice,
    expeditedPrice: service.rushSurchargePct != null && buyerPrice != null
      ? Math.round(buyerPrice * (1 + service.rushSurchargePct / 100))
      : null,
    isActive: service.isActive,
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
    institution,
    instrument: instrumentOut,
    condition,
    schedule,
    rating,
    certifications: certs,
  });
});

const createSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional(),
  images: z.array(z.string()).optional(),
  deliverable: z.string().optional(),
  turnaroundDays: z.number().int().positive().optional(),
  rushDays: z.number().int().positive().nullable().optional(),
  rushSurchargePct: z.number().min(0).max(500).nullable().optional(),
  priceInternal: z.number().nonnegative(),
  priceAcademic: z.number().nonnegative(),
  priceIndustry: z.number().nonnegative(),
  pricingMethod: z.enum(["FLAT", "PER_HOUR", "PER_SAMPLE", "PER_TEST", "PER_DAY", "PER_UNIT", "TIERED"]).optional(),
  unitLabel: z.string().optional(),
  setupFee: z.number().nonnegative().optional(),
  minCharge: z.number().nonnegative().optional(),
  discountPct: z.number().min(0).max(100).optional(),
  discountLabel: z.string().nullable().optional(),
  accreditation: z.string().optional(),
  pricingMode: z.enum(["QUOTE", "FIXED"]).optional(),
  instrumentId: z.string().optional(),
  facilityId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  // Provider-editable buyer requirements (override the linked catalog test).
  samplesRequired: z.number().int().min(0).nullable().optional(),
  sampleRequirements: z.string().nullable().optional(),
  sampleDestructive: z.boolean().nullable().optional(),
  sampleReturned: z.boolean().nullable().optional(),
  deliverables: z.array(z.string()).optional(),
  intakeForms: z.array(z.object({
    name: z.string().min(1),
    description: z.string().optional().default(""),
    required: z.boolean().optional().default(false),
    type: z.enum(["TEXT", "TEXTAREA", "NUMBER", "DATE", "SELECT", "CHECKBOX", "FILE"]).optional().default("TEXT"),
    options: z.array(z.string()).optional().default([]),
  })).optional(),
});

/** A service's facility must belong to the same institution. */
async function assertFacilityInInstitution(facilityId: string, institutionId: string, role: string) {
  const facility = await prisma.facility.findUnique({ where: { id: facilityId }, select: { institutionId: true } });
  if (!facility) throw new AppError(404, "Facility not found");
  if (role !== "SUPER_ADMIN" && facility.institutionId !== institutionId) {
    throw new AppError(403, "Facility belongs to another institution");
  }
}

// POST /services
servicesRouter.post(
  "/",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "LAB_MANAGER"),
  async (req, res) => {
    const u = currentUser(req);
    const body = createSchema.parse(req.body);
    const institutionId = requireInstitutionId(u);

    // Resolve which facility runs this service: explicit facilityId, else inherit
    // the linked instrument's facility. A facility is a first-class lab.
    let facilityId: string | null = body.facilityId ?? null;
    if (body.instrumentId) {
      const inst = await prisma.instrument.findUnique({
        where: { id: body.instrumentId },
        include: { facility: true },
      });
      if (!inst) throw new AppError(404, "Instrument not found");
      if (u.role !== "SUPER_ADMIN" && inst.facility.institutionId !== institutionId) {
        throw new AppError(403, "Instrument belongs to another institution");
      }
      if (!facilityId) facilityId = inst.facilityId;
    }
    if (facilityId) await assertFacilityInInstitution(facilityId, institutionId, u.role);

    const service = await prisma.service.create({ data: { ...body, facilityId, intakeForms: (body.intakeForms ?? []) as any, institutionId } });
    await prisma.auditLog.create({
      data: { userId: u.id, action: "create", entity: "Service", entityId: service.id },
    });
    res.status(201).json(service);
  }
);

const updateSchema = createSchema.partial();

// PATCH /services/:id
servicesRouter.patch(
  "/:id",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "LAB_MANAGER"),
  async (req, res) => {
    const u = currentUser(req);
    const service = await prisma.service.findUnique({ where: { id: req.params.id } });
    if (!service) throw new AppError(404, "Service not found");
    if (u.role !== "SUPER_ADMIN" && service.institutionId !== u.institutionId) {
      throw new AppError(403, "Cannot modify another institution's service");
    }
    const body = updateSchema.parse(req.body);
    const data: Record<string, unknown> = { ...body, ...(body.intakeForms !== undefined ? { intakeForms: body.intakeForms as any } : {}) };
    // Re-derive the facility when the instrument changes (unless explicitly set).
    if (body.instrumentId && body.facilityId === undefined) {
      const inst = await prisma.instrument.findUnique({ where: { id: body.instrumentId }, select: { facilityId: true } });
      if (inst) data.facilityId = inst.facilityId;
    }
    if (body.facilityId) await assertFacilityInInstitution(body.facilityId, service.institutionId, u.role);
    const updated = await prisma.service.update({ where: { id: service.id }, data });
    await prisma.auditLog.create({
      data: { userId: u.id, action: "update", entity: "Service", entityId: service.id, meta: body },
    });
    res.json(updated);
  }
);

// DELETE /services/:id — INSTITUTION_ADMIN
servicesRouter.delete(
  "/:id",
  requireAuth,
  requireRole("INSTITUTION_ADMIN"),
  async (req, res) => {
    const u = currentUser(req);
    const service = await prisma.service.findUnique({ where: { id: req.params.id } });
    if (!service) throw new AppError(404, "Service not found");
    if (u.role !== "SUPER_ADMIN" && service.institutionId !== u.institutionId) {
      throw new AppError(403, "Cannot delete another institution's service");
    }
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.auditLog.create({
      data: { userId: u.id, action: "delete", entity: "Service", entityId: service.id },
    });
    res.status(204).end();
  }
);
