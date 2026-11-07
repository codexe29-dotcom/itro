import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { AppError, paginate, pageResult } from "../http";
import { requireAuth, requireRole, currentUser } from "../middleware/auth";
import { requireInstitutionId } from "../lib/tenant";
import { hashPassword } from "../lib/tokens";

export const usersRouter = Router();

// Roles an institution admin may assign within their institution.
const institutionRoles = ["INSTITUTION_ADMIN", "LAB_MANAGER", "OPERATOR", "FACULTY", "RESEARCHER"] as const;

const publicSelect = {
  id: true,
  role: true,
  name: true,
  email: true,
  phone: true,
  orgName: true,
  isActive: true,
  institutionId: true,
  createdAt: true,
} as const;

// GET /users — INSTITUTION_ADMIN: own-institution users
usersRouter.get("/", requireAuth, requireRole("INSTITUTION_ADMIN"), async (req, res) => {
  const u = currentUser(req);
  const p = paginate(req.query);
  const where: any = {};
  if (u.role === "SUPER_ADMIN") {
    if (typeof req.query.institutionId === "string") where.institutionId = req.query.institutionId;
  } else {
    where.institutionId = requireInstitutionId(u);
  }
  if (p.q) {
    where.OR = [
      { name: { contains: p.q, mode: "insensitive" } },
      { email: { contains: p.q, mode: "insensitive" } },
    ];
  }
  const [data, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { name: "asc" }, skip: p.skip, take: p.take, select: publicSelect }),
    prisma.user.count({ where }),
  ]);
  res.json(pageResult(data, total, p));
});

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().transform((e) => e.trim().toLowerCase()),
  role: z.enum(institutionRoles),
  password: z.string().min(6),
  phone: z.string().optional(),
});

// POST /users — INSTITUTION_ADMIN creates a user within the institution
usersRouter.post("/", requireAuth, requireRole("INSTITUTION_ADMIN"), async (req, res) => {
  const u = currentUser(req);
  const body = createSchema.parse(req.body);
  const institutionId = u.role === "SUPER_ADMIN"
    ? (typeof req.body.institutionId === "string" ? req.body.institutionId : undefined)
    : requireInstitutionId(u);
  if (!institutionId) throw new AppError(400, "institutionId is required");

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) throw new AppError(409, "Email already registered");

  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      role: body.role,
      passwordHash: await hashPassword(body.password),
      phone: body.phone,
      institutionId,
    },
    select: publicSelect,
  });
  await prisma.auditLog.create({
    data: { userId: u.id, action: "create", entity: "User", entityId: user.id },
  });
  res.status(201).json(user);
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(institutionRoles).optional(),
  isActive: z.boolean().optional(),
  phone: z.string().optional(),
});

// PATCH /users/:id — INSTITUTION_ADMIN update role/active
usersRouter.patch("/:id", requireAuth, requireRole("INSTITUTION_ADMIN"), async (req, res) => {
  const u = currentUser(req);
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) throw new AppError(404, "User not found");
  if (u.role !== "SUPER_ADMIN" && target.institutionId !== u.institutionId) {
    throw new AppError(403, "Cannot modify a user in another institution");
  }
  const body = updateSchema.parse(req.body);
  const updated = await prisma.user.update({ where: { id: target.id }, data: body, select: publicSelect });
  await prisma.auditLog.create({
    data: { userId: u.id, action: "update", entity: "User", entityId: target.id, meta: body },
  });
  res.json(updated);
});
