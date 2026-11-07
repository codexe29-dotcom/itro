import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { AppError, paginate, pageResult, strParam } from "../http";
import { requireAuth, requireRole, currentUser } from "../middleware/auth";
import { scopedInstitutionId } from "../lib/tenant";

export const expertsRouter = Router();

const ratePeriods = ["HOURLY", "DAILY", "PROJECT"] as const;
const adminRoles = ["INSTITUTION_ADMIN", "LAB_MANAGER"] as const;

// ------------------------------------------------------------------
// Public — expert profile (no auth). Placed before /:id so it is not
// shadowed by the admin route.
// ------------------------------------------------------------------
// GET /experts/public/:id — PUBLIC expert profile + institution.
expertsRouter.get("/public/:id", async (req, res) => {
  const expert = await prisma.expert.findUnique({
    where: { id: req.params.id },
    include: { institution: true },
  });
  if (!expert || !expert.isActive) throw new AppError(404, "Expert not found");
  if (!expert.institution.isPublished || !expert.institution.onExchange) {
    throw new AppError(404, "Expert not found");
  }
  res.json(expert);
});

// ------------------------------------------------------------------
// Admin (institution-scoped)
// ------------------------------------------------------------------
// GET /experts — own institution, paginated + filters (q, expertise, skill)
expertsRouter.get("/", requireAuth, requireRole(...adminRoles), async (req, res) => {
  const u = currentUser(req);
  const p = paginate(req.query);
  const instId = scopedInstitutionId(u, strParam(req.query, "institutionId"));

  const where: any = {};
  if (instId) where.institutionId = instId;
  const expertise = strParam(req.query, "expertise");
  const skill = strParam(req.query, "skill");
  if (expertise) where.expertise = { has: expertise };
  if (skill) where.skills = { has: skill };
  if (p.q) {
    where.OR = [
      { name: { contains: p.q, mode: "insensitive" } },
      { title: { contains: p.q, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.expert.findMany({
      where,
      orderBy: { name: "asc" },
      skip: p.skip,
      take: p.take,
    }),
    prisma.expert.count({ where }),
  ]);
  res.json(pageResult(data, total, p));
});

// GET /experts/:id — one (own institution)
expertsRouter.get("/:id", requireAuth, requireRole(...adminRoles), async (req, res) => {
  const u = currentUser(req);
  const expert = await prisma.expert.findUnique({
    where: { id: req.params.id },
    include: { institution: true },
  });
  if (!expert) throw new AppError(404, "Expert not found");
  if (u.role !== "SUPER_ADMIN" && expert.institutionId !== u.institutionId) {
    throw new AppError(403, "Cannot access another institution's expert");
  }
  res.json(expert);
});

const baseSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  photoUrl: z.string().optional(),
  bio: z.string().optional(),
  expertise: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  experienceYears: z.number().int().nonnegative().optional(),
  ratePeriod: z.enum(ratePeriods).optional(),
  rate: z.number().nonnegative().optional(),
  availability: z.string().optional(),
  certifications: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

const createSchema = baseSchema.extend({
  // SUPER_ADMIN may target an institution explicitly.
  institutionId: z.string().optional(),
});

// POST /experts
expertsRouter.post("/", requireAuth, requireRole(...adminRoles), async (req, res) => {
  const u = currentUser(req);
  const body = createSchema.parse(req.body);
  const institutionId = scopedInstitutionId(u, body.institutionId);
  if (!institutionId) {
    throw new AppError(400, "institutionId is required");
  }
  const { institutionId: _ignore, ...data } = body;
  const expert = await prisma.expert.create({
    data: { ...data, institutionId },
  });
  await prisma.auditLog.create({
    data: { userId: u.id, action: "create", entity: "Expert", entityId: expert.id },
  });
  res.status(201).json(expert);
});

const updateSchema = baseSchema.partial();

// PATCH /experts/:id
expertsRouter.patch("/:id", requireAuth, requireRole(...adminRoles), async (req, res) => {
  const u = currentUser(req);
  const expert = await prisma.expert.findUnique({ where: { id: req.params.id } });
  if (!expert) throw new AppError(404, "Expert not found");
  if (u.role !== "SUPER_ADMIN" && expert.institutionId !== u.institutionId) {
    throw new AppError(403, "Cannot modify another institution's expert");
  }
  const body = updateSchema.parse(req.body);
  const updated = await prisma.expert.update({ where: { id: expert.id }, data: body });
  await prisma.auditLog.create({
    data: { userId: u.id, action: "update", entity: "Expert", entityId: expert.id, meta: body },
  });
  res.json(updated);
});

// DELETE /experts/:id
expertsRouter.delete("/:id", requireAuth, requireRole(...adminRoles), async (req, res) => {
  const u = currentUser(req);
  const expert = await prisma.expert.findUnique({ where: { id: req.params.id } });
  if (!expert) throw new AppError(404, "Expert not found");
  if (u.role !== "SUPER_ADMIN" && expert.institutionId !== u.institutionId) {
    throw new AppError(403, "Cannot delete another institution's expert");
  }
  await prisma.expert.delete({ where: { id: expert.id } });
  await prisma.auditLog.create({
    data: { userId: u.id, action: "delete", entity: "Expert", entityId: expert.id },
  });
  res.status(204).end();
});
