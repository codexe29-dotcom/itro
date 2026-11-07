import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { AppError } from "../http";
import { requireAuth, requireRole, currentUser } from "../middleware/auth";
import { requireInstitutionId } from "../lib/tenant";

// Provider (institution) self-service catalog: enrol own services against
// existing tests, and request brand-new tests for platform approval.
export const providerCatalogRouter = Router();

const providerOnly = [requireAuth, requireRole("INSTITUTION_ADMIN", "LAB_MANAGER")] as const;

/** Assert a service belongs to the acting institution. */
async function ownService(serviceId: string, institutionId: string) {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || service.institutionId !== institutionId) throw new AppError(403, "Not your service");
  return service;
}

// GET /provider/setup — onboarding progress for the acting institution
providerCatalogRouter.get("/provider/setup", ...providerOnly, async (req, res) => {
  const instId = requireInstitutionId(currentUser(req));
  const [facilities, instruments, services, servicesWithInstrument, enrollments, institution] = await Promise.all([
    prisma.facility.count({ where: { institutionId: instId } }),
    prisma.instrument.count({ where: { facility: { institutionId: instId } } }),
    prisma.service.count({ where: { institutionId: instId } }),
    prisma.service.count({ where: { institutionId: instId, instrumentId: { not: null } } }),
    prisma.testProvider.count({ where: { service: { institutionId: instId } } }),
    prisma.institution.findUnique({ where: { id: instId }, select: { about: true, city: true, accreditations: true, isPublished: true } }),
  ]);
  const profileComplete = !!(institution?.about && institution?.city && (institution?.accreditations?.length ?? 0) > 0);
  res.json({ facilities, instruments, services, servicesWithInstrument, enrollments, profileComplete, isPublished: institution?.isPublished ?? false });
});

// GET /provider/catalog — tests + my services + my current enrolments
providerCatalogRouter.get("/provider/catalog", ...providerOnly, async (req, res) => {
  const instId = requireInstitutionId(currentUser(req));
  const [industries, myServices, myLinks, instruments] = await Promise.all([
    prisma.industry.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: {
        slug: true, title: true,
        tests: { where: { isActive: true }, orderBy: { order: "asc" }, select: { id: true, slug: true, name: true, category: true, accreditation: true, summary: true } },
      },
    }),
    prisma.service.findMany({ where: { institutionId: instId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, category: true, priceIndustry: true } }),
    prisma.testProvider.findMany({ where: { service: { institutionId: instId } }, select: { testId: true, serviceId: true } }),
    prisma.instrument.findMany({ where: { facility: { institutionId: instId } }, orderBy: { name: "asc" }, select: { id: true, name: true, category: true } }),
  ]);
  res.json({ industries, myServices, enrollments: myLinks, instruments });
});

// POST /provider/tests/:testId/enroll — offer one of MY services against a test
providerCatalogRouter.post("/provider/tests/:testId/enroll", ...providerOnly, async (req, res) => {
  const u = currentUser(req);
  const instId = requireInstitutionId(u);
  const { serviceId } = z.object({ serviceId: z.string().min(1) }).parse(req.body);
  await ownService(serviceId, instId);
  const test = await prisma.testDefinition.findUnique({ where: { id: req.params.testId } });
  if (!test) throw new AppError(404, "Test not found");
  const link = await prisma.testProvider.upsert({
    where: { testId_serviceId: { testId: test.id, serviceId } },
    update: {},
    create: { testId: test.id, serviceId },
  });
  await prisma.auditLog.create({ data: { userId: u.id, action: "enroll", entity: "TestDefinition", entityId: test.id, meta: { serviceId } } });
  res.status(201).json(link);
});

// DELETE /provider/tests/:testId/enroll/:serviceId — withdraw my service
providerCatalogRouter.delete("/provider/tests/:testId/enroll/:serviceId", ...providerOnly, async (req, res) => {
  const u = currentUser(req);
  const instId = requireInstitutionId(u);
  await ownService(req.params.serviceId, instId);
  await prisma.testProvider.deleteMany({ where: { testId: req.params.testId, serviceId: req.params.serviceId } });
  await prisma.auditLog.create({ data: { userId: u.id, action: "unenroll", entity: "TestDefinition", entityId: req.params.testId, meta: { serviceId: req.params.serviceId } } });
  res.json({ ok: true });
});

// POST /provider/tests/:testId/offer — CATALOG-FIRST: create a testing service for
// this lab AND enrol it against the catalog test in one step.
const offerSchema = z.object({
  name: z.string().optional(),
  priceIndustry: z.number().nonnegative(),
  pricingMode: z.enum(["QUOTE", "FIXED"]).default("FIXED"),
  turnaroundDays: z.number().int().positive().default(7),
  instrumentId: z.string().optional().nullable(),
  rushDays: z.number().int().positive().nullable().optional(),
  rushSurchargePct: z.number().min(0).max(500).nullable().optional(),
});
providerCatalogRouter.post("/provider/tests/:testId/offer", ...providerOnly, async (req, res) => {
  const u = currentUser(req);
  const instId = requireInstitutionId(u);
  const test = await prisma.testDefinition.findUnique({ where: { id: req.params.testId }, include: { forms: true } });
  if (!test) throw new AppError(404, "Test not found");
  const body = offerSchema.parse(req.body);
  if (body.instrumentId) {
    const inst = await prisma.instrument.findUnique({ where: { id: body.instrumentId }, include: { facility: true } });
    if (!inst || inst.facility.institutionId !== instId) throw new AppError(403, "Instrument belongs to another lab");
  }
  const service = await prisma.service.create({
    data: {
      institutionId: instId,
      name: body.name?.trim() || test.name,
      category: test.category,
      description: test.summary ?? test.description ?? null,
      turnaroundDays: body.turnaroundDays,
      priceInternal: body.priceIndustry, priceAcademic: body.priceIndustry, priceIndustry: body.priceIndustry,
      pricingMode: body.pricingMode,
      accreditation: test.accreditation,
      instrumentId: body.instrumentId ?? null,
      rushDays: body.rushDays ?? null, rushSurchargePct: body.rushSurchargePct ?? null,
      // Prefill buyer requirements from the catalog test — provider can edit these later.
      samplesRequired: test.samplesRequired,
      sampleRequirements: test.sampleRequirements,
      sampleDestructive: test.sampleDestructive,
      sampleReturned: test.sampleReturned,
      deliverables: test.deliverables,
      intakeForms: test.forms.map((f) => ({ name: f.name, description: f.description ?? "", required: f.required })) as any,
      isActive: true,
    },
  });
  const link = await prisma.testProvider.create({ data: { testId: test.id, serviceId: service.id } });
  await prisma.auditLog.create({ data: { userId: u.id, action: "offer-test", entity: "TestDefinition", entityId: test.id, meta: { serviceId: service.id } } });
  res.status(201).json({ service, link });
});

// POST /provider/tests/create-and-offer — self-serve: create a NEW catalog test AND
// offer it in one step (used by the "add a test you offer" flow when nothing matches).
const createOfferSchema = z.object({
  name: z.string().min(1),
  industrySlug: z.string().min(1),
  category: z.string().min(1),
  standardCodes: z.array(z.string()).default([]),
  summary: z.string().optional().nullable(),
  priceIndustry: z.number().nonnegative(),
  pricingMode: z.enum(["FIXED", "QUOTE"]).default("FIXED"),
  turnaroundDays: z.number().int().positive().default(7),
  instrumentId: z.string().optional().nullable(),
});
providerCatalogRouter.post("/provider/tests/create-and-offer", ...providerOnly, async (req, res) => {
  const u = currentUser(req);
  const instId = requireInstitutionId(u);
  const body = createOfferSchema.parse(req.body);
  const industry = await prisma.industry.findUnique({ where: { slug: body.industrySlug } });
  if (!industry) throw new AppError(400, "Unknown industry");
  if (body.instrumentId) {
    const inst = await prisma.instrument.findUnique({ where: { id: body.instrumentId }, include: { facility: true } });
    if (!inst || inst.facility.institutionId !== instId) throw new AppError(403, "Instrument belongs to another lab");
  }
  // Reuse an existing catalog test with the same name if present; else create one.
  let test = await prisma.testDefinition.findFirst({ where: { name: { equals: body.name.trim(), mode: "insensitive" } } });
  if (!test) {
    const base = `${industry.slug}-${body.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "test";
    let slug = base;
    for (let i = 2; await prisma.testDefinition.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
    const order = await prisma.testDefinition.count({ where: { industryId: industry.id } });
    test = await prisma.testDefinition.create({
      data: {
        slug, industryId: industry.id, name: body.name.trim(), category: body.category,
        summary: body.summary ?? null, standardCodes: body.standardCodes, turnaroundDays: body.turnaroundDays, order,
      },
    });
  }
  const service = await prisma.service.create({
    data: {
      institutionId: instId, name: body.name.trim(), category: body.category,
      description: test.summary ?? null, turnaroundDays: body.turnaroundDays,
      priceInternal: body.priceIndustry, priceAcademic: body.priceIndustry, priceIndustry: body.priceIndustry,
      pricingMode: body.pricingMode, accreditation: test.accreditation, instrumentId: body.instrumentId ?? null,
      samplesRequired: test.samplesRequired, sampleRequirements: test.sampleRequirements,
      sampleDestructive: test.sampleDestructive, sampleReturned: test.sampleReturned, deliverables: test.deliverables,
      isActive: true,
    },
  });
  const link = await prisma.testProvider.upsert({
    where: { testId_serviceId: { testId: test.id, serviceId: service.id } }, update: {}, create: { testId: test.id, serviceId: service.id },
  });
  await prisma.auditLog.create({ data: { userId: u.id, action: "create-and-offer", entity: "TestDefinition", entityId: test.id, meta: { serviceId: service.id } } });
  res.status(201).json({ test, service, link });
});

const requestSchema = z.object({
  name: z.string().min(1),
  industrySlug: z.string().optional(),
  category: z.string().min(1),
  summary: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  standardCodes: z.array(z.string()).default([]),
  sampleRequirements: z.string().optional().nullable(),
  turnaroundDays: z.number().int().positive().default(7),
  serviceId: z.string().optional().nullable(),
});

// POST /provider/test-requests — request a new catalog test (platform approves)
providerCatalogRouter.post("/provider/test-requests", ...providerOnly, async (req, res) => {
  const u = currentUser(req);
  const instId = requireInstitutionId(u);
  const body = requestSchema.parse(req.body);
  if (body.serviceId) await ownService(body.serviceId, instId);
  const industry = body.industrySlug ? await prisma.industry.findUnique({ where: { slug: body.industrySlug } }) : null;

  const request = await prisma.testRequest.create({
    data: {
      institutionId: instId,
      industryId: industry?.id ?? null,
      name: body.name,
      category: body.category,
      summary: body.summary ?? null,
      description: body.description ?? null,
      standardCodes: body.standardCodes,
      sampleRequirements: body.sampleRequirements ?? null,
      turnaroundDays: body.turnaroundDays,
      serviceId: body.serviceId ?? null,
    },
  });
  await prisma.auditLog.create({ data: { userId: u.id, action: "request-test", entity: "TestRequest", entityId: request.id } });
  res.status(201).json(request);
});

// GET /provider/test-requests — my submitted requests
providerCatalogRouter.get("/provider/test-requests", ...providerOnly, async (req, res) => {
  const instId = requireInstitutionId(currentUser(req));
  const requests = await prisma.testRequest.findMany({
    where: { institutionId: instId },
    orderBy: { createdAt: "desc" },
    include: { industry: { select: { title: true } } },
  });
  res.json(requests);
});
