import { Router } from "express";
import { prisma } from "../db";
import { AppError } from "../http";
import { requireAuth, requireRole, currentUser } from "../middleware/auth";

export const analyticsRouter = Router();

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// GET /analytics/summary — admin roles, scoped to institution
analyticsRouter.get(
  "/summary",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "LAB_MANAGER", "OPERATOR"),
  async (req, res) => {
    const u = currentUser(req);
    let institutionId: string | undefined;
    if (u.role === "SUPER_ADMIN") {
      institutionId = typeof req.query.institutionId === "string" ? req.query.institutionId : undefined;
    } else {
      if (!u.institutionId) throw new AppError(403, "User is not associated with an institution");
      institutionId = u.institutionId;
    }
    const instFilter = institutionId ? { institutionId } : {};

    // Revenue = sum of PAID invoices
    const revenueAgg = await prisma.invoice.aggregate({
      where: { status: "PAID", ...instFilter },
      _sum: { total: true },
      _count: { _all: true },
    });
    const revenue = revenueAgg._sum.total ?? 0;

    // Orders by status
    const ordersGrouped = await prisma.serviceOrder.groupBy({
      by: ["status"],
      where: instFilter,
      _count: { _all: true },
    });
    const ordersByStatus = ordersGrouped.map((g) => ({ status: g.status, count: g._count._all }));
    const totalOrders = ordersByStatus.reduce((s, o) => s + o.count, 0);

    // Revenue by month (last 6 months) from PAID invoices
    const since = new Date();
    since.setMonth(since.getMonth() - 5);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
    const paidInvoices = await prisma.invoice.findMany({
      where: { status: "PAID", issuedAt: { gte: since }, ...instFilter },
      select: { total: true, issuedAt: true },
    });
    const monthMap = new Map<string, number>();
    for (let i = 0; i < 6; i++) {
      const d = new Date(since);
      d.setMonth(since.getMonth() + i);
      monthMap.set(monthKey(d), 0);
    }
    for (const inv of paidInvoices) {
      const k = monthKey(inv.issuedAt);
      if (monthMap.has(k)) monthMap.set(k, (monthMap.get(k) ?? 0) + inv.total);
    }
    const revenueByMonth = Array.from(monthMap.entries()).map(([month, total]) => ({ month, revenue: total }));

    // Utilization: approved+completed booked hours vs available instrument-hours over trailing 30 days
    const instrumentWhere: any = institutionId ? { facility: { institutionId } } : {};
    const instrumentCount = await prisma.instrument.count({ where: instrumentWhere });
    const windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const utilBookings = await prisma.booking.findMany({
      where: {
        status: { in: ["APPROVED", "COMPLETED"] },
        startAt: { gte: windowStart },
        ...(institutionId ? { instrument: { facility: { institutionId } } } : {}),
      },
      select: { startAt: true, endAt: true },
    });
    let bookedMs = 0;
    for (const b of utilBookings) bookedMs += b.endAt.getTime() - b.startAt.getTime();
    const bookedHours = bookedMs / (1000 * 60 * 60);
    // Assume ~8 usable hours/day per instrument over 30 days.
    const capacityHours = instrumentCount * 8 * 30;
    const utilizationPct = capacityHours > 0 ? Math.min(100, Math.round((bookedHours / capacityHours) * 10000) / 100) : 0;

    // Top services by order count + revenue
    const topGrouped = await prisma.serviceOrder.groupBy({
      by: ["serviceId"],
      where: instFilter,
      _count: { _all: true },
    });
    topGrouped.sort((a, b) => b._count._all - a._count._all);
    const topServiceIds = topGrouped.slice(0, 5).map((g) => g.serviceId);
    const topServiceRecords = await prisma.service.findMany({
      where: { id: { in: topServiceIds } },
      select: { id: true, name: true, category: true },
    });
    const nameById = new Map(topServiceRecords.map((s) => [s.id, s]));
    // revenue per service = sum of PAID invoice totals for that service's orders
    const paidByService = await prisma.invoice.groupBy({
      by: ["orderId"],
      where: { status: "PAID", ...instFilter },
      _sum: { total: true },
    });
    // map orderId -> serviceId
    const orderIds = paidByService.map((p) => p.orderId);
    const orderServiceMap = new Map<string, string>();
    if (orderIds.length) {
      const ords = await prisma.serviceOrder.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, serviceId: true },
      });
      for (const o of ords) orderServiceMap.set(o.id, o.serviceId);
    }
    const revenueByServiceId = new Map<string, number>();
    for (const row of paidByService) {
      const sid = orderServiceMap.get(row.orderId);
      if (sid) revenueByServiceId.set(sid, (revenueByServiceId.get(sid) ?? 0) + (row._sum.total ?? 0));
    }
    const topServices = topGrouped.slice(0, 5).map((g) => ({
      serviceId: g.serviceId,
      name: nameById.get(g.serviceId)?.name ?? "Unknown",
      category: nameById.get(g.serviceId)?.category ?? "",
      orders: g._count._all,
      revenue: revenueByServiceId.get(g.serviceId) ?? 0,
    }));

    // Pending settlements value (scoped)
    const settlementAgg = await prisma.settlement.aggregate({
      where: {
        status: "PENDING",
        ...(institutionId ? { order: { institutionId } } : {}),
      },
      _sum: { netToProvider: true },
    });

    res.json({
      revenue,
      paidInvoiceCount: revenueAgg._count._all,
      totalOrders,
      ordersByStatus,
      revenueByMonth,
      utilizationPct,
      instrumentCount,
      topServices,
      pendingSettlementValue: settlementAgg._sum.netToProvider ?? 0,
    });
  }
);

// GET /analytics/platform — SUPER_ADMIN: network-wide totals + settlements + institution leaderboard
analyticsRouter.get("/platform", requireAuth, requireRole(), async (req, res) => {
  const u = currentUser(req);
  if (u.role !== "SUPER_ADMIN") throw new AppError(403, "Platform admins only");

  const [institutionCount, userCount, orderCount, serviceCount, buyerCount] = await Promise.all([
    prisma.institution.count(),
    prisma.user.count(),
    prisma.serviceOrder.count(),
    prisma.service.count(),
    prisma.user.count({ where: { role: "INDUSTRY_BUYER" } }),
  ]);

  // Active (in-flight) orders across the network.
  const activeOrders = await prisma.serviceOrder.count({
    where: {
      status: { in: ["QUOTE_REQUESTED", "QUOTED", "ACCEPTED", "NDA_PENDING", "SAMPLE_AWAITED", "IN_PROGRESS", "REPORT_READY"] },
    },
  });

  // Orders by status (network-wide).
  const ordersGrouped = await prisma.serviceOrder.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const ordersByStatus = ordersGrouped.map((g) => ({ status: g.status, count: g._count._all }));

  // Revenue by month (last 6 months) from PAID invoices (network-wide).
  const since = new Date();
  since.setMonth(since.getMonth() - 5);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  const paidInvoices = await prisma.invoice.findMany({
    where: { status: "PAID", issuedAt: { gte: since } },
    select: { total: true, issuedAt: true },
  });
  const monthMap = new Map<string, number>();
  for (let i = 0; i < 6; i++) {
    const d = new Date(since);
    d.setMonth(since.getMonth() + i);
    monthMap.set(monthKey(d), 0);
  }
  for (const inv of paidInvoices) {
    const k = monthKey(inv.issuedAt);
    if (monthMap.has(k)) monthMap.set(k, (monthMap.get(k) ?? 0) + inv.total);
  }
  const revenueByMonth = Array.from(monthMap.entries()).map(([month, revenue]) => ({ month, revenue }));

  const grossAgg = await prisma.invoice.aggregate({
    where: { status: "PAID" },
    _sum: { total: true },
  });
  const settlementAgg = await prisma.settlement.aggregate({
    _sum: { platformFee: true, netToProvider: true, grossAmount: true },
  });
  const releasedAgg = await prisma.settlement.aggregate({
    where: { status: "RELEASED" },
    _sum: { platformFee: true },
  });
  const pendingAgg = await prisma.settlement.aggregate({
    where: { status: "PENDING" },
    _sum: { platformFee: true, netToProvider: true },
  });

  // Institution leaderboard by PAID invoice revenue
  const invoiceByInst = await prisma.invoice.groupBy({
    by: ["institutionId"],
    where: { status: "PAID" },
    _sum: { total: true },
    _count: { _all: true },
  });
  invoiceByInst.sort((a, b) => (b._sum.total ?? 0) - (a._sum.total ?? 0));
  const instIds = invoiceByInst.map((r) => r.institutionId);
  const instRecords = await prisma.institution.findMany({
    where: { id: { in: instIds } },
    select: { id: true, name: true, slug: true },
  });
  const instById = new Map(instRecords.map((i) => [i.id, i]));

  // Order counts per leaderboard institution.
  const orderCountsByInst = instIds.length
    ? await prisma.serviceOrder.groupBy({
        by: ["institutionId"],
        where: { institutionId: { in: instIds } },
        _count: { _all: true },
      })
    : [];
  const ordersByInst = new Map(orderCountsByInst.map((r) => [r.institutionId, r._count._all]));

  const leaderboard = invoiceByInst.map((r) => ({
    id: r.institutionId,
    institutionId: r.institutionId,
    name: instById.get(r.institutionId)?.name ?? "Unknown",
    slug: instById.get(r.institutionId)?.slug ?? "",
    revenue: r._sum.total ?? 0,
    orders: ordersByInst.get(r.institutionId) ?? 0,
    paidInvoices: r._count._all,
  }));

  res.json({
    // Flat fields consumed by the platform Dashboard.
    totalInstitutions: institutionCount,
    totalServices: serviceCount,
    totalOrders: orderCount,
    totalBuyers: buyerCount,
    activeOrders,
    totalRevenue: grossAgg._sum.total ?? 0,
    platformFees: settlementAgg._sum.platformFee ?? 0,
    ordersByStatus,
    revenueByMonth,
    // Grouped fields retained for other consumers.
    totals: {
      institutions: institutionCount,
      users: userCount,
      buyers: buyerCount,
      orders: orderCount,
      services: serviceCount,
      grossRevenue: grossAgg._sum.total ?? 0,
    },
    settlements: {
      grossAmount: settlementAgg._sum.grossAmount ?? 0,
      platformFee: settlementAgg._sum.platformFee ?? 0,
      netToProvider: settlementAgg._sum.netToProvider ?? 0,
      releasedPlatformFee: releasedAgg._sum.platformFee ?? 0,
      pendingPlatformFee: pendingAgg._sum.platformFee ?? 0,
      pendingNetToProvider: pendingAgg._sum.netToProvider ?? 0,
    },
    leaderboard,
  });
});
