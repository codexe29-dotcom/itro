import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { AppError, paginate, pageResult } from "../http";
import { requireAuth, requireRole, currentUser } from "../middleware/auth";
import { scopedInstitutionId, requireInstitutionId } from "../lib/tenant";
import { attachBuyerPrices } from "../lib/pricing";

export const facilitiesRouter = Router();

// GET /facilities/public/:id — public facility profile: the team that runs it, its
// instruments, and the active services it offers. A facility is a first-class lab.
facilitiesRouter.get("/public/:id", async (req, res) => {
  const facility = await prisma.facility.findUnique({
    where: { id: req.params.id },
    include: {
      institution: { select: { id: true, name: true, slug: true, city: true, state: true, country: true, currency: true, logoUrl: true, isPublished: true } },
      instruments: { orderBy: { name: "asc" } },
      services: { where: { isActive: true }, orderBy: { name: "asc" }, include: { instrument: true, institution: true } },
      events: {
        where: { isPublished: true, startAt: { gte: new Date(Date.now() - 12 * 3600 * 1000) } },
        orderBy: { startAt: "asc" },
        include: { _count: { select: { registrations: true } } },
      },
    },
  });
  if (!facility || !facility.institution.isPublished) throw new AppError(404, "Facility not found");
  const services = await attachBuyerPrices(facility.services);
  const events = facility.events.map((ev) => {
    const registeredCount = ev._count.registrations;
    const { _count, ...rest } = ev;
    return { ...rest, registeredCount, spotsLeft: ev.capacity == null ? null : Math.max(0, ev.capacity - registeredCount) };
  });
  res.json({ ...facility, services, events });
});

// GET /facilities — own institution facilities + instrument counts
facilitiesRouter.get(
  "/",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "LAB_MANAGER"),
  async (req, res) => {
    const u = currentUser(req);
    const p = paginate(req.query);
    const where: any = {};
    const instId = scopedInstitutionId(u, typeof req.query.institutionId === "string" ? req.query.institutionId : undefined);
    if (instId) where.institutionId = instId;
    if (p.q) where.name = { contains: p.q, mode: "insensitive" };

    const [rows, total] = await Promise.all([
      prisma.facility.findMany({
        where,
        orderBy: { name: "asc" },
        skip: p.skip,
        take: p.take,
        include: {
          _count: { select: { instruments: true } },
          holidays: { orderBy: { date: "asc" } },
        },
      }),
      prisma.facility.count({ where }),
    ]);
    const data = rows.map((f) => ({ ...f, instrumentCount: f._count.instruments }));
    res.json(pageResult(data, total, p));
  }
);

// Weekly opening hours: null (closed) or { open:"HH:mm", close:"HH:mm" } per weekday.
const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
const dayHours = z.object({ open: hhmm, close: hhmm }).nullable();
const openingHoursSchema = z
  .object({
    mon: dayHours.optional(),
    tue: dayHours.optional(),
    wed: dayHours.optional(),
    thu: dayHours.optional(),
    fri: dayHours.optional(),
    sat: dayHours.optional(),
    sun: dayHours.optional(),
  })
  .nullable();

const createSchema = z.object({
  name: z.string().min(1),
  department: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  // Facility as a first-class lab: its own in-charge/team, contact and accreditations.
  inchargeName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  accreditations: z.array(z.string()).optional(),
  imageUrl: z.string().optional(),
  openingHours: openingHoursSchema.optional(),
  timezone: z.string().optional(),
});

// POST /facilities
facilitiesRouter.post(
  "/",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "LAB_MANAGER"),
  async (req, res) => {
    const u = currentUser(req);
    const body = createSchema.parse(req.body);
    const institutionId = requireInstitutionId(u);
    const { openingHours, ...rest } = body;
    const facility = await prisma.facility.create({
      data: { ...rest, institutionId, openingHours: openingHours ?? undefined },
    });
    await prisma.auditLog.create({
      data: { userId: u.id, action: "create", entity: "Facility", entityId: facility.id },
    });
    res.status(201).json(facility);
  }
);

const updateSchema = createSchema.partial();

// PATCH /facilities/:id
facilitiesRouter.patch(
  "/:id",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "LAB_MANAGER"),
  async (req, res) => {
    const u = currentUser(req);
    const facility = await prisma.facility.findUnique({ where: { id: req.params.id } });
    if (!facility) throw new AppError(404, "Facility not found");
    if (u.role !== "SUPER_ADMIN" && facility.institutionId !== u.institutionId) {
      throw new AppError(403, "Cannot modify another institution's facility");
    }
    const body = updateSchema.parse(req.body);
    const { openingHours, ...rest } = body;
    const data: Record<string, unknown> = { ...rest };
    // Only touch openingHours when the key is present; null clears it (Mon–Fri default kicks in).
    if ("openingHours" in body) {
      data.openingHours = openingHours === null ? Prisma.JsonNull : openingHours;
    }
    const updated = await prisma.facility.update({ where: { id: facility.id }, data });
    await prisma.auditLog.create({
      data: { userId: u.id, action: "update", entity: "Facility", entityId: facility.id, meta: { keys: Object.keys(body) } },
    });
    res.json(updated);
  }
);

// ------------------------------------------------------------------
// Holidays (closed-all-day dates per facility)
// ------------------------------------------------------------------
const holidaySchema = z.object({
  date: z.string().datetime(),
  name: z.string().optional(),
});

async function assertFacilityInTenant(id: string, u: { role: string; institutionId: string | null }) {
  const facility = await prisma.facility.findUnique({ where: { id } });
  if (!facility) throw new AppError(404, "Facility not found");
  if (u.role !== "SUPER_ADMIN" && facility.institutionId !== u.institutionId) {
    throw new AppError(403, "Facility belongs to another institution");
  }
  return facility;
}

// POST /facilities/:id/holidays — add a holiday
facilitiesRouter.post(
  "/:id/holidays",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "LAB_MANAGER"),
  async (req, res) => {
    const u = currentUser(req);
    await assertFacilityInTenant(req.params.id, u);
    const body = holidaySchema.parse(req.body);
    const holiday = await prisma.holiday.create({
      data: { facilityId: req.params.id, date: new Date(body.date), name: body.name },
    });
    await prisma.auditLog.create({
      data: { userId: u.id, action: "create", entity: "Holiday", entityId: holiday.id },
    });
    res.status(201).json(holiday);
  }
);

// DELETE /facilities/:id/holidays/:hid — remove a holiday
facilitiesRouter.delete(
  "/:id/holidays/:hid",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "LAB_MANAGER"),
  async (req, res) => {
    const u = currentUser(req);
    await assertFacilityInTenant(req.params.id, u);
    const holiday = await prisma.holiday.findUnique({ where: { id: req.params.hid } });
    if (!holiday || holiday.facilityId !== req.params.id) throw new AppError(404, "Holiday not found");
    await prisma.holiday.delete({ where: { id: holiday.id } });
    await prisma.auditLog.create({
      data: { userId: u.id, action: "delete", entity: "Holiday", entityId: holiday.id },
    });
    res.status(204).end();
  }
);

// DELETE /facilities/:id — INSTITUTION_ADMIN
facilitiesRouter.delete(
  "/:id",
  requireAuth,
  requireRole("INSTITUTION_ADMIN"),
  async (req, res) => {
    const u = currentUser(req);
    const facility = await prisma.facility.findUnique({ where: { id: req.params.id } });
    if (!facility) throw new AppError(404, "Facility not found");
    if (u.role !== "SUPER_ADMIN" && facility.institutionId !== u.institutionId) {
      throw new AppError(403, "Cannot delete another institution's facility");
    }
    await prisma.facility.delete({ where: { id: facility.id } });
    await prisma.auditLog.create({
      data: { userId: u.id, action: "delete", entity: "Facility", entityId: facility.id },
    });
    res.status(204).end();
  }
);
