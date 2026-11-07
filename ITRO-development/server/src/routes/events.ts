import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { AppError, paginate, pageResult, strParam } from "../http";
import { requireAuth, requireRole, currentUser } from "../middleware/auth";
import { requireInstitutionId } from "../lib/tenant";
import { notify } from "../lib/integrations";
import { verifyJwt } from "../lib/tokens";

export const eventsRouter = Router();

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "event";

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  for (let n = 2; n < 200; n++) {
    const clash = await prisma.event.findUnique({ where: { slug }, select: { id: true } });
    if (!clash) return slug;
    slug = `${base}-${n}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

const publicInclude = {
  institution: { select: { id: true, name: true, slug: true, city: true, state: true, logoUrl: true } },
  facility: { select: { id: true, name: true } },
  _count: { select: { registrations: true } },
} as const;

function shape(ev: any) {
  const registeredCount = ev._count?.registrations ?? 0;
  const spotsLeft = ev.capacity == null ? null : Math.max(0, ev.capacity - registeredCount);
  const { _count, ...rest } = ev;
  return { ...rest, registeredCount, spotsLeft, isFull: ev.capacity != null && registeredCount >= ev.capacity };
}

// ------------------------------------------------------------------
// PUBLIC
// ------------------------------------------------------------------
// GET /events — upcoming published events (filters: q, type, institutionId)
eventsRouter.get("/", async (req, res) => {
  const p = paginate(req.query);
  const type = strParam(req.query, "type");
  const institutionId = strParam(req.query, "institutionId");
  const scope = strParam(req.query, "scope"); // "past" | "all" | (default upcoming)

  const where: any = { isPublished: true, institution: { isPublished: true } };
  if (type) where.type = type;
  if (institutionId) where.institutionId = institutionId;
  if (scope !== "all") {
    const now = new Date();
    where.startAt = scope === "past" ? { lt: now } : { gte: new Date(now.getTime() - 12 * 3600 * 1000) };
  }
  if (p.q) where.OR = [
    { title: { contains: p.q, mode: "insensitive" } },
    { description: { contains: p.q, mode: "insensitive" } },
  ];

  const [rows, total] = await Promise.all([
    prisma.event.findMany({ where, orderBy: { startAt: scope === "past" ? "desc" : "asc" }, skip: p.skip, take: p.take, include: publicInclude }),
    prisma.event.count({ where }),
  ]);
  res.json(pageResult(rows.map(shape), total, p));
});

// GET /events/manage — own institution's events (all statuses). MUST precede /:slug.
eventsRouter.get("/manage", requireAuth, requireRole("INSTITUTION_ADMIN", "LAB_MANAGER"), async (req, res) => {
  const u = currentUser(req);
  const institutionId = requireInstitutionId(u);
  const rows = await prisma.event.findMany({
    where: { institutionId },
    orderBy: { startAt: "desc" },
    include: { facility: { select: { id: true, name: true } }, _count: { select: { registrations: true } } },
  });
  res.json(rows.map(shape));
});

// GET /events/:slug — public event detail (+ whether the caller is registered)
eventsRouter.get("/:slug", async (req, res) => {
  const ev = await prisma.event.findUnique({ where: { slug: req.params.slug }, include: publicInclude });
  if (!ev || !ev.isPublished) throw new AppError(404, "Event not found");
  const out = shape(ev);
  // If a token is present, report the caller's registration status (optional auth).
  let registered = false;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    try {
      const payload = verifyJwt(auth.slice("Bearer ".length).trim());
      if (payload?.id) {
        const reg = await prisma.eventRegistration.findUnique({ where: { eventId_userId: { eventId: ev.id, userId: payload.id } } });
        registered = !!reg && reg.status === "REGISTERED";
      }
    } catch { /* ignore invalid token — treat as anonymous */ }
  }
  res.json({ ...out, registered });
});

// ------------------------------------------------------------------
// REGISTRATION (any authenticated user)
// ------------------------------------------------------------------
eventsRouter.post("/:id/register", requireAuth, async (req, res) => {
  const u = currentUser(req);
  const ev = await prisma.event.findUnique({ where: { id: req.params.id }, include: { _count: { select: { registrations: true } } } });
  if (!ev || !ev.isPublished) throw new AppError(404, "Event not found");

  const existing = await prisma.eventRegistration.findUnique({ where: { eventId_userId: { eventId: ev.id, userId: u.id } } });
  if (existing && existing.status === "REGISTERED") return res.json({ ok: true, alreadyRegistered: true });

  if (ev.capacity != null) {
    const count = await prisma.eventRegistration.count({ where: { eventId: ev.id, status: "REGISTERED" } });
    if (count >= ev.capacity) throw new AppError(409, "This event is full.");
  }

  const me = await prisma.user.findUnique({ where: { id: u.id }, select: { name: true, email: true, phone: true } });
  const reg = existing
    ? await prisma.eventRegistration.update({ where: { id: existing.id }, data: { status: "REGISTERED" } })
    : await prisma.eventRegistration.create({ data: { eventId: ev.id, userId: u.id, status: "REGISTERED", name: me?.name, email: me?.email } });

  await notify({
    email: me?.email, phone: me?.phone,
    subject: `Registered — ${ev.title}`,
    message: `Hi ${me?.name ?? "there"}, you're registered for "${ev.title}". We'll see you there. — ITRO`,
  });
  res.status(201).json({ ok: true, registration: reg });
});

eventsRouter.post("/:id/cancel", requireAuth, async (req, res) => {
  const u = currentUser(req);
  const reg = await prisma.eventRegistration.findUnique({ where: { eventId_userId: { eventId: req.params.id, userId: u.id } } });
  if (!reg) throw new AppError(404, "You are not registered for this event");
  await prisma.eventRegistration.update({ where: { id: reg.id }, data: { status: "CANCELLED" } });
  res.json({ ok: true });
});

// ------------------------------------------------------------------
// ADMIN CRUD (INSTITUTION_ADMIN, LAB_MANAGER)
// ------------------------------------------------------------------
const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["WORKSHOP", "WEBINAR", "TRAINING", "OPEN_DAY", "CONFERENCE"]).optional(),
  mode: z.enum(["IN_PERSON", "ONLINE", "HYBRID"]).optional(),
  location: z.string().optional(),
  onlineUrl: z.string().optional(),
  imageUrl: z.string().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  price: z.number().nonnegative().optional(),
  facilityId: z.string().nullable().optional(),
  isPublished: z.boolean().optional(),
});

async function assertOwnEvent(id: string, u: ReturnType<typeof currentUser>) {
  const ev = await prisma.event.findUnique({ where: { id } });
  if (!ev) throw new AppError(404, "Event not found");
  if (u.role !== "SUPER_ADMIN" && ev.institutionId !== u.institutionId) throw new AppError(403, "Not your event");
  return ev;
}

eventsRouter.post("/", requireAuth, requireRole("INSTITUTION_ADMIN", "LAB_MANAGER"), async (req, res) => {
  const u = currentUser(req);
  const institutionId = requireInstitutionId(u);
  const body = createSchema.parse(req.body);
  if (body.facilityId) {
    const fac = await prisma.facility.findUnique({ where: { id: body.facilityId }, select: { institutionId: true } });
    if (!fac || (u.role !== "SUPER_ADMIN" && fac.institutionId !== institutionId)) throw new AppError(403, "Facility belongs to another institution");
  }
  const slug = await uniqueSlug(slugify(body.title));
  const ev = await prisma.event.create({
    data: {
      ...body,
      slug,
      institutionId,
      startAt: new Date(body.startAt),
      endAt: body.endAt ? new Date(body.endAt) : null,
    },
  });
  await prisma.auditLog.create({ data: { userId: u.id, action: "create", entity: "Event", entityId: ev.id } });
  res.status(201).json(ev);
});

eventsRouter.patch("/:id", requireAuth, requireRole("INSTITUTION_ADMIN", "LAB_MANAGER"), async (req, res) => {
  const u = currentUser(req);
  await assertOwnEvent(req.params.id, u);
  const body = createSchema.partial().parse(req.body);
  const data: Record<string, unknown> = { ...body };
  if (body.startAt) data.startAt = new Date(body.startAt);
  if (body.endAt !== undefined) data.endAt = body.endAt ? new Date(body.endAt) : null;
  const ev = await prisma.event.update({ where: { id: req.params.id }, data });
  await prisma.auditLog.create({ data: { userId: u.id, action: "update", entity: "Event", entityId: ev.id } });
  res.json(ev);
});

eventsRouter.delete("/:id", requireAuth, requireRole("INSTITUTION_ADMIN", "LAB_MANAGER"), async (req, res) => {
  const u = currentUser(req);
  await assertOwnEvent(req.params.id, u);
  await prisma.event.delete({ where: { id: req.params.id } });
  await prisma.auditLog.create({ data: { userId: u.id, action: "delete", entity: "Event", entityId: req.params.id } });
  res.status(204).end();
});

// GET /events/:id/registrations — attendee list for the lab
eventsRouter.get("/:id/registrations", requireAuth, requireRole("INSTITUTION_ADMIN", "LAB_MANAGER"), async (req, res) => {
  const u = currentUser(req);
  await assertOwnEvent(req.params.id, u);
  const rows = await prisma.eventRegistration.findMany({
    where: { eventId: req.params.id, status: "REGISTERED" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, email: true, orgName: true } } },
  });
  res.json(rows);
});
