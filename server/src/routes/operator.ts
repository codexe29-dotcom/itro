import { Router } from "express";
import { prisma } from "../db";
import { AppError } from "../http";
import { requireAuth, requireRole, currentUser } from "../middleware/auth";
import { secureOrderFileUrls } from "../controllers/orderDocuments";

export const operatorRouter = Router();

// GET /operator/queue — OPERATOR, LAB_MANAGER: orders in SAMPLE_AWAITED/IN_PROGRESS + today's approved bookings
operatorRouter.get(
  "/queue",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "OPERATOR", "LAB_MANAGER"),
  async (req, res) => {
    const u = currentUser(req);
    const orderWhere: any = { status: { in: ["SAMPLE_AWAITED", "IN_PROGRESS"] } };
    const bookingWhere: any = { status: "APPROVED" };

    if (u.role !== "SUPER_ADMIN") {
      if (!u.institutionId) throw new AppError(403, "User is not associated with an institution");
      orderWhere.institutionId = u.institutionId;
      bookingWhere.instrument = { facility: { institutionId: u.institutionId } };
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    bookingWhere.startAt = { gte: start, lt: end };

    const [orders, bookings] = await Promise.all([
      prisma.serviceOrder.findMany({
        where: orderWhere,
        orderBy: { dueAt: "asc" },
        include: {
          service: { select: { id: true, name: true, category: true } },
          buyer: { select: { id: true, name: true, orgName: true } },
        },
      }),
      prisma.booking.findMany({
        where: bookingWhere,
        orderBy: { startAt: "asc" },
        include: {
          instrument: { select: { id: true, name: true, category: true } },
          user: { select: { id: true, name: true } },
        },
      }),
    ]);

    res.json({ orders: orders.map(secureOrderFileUrls), bookings });
  }
);
