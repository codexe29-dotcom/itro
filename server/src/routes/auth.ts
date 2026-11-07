import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { AppError } from "../http";
import { requireAuth, currentUser } from "../middleware/auth";
import { signJwt, hashPassword, comparePassword } from "../lib/tokens";
import { rateLimit } from "express-rate-limit";
import { createHash, randomBytes } from "node:crypto";
import { env } from "../env";
import { sendEmail } from "../lib/integrations";

export const authRouter = Router();

const authAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please try again later." },
});

const authCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "strict" as const,
  path: "/api",
};

function setSessionCookie(res: import("express").Response, token: string) {
  res.cookie("rix_session", token, authCookieOptions);
}

function clearSessionCookie(res: import("express").Response) {
  res.clearCookie("rix_session", authCookieOptions);
}

const passwordSchema = z.string()
  .min(10, "Password must be at least 10 characters")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().transform((e) => e.trim().toLowerCase()),
  password: passwordSchema,
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
authRouter.post("/register", authAttemptLimiter, async (req, res) => {
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

  const token = signJwt({
    id: user.id,
    role: user.role,
    institutionId: user.institutionId,
    tokenVersion: user.authTokenVersion,
  });
  setSessionCookie(res, token);
  res.status(201).json({ user: publicUser(user) });
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
  password: passwordSchema,
  phone: z.string().optional(),
});

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "provider";
}

// POST /auth/register-provider -> creates an Institution + its INSTITUTION_ADMIN
authRouter.post("/register-provider", authAttemptLimiter, async (req, res) => {
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

  const token = signJwt({
    id: user.id,
    role: user.role,
    institutionId: user.institutionId,
    tokenVersion: user.authTokenVersion,
  });
  setSessionCookie(res, token);
  res.status(201).json({ user: { ...publicUser(user), institution: user.institution } });
});

const loginSchema = z.object({
  email: z.string().email().transform((e) => e.trim().toLowerCase()),
  password: z.string().min(1),
});

// POST /auth/login
authRouter.post("/login", authAttemptLimiter, async (req, res) => {
  const body = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !user.isActive) throw new AppError(401, "Invalid credentials");
  const ok = await comparePassword(body.password, user.passwordHash);
  if (!ok) throw new AppError(401, "Invalid credentials");

  const token = signJwt({
    id: user.id,
    role: user.role,
    institutionId: user.institutionId,
    tokenVersion: user.authTokenVersion,
  });
  setSessionCookie(res, token);
  res.json({ user: publicUser(user) });
});

const forgotPasswordSchema = z.object({
  email: z.string().email().transform((e) => e.trim().toLowerCase()),
});
const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});
const forgotPasswordResponse = {
  message: "If an account exists, a reset link will be sent when email delivery is configured.",
};

authRouter.post("/forgot-password", authAttemptLimiter, async (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    res.status(202).json(forgotPasswordResponse);
    return;
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } }),
  ]);

  const resetUrl = new URL("/reset-password", env.publicWebUrl);
  resetUrl.searchParams.set("token", rawToken);
  try {
    const result = await sendEmail(
      user.email,
      "Reset your ITRO password",
      `<p>Hello ${escapeHtml(user.name)},</p><p>Use the link below within one hour to reset your password:</p><p><a href="${resetUrl.toString()}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
    );
    if ("skipped" in result) {
      console.error("[auth] Password reset email was not sent because SMTP is not configured.");
    }
  } catch (error) {
    console.error("[auth] Password reset email delivery failed.", error);
  }

  res.status(202).json(forgotPasswordResponse);
});

authRouter.post("/reset-password", authAttemptLimiter, async (req, res) => {
  const { token, password } = resetPasswordSchema.parse(req.body);
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!resetToken || resetToken.expiresAt <= new Date() || !resetToken.user.isActive) {
    throw new AppError(400, "Reset link is invalid or expired");
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (transaction) => {
    const consumed = await transaction.passwordResetToken.deleteMany({
      where: { id: resetToken.id, expiresAt: { gt: new Date() } },
    });
    if (consumed.count !== 1) {
      throw new AppError(400, "Reset link is invalid or expired");
    }
    await transaction.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash, authTokenVersion: { increment: 1 } },
    });
    await transaction.passwordResetToken.deleteMany({ where: { userId: resetToken.userId } });
  });
  clearSessionCookie(res);
  res.json({ message: "Password has been reset. Please sign in with your new password." });
});

authRouter.post("/logout", requireAuth, async (req, res) => {
  const user = currentUser(req);
  await prisma.user.update({
    where: { id: user.id },
    data: { authTokenVersion: { increment: 1 } },
  });
  clearSessionCookie(res);
  res.status(204).end();
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] ?? char);
}
