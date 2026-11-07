import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { AppError, paginate, pageResult, strParam } from "../http";
import { requireAuth, requireRole, currentUser, type AuthUser } from "../middleware/auth";
import { createRazorpayOrder, verifyRazorpaySignature, razorpayConfigured } from "../lib/payments";
import { notify } from "../lib/integrations";

export const bookingsRouter = Router();

// Overlapping usage against the shared capacity pool for a time window.
async function usedCapacity(instrumentId: string, startAt: Date, endAt: Date): Promise<number> {
  const [overlapBookings, overlapReservations] = await Promise.all([
    prisma.booking.count({
      where: {
        instrumentId,
        status: { in: ["APPROVED", "PENDING"] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    }),
    prisma.capacityReservation.count({
      where: {
        instrumentId,
        status: "HELD",
        bookingId: null, // booking-linked reservations already counted above
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    }),
  ]);
  return overlapBookings + overlapReservations;
}

function isAdminRole(role: string): boolean {
  return role === "INSTITUTION_ADMIN" || role === "LAB_MANAGER" || role === "OPERATOR" || role === "SUPER_ADMIN";
}

// GET /bookings — admin roles see institution's; faculty/researcher see own
bookingsRouter.get("/", requireAuth, async (req, res) => {
  const u = currentUser(req);
  const p = paginate(req.query);
  const where: any = {};

  if (u.role === "SUPER_ADMIN") {
    // no scope
  } else if (isAdminRole(u.role)) {
    if (!u.institutionId) throw new AppError(403, "User is not associated with an institution");
    where.instrument = { facility: { institutionId: u.institutionId } };
  } else {
    where.userId = u.id;
  }

  const instrumentId = strParam(req.query, "instrumentId");
  const status = strParam(req.query, "status");
  if (instrumentId) where.instrumentId = instrumentId;
  if (status) where.status = status;

  const [data, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { startAt: "desc" },
      skip: p.skip,
      take: p.take,
      include: {
        instrument: { select: { id: true, name: true, category: true, facilityId: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.booking.count({ where }),
  ]);
  res.json(pageResult(data, total, p));
});

const createSchema = z.object({
  instrumentId: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  purpose: z.string().optional(),
});

// POST /bookings — FACULTY, RESEARCHER, LAB_MANAGER; checks training + conflict
bookingsRouter.post(
  "/",
  requireAuth,
  requireRole("FACULTY", "RESEARCHER", "LAB_MANAGER"),
  async (req, res) => {
    const u = currentUser(req);
    const body = createSchema.parse(req.body);
    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);
    if (endAt <= startAt) throw new AppError(400, "endAt must be after startAt");

    const instrument = await prisma.instrument.findUnique({
      where: { id: body.instrumentId },
      include: { facility: true },
    });
    if (!instrument) throw new AppError(404, "Instrument not found");
    if (u.role !== "SUPER_ADMIN" && instrument.facility.institutionId !== u.institutionId) {
      throw new AppError(403, "Instrument belongs to another institution");
    }

    // Training gating
    if (instrument.trainingRequired) {
      const training = await prisma.training.findUnique({
        where: { userId_instrumentId: { userId: u.id, instrumentId: instrument.id } },
      });
      if (!training) {
        throw new AppError(403, "Training required for this instrument");
      }
    }

    // Capacity check against the shared pool: overlapping APPROVED/PENDING bookings
    // + HELD time-slot reservations must stay under the instrument's concurrency.
    const [overlapBookings, overlapReservations] = await Promise.all([
      prisma.booking.count({
        where: {
          instrumentId: instrument.id,
          status: { in: ["APPROVED", "PENDING"] },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
      }),
      prisma.capacityReservation.count({
        where: {
          instrumentId: instrument.id,
          status: "HELD",
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
      }),
    ]);
    const used = overlapBookings + overlapReservations;
    if (used >= Math.max(1, instrument.concurrency)) {
      throw new AppError(409, "No remaining capacity for this time window");
    }

    const booking = await prisma.booking.create({
      data: {
        instrumentId: instrument.id,
        userId: u.id,
        startAt,
        endAt,
        purpose: body.purpose,
        status: "PENDING",
      },
    });
    // Draw from the same capacity pool as orders via a HELD reservation.
    await prisma.capacityReservation.create({
      data: {
        instrumentId: instrument.id,
        bookingId: booking.id,
        startAt,
        endAt,
        units: 1,
        status: "HELD",
      },
    });
    await prisma.auditLog.create({
      data: { userId: u.id, action: "create", entity: "Booking", entityId: booking.id },
    });
    res.status(201).json(booking);
  }
);

async function loadBookingInInstitution(id: string, u: AuthUser) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { instrument: { include: { facility: true } } },
  });
  if (!booking) throw new AppError(404, "Booking not found");
  if (u.role !== "SUPER_ADMIN" && booking.instrument.facility.institutionId !== u.institutionId) {
    throw new AppError(403, "Booking belongs to another institution");
  }
  return booking;
}

// POST /bookings/:id/approve — LAB_MANAGER, OPERATOR
bookingsRouter.post(
  "/:id/approve",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "LAB_MANAGER", "OPERATOR"),
  async (req, res) => {
    const u = currentUser(req);
    const booking = await loadBookingInInstitution(req.params.id, u);
    if (booking.status !== "PENDING") throw new AppError(409, `Cannot approve a ${booking.status} booking`);
    const updated = await prisma.booking.update({ where: { id: booking.id }, data: { status: "APPROVED" } });
    await prisma.auditLog.create({
      data: { userId: u.id, action: "approve", entity: "Booking", entityId: booking.id },
    });
    res.json(updated);
  }
);

// POST /bookings/:id/reject — LAB_MANAGER, OPERATOR
bookingsRouter.post(
  "/:id/reject",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "LAB_MANAGER", "OPERATOR"),
  async (req, res) => {
    const u = currentUser(req);
    const booking = await loadBookingInInstitution(req.params.id, u);
    if (booking.status !== "PENDING") throw new AppError(409, `Cannot reject a ${booking.status} booking`);
    const updated = await prisma.booking.update({ where: { id: booking.id }, data: { status: "REJECTED" } });
    await prisma.capacityReservation.updateMany({ where: { bookingId: booking.id, status: "HELD" }, data: { status: "RELEASED" } });
    await prisma.auditLog.create({
      data: { userId: u.id, action: "reject", entity: "Booking", entityId: booking.id },
    });
    res.json(updated);
  }
);

// POST /bookings/:id/cancel — owner
bookingsRouter.post("/:id/cancel", requireAuth, async (req, res) => {
  const u = currentUser(req);
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking) throw new AppError(404, "Booking not found");
  if (u.role !== "SUPER_ADMIN" && booking.userId !== u.id) {
    throw new AppError(403, "Only the owner can cancel this booking");
  }
  if (["CANCELLED", "COMPLETED", "REJECTED"].includes(booking.status)) {
    throw new AppError(409, `Cannot cancel a ${booking.status} booking`);
  }
  const updated = await prisma.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
  await prisma.capacityReservation.updateMany({ where: { bookingId: booking.id, status: "HELD" }, data: { status: "RELEASED" } });
  await prisma.auditLog.create({
    data: { userId: u.id, action: "cancel", entity: "Booking", entityId: booking.id },
  });
  res.json(updated);
});

// ------------------------------------------------------------------
// Self-serve, paid machine booking (industry buyers)
// ------------------------------------------------------------------
const checkoutSchema = z.object({
  instrumentId: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  purpose: z.string().max(500).optional(),
  contactName: z.string().max(120).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(30).optional(),
});

// POST /bookings/checkout — industry buyer books a machine time window and (if the
// gateway is configured) pays online instantly. Returns a Razorpay order to open in
// the client, or a confirmed request-to-book when no gateway is configured.
bookingsRouter.post("/checkout", requireAuth, requireRole("INDUSTRY_BUYER"), async (req, res) => {
  const u = currentUser(req);
  const body = checkoutSchema.parse(req.body);
  const startAt = new Date(body.startAt);
  const endAt = new Date(body.endAt);
  if (endAt <= startAt) throw new AppError(400, "End time must be after start time");
  if (startAt.getTime() < Date.now() - 60_000) throw new AppError(400, "Start time must be in the future");

  const instrument = await prisma.instrument.findUnique({
    where: { id: body.instrumentId },
    include: { facility: { include: { institution: { select: { name: true, currency: true } } } } },
  });
  if (!instrument) throw new AppError(404, "Machine not found");
  if (instrument.status !== "AVAILABLE") throw new AppError(409, `This machine is currently ${instrument.status.toLowerCase()} and cannot be booked online`);
  if (!(instrument.hourlyRate > 0)) throw new AppError(409, "This machine has no online booking rate. Request a service quote instead.");

  // Capacity check against the shared pool.
  const used = await usedCapacity(instrument.id, startAt, endAt);
  if (used >= Math.max(1, instrument.concurrency)) throw new AppError(409, "That time window is fully booked. Pick another slot.");

  const hours = (endAt.getTime() - startAt.getTime()) / 3_600_000;
  const amount = Math.round(instrument.hourlyRate * hours * 100) / 100;
  const currency = instrument.facility.institution?.currency || "INR";
  const gateway = await razorpayConfigured();

  const booking = await prisma.booking.create({
    data: {
      instrumentId: instrument.id,
      userId: u.id,
      startAt,
      endAt,
      purpose: body.purpose,
      status: "PENDING",
      amount,
      currency,
      paymentStatus: gateway ? "PENDING" : "NONE",
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
    },
  });
  // Hold the slot immediately so it isn't double-sold during payment.
  await prisma.capacityReservation.create({
    data: { instrumentId: instrument.id, bookingId: booking.id, startAt, endAt, units: 1, status: "HELD" },
  });
  await prisma.auditLog.create({ data: { userId: u.id, action: "checkout", entity: "Booking", entityId: booking.id } });

  if (!gateway) {
    // No online gateway configured — leave as a pending request the lab confirms.
    return res.status(201).json({ bookingId: booking.id, needsPayment: false, amount, currency });
  }

  const rp = await createRazorpayOrder(Math.round(amount * 100), currency, `bk_${booking.id.slice(-12)}`);
  await prisma.booking.update({ where: { id: booking.id }, data: { paymentOrderId: rp.orderId } });
  res.status(201).json({ bookingId: booking.id, needsPayment: true, amount, currency, razorpay: rp });
});

// POST /bookings/:id/pay/verify — verify the gateway signature and confirm the booking.
bookingsRouter.post("/:id/pay/verify", requireAuth, requireRole("INDUSTRY_BUYER"), async (req, res) => {
  const u = currentUser(req);
  const b = z.object({
    razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string(),
  }).parse(req.body);

  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: { instrument: { include: { facility: { include: { institution: { select: { name: true } } } } } } },
  });
  if (!booking) throw new AppError(404, "Booking not found");
  if (booking.userId !== u.id) throw new AppError(403, "Not your booking");
  if (booking.paymentStatus === "PAID") return res.json({ ok: true, alreadyPaid: true });
  if (booking.paymentOrderId && booking.paymentOrderId !== b.razorpay_order_id) throw new AppError(400, "Payment order mismatch");

  const ok = await verifyRazorpaySignature(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature);
  if (!ok) throw new AppError(400, "Payment verification failed");

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "APPROVED", paymentStatus: "PAID", paymentRef: b.razorpay_payment_id },
  });
  await prisma.auditLog.create({ data: { userId: u.id, action: "pay-razorpay", entity: "Booking", entityId: booking.id, meta: { payment: b.razorpay_payment_id } } });

  // Notify the buyer and the facility.
  const buyer = await prisma.user.findUnique({ where: { id: u.id }, select: { email: true, phone: true, name: true } });
  const when = booking.startAt.toISOString().slice(0, 16).replace("T", " ");
  await notify({
    email: buyer?.email, phone: buyer?.phone,
    subject: `Booking confirmed — ${booking.instrument.name}`,
    message: `Hi ${buyer?.name ?? "there"}, your booking of ${booking.instrument.name} at ${booking.instrument.facility.institution?.name ?? "the facility"} for ${when} is confirmed. — ITRO`,
  });
  const facilityEmail = booking.instrument.facility.contactEmail;
  if (facilityEmail) {
    await notify({
      email: facilityEmail,
      subject: `New machine booking — ${booking.instrument.name}`,
      message: `A paid booking of ${booking.instrument.name} for ${when} has been confirmed via ITRO.`,
    });
  }
  res.json({ ok: true, booking: updated });
});
