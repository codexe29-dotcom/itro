import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { AppError } from "../http";
import { requireAuth, currentUser } from "../middleware/auth";
import { signJwt, hashPassword, comparePassword } from "../lib/tokens";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().transform((e) => e.trim().toLowerCase()),
  password: z.string().min(6),
  orgName: z.string().optional(),
  phone: z.string().optional(),
});

function publicUser(u: {
  id: string;
  role: string;
  name: string;
  email: string;
  phone: string | null;
  orgName: string | null;
  isActive: boolean;
  institutionId: string | null;
}) {
  return {
    id: u.id,
    role: u.role,
    name: u.name,
    email: u.email,
    phone: u.phone,
    orgName: u.orgName,
    isActive: u.isActive,
    institutionId: u.institutionId,
  };
}

// POST /auth/register -> creates an INDUSTRY_BUYER
authRouter.post("/register", async (req, res) => {
  const body = registerSchema.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) throw new AppError(409, "Email already registered");

  const user = await prisma.user.create({
    data: {
      role: "INDUSTRY_BUYER",
      name: body.name,
      email: body.email,
      passwordHash: await hashPassword(body.password),
      orgName: body.orgName,
      phone: body.phone,
      institutionId: null,
    },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "register", entity: "User", entityId: user.id },
  });

  const token = signJwt({ id: user.id, role: user.role, institutionId: user.institutionId });
  res.status(201).json({ token, user: publicUser(user) });
});

const institutionTypes = [
  "UNIVERSITY", "ENGINEERING_COLLEGE", "MEDICAL_COLLEGE", "NATIONAL_LAB",
  "PRIVATE_RND", "INCUBATOR", "INDUSTRY",
] as const;

const registerProviderSchema = z.object({
  institutionName: z.string().min(1),
  type: z.enum(institutionTypes).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  contactName: z.string().min(1),
  email: z.string().email().transform((e) => e.trim().toLowerCase()),
  password: z.string().min(6),
  phone: z.string().optional(),
});

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "provider";
}

// POST /auth/register-provider -> creates an Institution + its INSTITUTION_ADMIN
authRouter.post("/register-provider", async (req, res) => {
  const body = registerProviderSchema.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) throw new AppError(409, "Email already registered");

  // Unique slug
  const base = slugify(body.institutionName);
  let slug = base;
  for (let i = 2; await prisma.institution.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;

  const institution = await prisma.institution.create({
    data: {
      name: body.institutionName,
      slug,
      type: (body.type ?? "PRIVATE_RND") as any,
      city: body.city,
      state: body.state,
      country: body.country || "India",
      isPublished: true,
      onExchange: true,
    },
  });

  const user = await prisma.user.create({
    data: {
      role: "INSTITUTION_ADMIN",
      name: body.contactName,
      email: body.email,
      passwordHash: await hashPassword(body.password),
      phone: body.phone,
      institutionId: institution.id,
    },
    include: { institution: true },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "register-provider", entity: "Institution", entityId: institution.id },
  });

  const token = signJwt({ id: user.id, role: user.role, institutionId: user.institutionId });
  res.status(201).json({ token, user: { ...publicUser(user), institution: user.institution } });
});

const loginSchema = z.object({
  email: z.string().email().transform((e) => e.trim().toLowerCase()),
  password: z.string().min(1),
});

// POST /auth/login
authRouter.post("/login", async (req, res) => {
  const body = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !user.isActive) throw new AppError(401, "Invalid credentials");
  const ok = await comparePassword(body.password, user.passwordHash);
  if (!ok) throw new AppError(401, "Invalid credentials");

  const token = signJwt({ id: user.id, role: user.role, institutionId: user.institutionId });
  res.json({ token, user: publicUser(user) });
});

// GET /auth/me
authRouter.get("/me", requireAuth, async (req, res) => {
  const u = currentUser(req);
  const user = await prisma.user.findUnique({
    where: { id: u.id },
    include: { institution: true },
  });
  if (!user) throw new AppError(404, "User not found");
  res.json({ ...publicUser(user), institution: user.institution });
});
