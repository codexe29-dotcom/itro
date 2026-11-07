import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { AppError, paginate, pageResult, strParam } from "../http";
import { requireAuth, requireRole, currentUser } from "../middleware/auth";
import { scopedInstitutionId } from "../lib/tenant";
import { ratingsForServices } from "../lib/matching";
import { instrumentAvailability } from "../lib/scheduling";

export const instrumentsRouter = Router();

const instrumentStatuses = ["AVAILABLE", "BOOKED", "MAINTENANCE", "OFFLINE"] as const;
const capacityTypes = ["TIME_SLOT", "THROUGHPUT"] as const;

const capacityFields = {
  capacityType: z.enum(capacityTypes).optional(),
  concurrency: z.number().int().positive().optional(),
  throughputPerDay: z.number().int().positive().nullable().optional(),
  slotMinutes: z.number().int().min(15).max(1440).optional(),
  setupMinutes: z.number().int().min(0).max(1440).optional(),
  leadTimeDays: z.number().int().min(0).max(365).optional(),
  requiresOperator: z.boolean().optional(),
};

const documentTypes = [
  "WARRANTY", "LICENSE", "CALIBRATION_CERT", "MANUAL", "CERTIFICATE", "DATASHEET", "OTHER",
] as const;

const certificationSchema = z.object({
  body: z.string().optional().default(""),
  number: z.string().optional().default(""),
  scope: z.string().optional().default(""),
  validFrom: z.string().optional().default(""),
  validUntil: z.string().optional().default(""),
  documentUrl: z.string().optional().default(""),
});

const adminRoles = ["INSTITUTION_ADMIN", "LAB_MANAGER", "OPERATOR"] as const;

// GET /instruments/public/:id — PUBLIC 360° instrument profile (no auth).
// Returns the instrument + facility + institution + linked active services.
instrumentsRouter.get("/public/:id", async (req, res) => {
  const inst = await prisma.instrument.findUnique({
    where: { id: req.params.id },
    include: {
      facility: { include: { institution: true } },
      documents: { orderBy: { createdAt: "desc" } },
      services: {
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          category: true,
          deliverable: true,
          turnaroundDays: true,
          priceAcademic: true,
          priceIndustry: true,
          accreditation: true,
          pricingMethod: true,
          unitLabel: true,
          setupFee: true,
          minCharge: true,
          testProviders: { select: { test: { select: { id: true, slug: true, name: true, category: true, accreditation: true } } } },
        },
      },
    },
  });
  if (!inst) throw new AppError(404, "Instrument not found");

  // Distinct catalog tests performable on this instrument (via its services' enrolments).
  const perfMap = new Map<string, { id: string; slug: string; name: string; category: string; accreditation: string | null }>();
  for (const svc of inst.services) for (const tp of (svc as any).testProviders ?? []) if (tp.test) perfMap.set(tp.test.id, tp.test);
  const performableTests = [...perfMap.values()];

  const institution = inst.facility.institution;
  if (!institution.isPublished || !institution.onExchange) {
    throw new AppError(404, "Instrument not found");
  }

  const now = Date.now();
  const calibrationDueSoon =
    inst.nextCalibrationAt !== null &&
    inst.nextCalibrationAt.getTime() - now <= 30 * 24 * 60 * 60 * 1000;

  // Aggregate reviews across this instrument's linked services.
  const serviceIds = inst.services.map((s) => s.id);
  const ratingMap = await ratingsForServices(serviceIds);
  let reviewSum = 0;
  let reviewCount = 0;
  for (const sid of serviceIds) {
    const r = ratingMap.get(sid);
    if (r && r.count > 0) {
      reviewSum += r.avg * r.count;
      reviewCount += r.count;
    }
  }
  const reviewItems = await prisma.review.findMany({
    where: { order: { serviceId: { in: serviceIds.length ? serviceIds : ["__none__"] } } },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: {
      order: { select: { code: true, buyer: { select: { orgName: true } }, service: { select: { name: true } } } },
    },
  });
  const reviews = {
    avg: reviewCount > 0 ? Math.round((reviewSum / reviewCount) * 10) / 10 : 0,
    count: reviewCount,
    items: reviewItems.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      author: r.order.buyer.orgName || "Verified buyer",
      service: r.order.service.name,
      date: r.createdAt.toISOString(),
      orderCode: r.order.code,
    })),
  };

  // Rate cards derived from the linked services.
  const rateCards = inst.services.map((s) => ({
    serviceId: s.id,
    name: s.name,
    pricingMethod: s.pricingMethod,
    unitLabel: s.unitLabel,
    priceIndustry: s.priceIndustry,
    priceAcademic: s.priceAcademic,
    setupFee: s.setupFee,
    minCharge: s.minCharge,
    turnaroundDays: s.turnaroundDays,
    accreditation: s.accreditation,
  }));

  res.json({
    id: inst.id,
    name: inst.name,
    category: inst.category,
    make: inst.make,
    model: inst.model,
    description: inst.description,
    specs: inst.specs ?? {},
    imageUrl: inst.imageUrl,
    images: inst.images,
    applications: inst.applications,
    status: inst.status,
    accreditation: inst.accreditation,
    certifications: (inst.certifications ?? []) as unknown,
    documents: inst.documents,
    industries: inst.industries,
    hourlyRate: inst.hourlyRate,
    trainingRequired: inst.trainingRequired,
    maxSampleSpec: inst.maxSampleSpec ?? null,
    netTestHours: inst.netTestHours,
    lastCalibratedAt: inst.lastCalibratedAt,
    nextCalibrationAt: inst.nextCalibrationAt,
    calibrationDueSoon,
    uptimePct: inst.uptimePct,
    reviews,
    rateCards,
    facility: {
      id: inst.facility.id,
      name: inst.facility.name,
      department: inst.facility.department,
      location: inst.facility.location,
    },
    institution: {
      id: institution.id,
      name: institution.name,
      slug: institution.slug,
      city: institution.city,
      state: institution.state,
      country: institution.country,
      accreditations: institution.accreditations,
    },
    services: inst.services,
    performableTests,
  });
});

// GET /instruments/browse?q=&category=&industry= — PUBLIC catalog of equipment /
// machines available for rent across all published, on-exchange labs.
instrumentsRouter.get("/browse", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const category = typeof req.query.category === "string" ? req.query.category : "";
  const industry = typeof req.query.industry === "string" ? req.query.industry : "";

  const where: any = {
    status: { not: "OFFLINE" },
    facility: { institution: { isPublished: true, onExchange: true } },
  };
  if (category) where.category = category;
  if (industry) where.industries = { has: industry };
  if (q) where.OR = [
    { name: { contains: q, mode: "insensitive" } },
    { make: { contains: q, mode: "insensitive" } },
    { model: { contains: q, mode: "insensitive" } },
    { category: { contains: q, mode: "insensitive" } },
  ];

  const items = await prisma.instrument.findMany({
    where,
    orderBy: [{ name: "asc" }],
    take: 120,
    include: { facility: { include: { institution: { select: { name: true, slug: true, city: true, state: true, currency: true, latitude: true, longitude: true } } } } },
  });

  // Distinct category facet across all browsable equipment (ignores current filters).
  const all = await prisma.instrument.findMany({
    where: { status: { not: "OFFLINE" }, facility: { institution: { isPublished: true, onExchange: true } } },
    select: { category: true },
  });
  const categories = [...new Set(all.map((i) => i.category).filter(Boolean))].sort();

  // Distinct city facet for the "near me" / city filter.
  const cityRows = await prisma.institution.findMany({
    where: { isPublished: true, onExchange: true, facilities: { some: { instruments: { some: { status: { not: "OFFLINE" } } } } } },
    select: { city: true },
  });
  const cities = [...new Set(cityRows.map((i) => i.city).filter((c): c is string => !!c))].sort();

  res.json({
    categories,
    cities,
    total: items.length,
    data: items.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      make: i.make,
      model: i.model,
      status: i.status,
      hourlyRate: i.hourlyRate,
      images: i.images,
      imageUrl: i.imageUrl,
      trainingRequired: i.trainingRequired,
      institution: {
        name: i.facility.institution.name,
        slug: i.facility.institution.slug,
        city: i.facility.institution.city,
        state: i.facility.institution.state,
        currency: i.facility.institution.currency,
        latitude: i.facility.institution.latitude,
        longitude: i.facility.institution.longitude,
      },
      facility: { name: i.facility.name, location: i.facility.location },
    })),
  });
});

// GET /instruments/:id/availability?days=10 — PUBLIC engine-driven capacity grid.
instrumentsRouter.get("/:id/availability", async (req, res) => {
  const inst = await prisma.instrument.findUnique({ where: { id: req.params.id } });
  if (!inst) throw new AppError(404, "Instrument not found");
  const daysRaw = typeof req.query.days === "string" ? Number(req.query.days) : 10;
  const days = Math.min(Math.max(Number.isFinite(daysRaw) ? daysRaw : 10, 1), 60);
  const result = await instrumentAvailability(inst, days);
  res.json(result);
});

// GET /instruments — own institution instruments, filter category/status/facilityId
instrumentsRouter.get("/", requireAuth, requireRole(...adminRoles), async (req, res) => {
  const u = currentUser(req);
  const p = paginate(req.query);
  const instId = scopedInstitutionId(u, strParam(req.query, "institutionId"));

  const where: any = {};
  if (instId) where.facility = { institutionId: instId };
  const category = strParam(req.query, "category");
  const status = strParam(req.query, "status");
  const facilityId = strParam(req.query, "facilityId");
  if (category) where.category = category;
  if (status) where.status = status;
  if (facilityId) where.facilityId = facilityId;
  if (p.q) where.name = { contains: p.q, mode: "insensitive" };

  const [data, total] = await Promise.all([
    prisma.instrument.findMany({
      where,
      orderBy: { name: "asc" },
      skip: p.skip,
      take: p.take,
      include: { facility: true },
    }),
    prisma.instrument.count({ where }),
  ]);
  res.json(pageResult(data, total, p));
});

// GET /instruments/:id — one (+facility, +bookings)
instrumentsRouter.get("/:id", requireAuth, requireRole(...adminRoles), async (req, res) => {
  const u = currentUser(req);
  const inst = await prisma.instrument.findUnique({
    where: { id: req.params.id },
    include: {
      facility: true,
      documents: { orderBy: { createdAt: "desc" } },
      bookings: { orderBy: { startAt: "desc" }, take: 50, include: { user: { select: { id: true, name: true } } } },
      maintenanceWindows: { orderBy: { startAt: "asc" } },
      reservations: {
        where: { status: "HELD" },
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { serviceOrder: { select: { id: true, code: true, service: { select: { name: true } } } } },
      },
    },
  });
  if (!inst) throw new AppError(404, "Instrument not found");
  if (u.role !== "SUPER_ADMIN" && inst.facility.institutionId !== u.institutionId) {
    throw new AppError(403, "Cannot access another institution's instrument");
  }
  res.json(inst);
});

const createSchema = z.object({
  facilityId: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  make: z.string().optional(),
  model: z.string().optional(),
  specs: z.any().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  images: z.array(z.string()).optional(),
  applications: z.array(z.string()).optional(),
  status: z.enum(instrumentStatuses).optional(),
  accreditation: z.string().optional(),
  certifications: z.array(certificationSchema).optional(),
  industries: z.array(z.string()).optional(),
  hourlyRate: z.number().optional(),
  trainingRequired: z.boolean().optional(),
  maxSampleSpec: z.any().optional(),
  netTestHours: z.number().min(0).nullable().optional(),
  lastCalibratedAt: z.string().datetime().optional(),
  nextCalibrationAt: z.string().datetime().optional(),
  ...capacityFields,
});

async function assertFacilityInTenant(facilityId: string, u: { role: string; institutionId: string | null }) {
  const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
  if (!facility) throw new AppError(404, "Facility not found");
  if (u.role !== "SUPER_ADMIN" && facility.institutionId !== u.institutionId) {
    throw new AppError(403, "Facility belongs to another institution");
  }
  return facility;
}

// POST /instruments
instrumentsRouter.post(
  "/",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "LAB_MANAGER"),
  async (req, res) => {
    const u = currentUser(req);
    const body = createSchema.parse(req.body);
    await assertFacilityInTenant(body.facilityId, u);
    const inst = await prisma.instrument.create({
      data: {
        ...body,
        // Prisma rejects literal null for Json? fields — omit when empty (column defaults to null).
        maxSampleSpec: body.maxSampleSpec ?? undefined,
        lastCalibratedAt: body.lastCalibratedAt ? new Date(body.lastCalibratedAt) : undefined,
        nextCalibrationAt: body.nextCalibrationAt ? new Date(body.nextCalibrationAt) : undefined,
      },
    });
    await prisma.auditLog.create({
      data: { userId: u.id, action: "create", entity: "Instrument", entityId: inst.id },
    });
    res.status(201).json(inst);
  }
);

const updateSchema = createSchema.partial();

// PATCH /instruments/:id
instrumentsRouter.patch(
  "/:id",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "LAB_MANAGER"),
  async (req, res) => {
    const u = currentUser(req);
    const inst = await prisma.instrument.findUnique({
      where: { id: req.params.id },
      include: { facility: true },
    });
    if (!inst) throw new AppError(404, "Instrument not found");
    if (u.role !== "SUPER_ADMIN" && inst.facility.institutionId !== u.institutionId) {
      throw new AppError(403, "Cannot modify another institution's instrument");
    }
    const body = updateSchema.parse(req.body);
    if (body.facilityId) await assertFacilityInTenant(body.facilityId, u);
    const updated = await prisma.instrument.update({
      where: { id: inst.id },
      data: {
        ...body,
        // null clears the column (Prisma.DbNull); undefined leaves it untouched.
        maxSampleSpec: body.maxSampleSpec === undefined ? undefined : (body.maxSampleSpec === null ? Prisma.DbNull : body.maxSampleSpec),
        lastCalibratedAt: body.lastCalibratedAt ? new Date(body.lastCalibratedAt) : undefined,
        nextCalibrationAt: body.nextCalibrationAt ? new Date(body.nextCalibrationAt) : undefined,
      },
    });
    await prisma.auditLog.create({
      data: { userId: u.id, action: "update", entity: "Instrument", entityId: inst.id, meta: body },
    });
    res.json(updated);
  }
);

// ------------------------------------------------------------------
// Nested documents
// ------------------------------------------------------------------
async function assertInstrumentInTenant(
  instrumentId: string,
  u: { role: string; institutionId: string | null }
) {
  const inst = await prisma.instrument.findUnique({
    where: { id: instrumentId },
    include: { facility: true },
  });
  if (!inst) throw new AppError(404, "Instrument not found");
  if (u.role !== "SUPER_ADMIN" && inst.facility.institutionId !== u.institutionId) {
    throw new AppError(403, "Cannot modify another institution's instrument");
  }
  return inst;
}

const documentSchema = z.object({
  type: z.enum(documentTypes),
  name: z.string().min(1),
  url: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
});

// POST /instruments/:id/documents
instrumentsRouter.post(
  "/:id/documents",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "LAB_MANAGER", "OPERATOR"),
  async (req, res) => {
    const u = currentUser(req);
    await assertInstrumentInTenant(req.params.id, u);
    const body = documentSchema.parse(req.body);
    const doc = await prisma.instrumentDocument.create({
      data: {
        instrumentId: req.params.id,
        type: body.type,
        name: body.name,
        url: body.url,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      },
    });
    await prisma.auditLog.create({
      data: { userId: u.id, action: "create", entity: "InstrumentDocument", entityId: doc.id },
    });
    res.status(201).json(doc);
  }
);

// DELETE /instruments/:id/documents/:docId
instrumentsRouter.delete(
  "/:id/documents/:docId",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "LAB_MANAGER", "OPERATOR"),
  async (req, res) => {
    const u = currentUser(req);
    await assertInstrumentInTenant(req.params.id, u);
    const doc = await prisma.instrumentDocument.findUnique({ where: { id: req.params.docId } });
    if (!doc || doc.instrumentId !== req.params.id) throw new AppError(404, "Document not found");
    await prisma.instrumentDocument.delete({ where: { id: doc.id } });
    await prisma.auditLog.create({
      data: { userId: u.id, action: "delete", entity: "InstrumentDocument", entityId: doc.id },
    });
    res.status(204).end();
  }
);

// ------------------------------------------------------------------
// Maintenance windows
// ------------------------------------------------------------------
const maintenanceSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  reason: z.string().optional(),
});

// POST /instruments/:id/maintenance — schedule a maintenance window
instrumentsRouter.post(
  "/:id/maintenance",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "LAB_MANAGER", "OPERATOR"),
  async (req, res) => {
    const u = currentUser(req);
    await assertInstrumentInTenant(req.params.id, u);
    const body = maintenanceSchema.parse(req.body);
    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);
    if (endAt <= startAt) throw new AppError(400, "endAt must be after startAt");
    const mw = await prisma.maintenanceWindow.create({
      data: { instrumentId: req.params.id, startAt, endAt, reason: body.reason },
    });
    await prisma.auditLog.create({
      data: { userId: u.id, action: "create", entity: "MaintenanceWindow", entityId: mw.id },
    });
    res.status(201).json(mw);
  }
);

// DELETE /instruments/:id/maintenance/:mwId — remove a maintenance window
instrumentsRouter.delete(
  "/:id/maintenance/:mwId",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "LAB_MANAGER", "OPERATOR"),
  async (req, res) => {
    const u = currentUser(req);
    await assertInstrumentInTenant(req.params.id, u);
    const mw = await prisma.maintenanceWindow.findUnique({ where: { id: req.params.mwId } });
    if (!mw || mw.instrumentId !== req.params.id) throw new AppError(404, "Maintenance window not found");
    await prisma.maintenanceWindow.delete({ where: { id: mw.id } });
    await prisma.auditLog.create({
      data: { userId: u.id, action: "delete", entity: "MaintenanceWindow", entityId: mw.id },
    });
    res.status(204).end();
  }
);

// DELETE /instruments/:id — INSTITUTION_ADMIN
instrumentsRouter.delete(
  "/:id",
  requireAuth,
  requireRole("INSTITUTION_ADMIN"),
  async (req, res) => {
    const u = currentUser(req);
    const inst = await prisma.instrument.findUnique({
      where: { id: req.params.id },
      include: { facility: true },
    });
    if (!inst) throw new AppError(404, "Instrument not found");
    if (u.role !== "SUPER_ADMIN" && inst.facility.institutionId !== u.institutionId) {
      throw new AppError(403, "Cannot delete another institution's instrument");
    }
    await prisma.instrument.delete({ where: { id: inst.id } });
    await prisma.auditLog.create({
      data: { userId: u.id, action: "delete", entity: "Instrument", entityId: inst.id },
    });
    res.status(204).end();
  }
);
