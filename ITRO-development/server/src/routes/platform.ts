import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { AppError, paginate, pageResult, strParam } from "../http";
import { requireAuth, requireRole, currentUser } from "../middleware/auth";
import { getGlobalSetting } from "../lib/pricing";
import { hashPassword } from "../lib/tokens";
import { quotePackage } from "../lib/routing";
import { getIntegrationConfig } from "../lib/integrations";

export const platformRouter = Router();

/** Every platform endpoint is SUPER_ADMIN-only. */
platformRouter.use(requireAuth, requireRole());
platformRouter.use((req, _res, next) => {
  const u = currentUser(req);
  if (u.role !== "SUPER_ADMIN") throw new AppError(403, "Platform admins only");
  next();
});

// ------------------------------------------------------------------
// Platform fee configuration (singleton "global" PlatformSetting)
// ------------------------------------------------------------------

// GET /platform/fee-config — the global platform-fee setting
platformRouter.get("/fee-config", async (_req, res) => {
  const setting = await getGlobalSetting();
  res.json(setting);
});

// ------------------------------------------------------------------
// Integrations config (payment gateway + notifications)
// Secrets are never returned; the UI only sees whether they are set.
// ------------------------------------------------------------------
platformRouter.get("/integrations", async (_req, res) => {
  const c = await getIntegrationConfig();
  res.json({
    razorpayEnabled: c.razorpayEnabled, razorpayKeyId: c.razorpayKeyId ?? "", hasRazorpaySecret: !!c.razorpayKeySecret,
    emailEnabled: c.emailEnabled, smtpHost: c.smtpHost ?? "", smtpPort: c.smtpPort ?? 587, smtpUser: c.smtpUser ?? "", emailFrom: c.emailFrom ?? "", hasSmtpPass: !!c.smtpPass,
    whatsappEnabled: c.whatsappEnabled, twilioSid: c.twilioSid ?? "", twilioFrom: c.twilioFrom ?? "", hasTwilioToken: !!c.twilioToken,
  });
});

const integrationsSchema = z.object({
  razorpayEnabled: z.boolean().optional(),
  razorpayKeyId: z.string().optional(),
  razorpayKeySecret: z.string().optional(),
  emailEnabled: z.boolean().optional(),
  smtpHost: z.string().optional(), smtpPort: z.number().int().optional().nullable(), smtpUser: z.string().optional(), smtpPass: z.string().optional(), emailFrom: z.string().optional(),
  whatsappEnabled: z.boolean().optional(),
  twilioSid: z.string().optional(), twilioToken: z.string().optional(), twilioFrom: z.string().optional(),
});
platformRouter.patch("/integrations", async (req, res) => {
  const u = currentUser(req);
  const b = integrationsSchema.parse(req.body);
  const data: Record<string, unknown> = {};
  const nonSecret: (keyof typeof b)[] = ["razorpayEnabled", "razorpayKeyId", "emailEnabled", "smtpHost", "smtpPort", "smtpUser", "emailFrom", "whatsappEnabled", "twilioSid", "twilioFrom"];
  for (const k of nonSecret) if (b[k] !== undefined) data[k] = b[k] === "" ? null : b[k];
  // Secrets: only overwrite when a non-empty value is provided (blank keeps the stored value).
  if (b.razorpayKeySecret) data.razorpayKeySecret = b.razorpayKeySecret;
  if (b.smtpPass) data.smtpPass = b.smtpPass;
  if (b.twilioToken) data.twilioToken = b.twilioToken;
  await prisma.platformSetting.upsert({ where: { id: "global" }, update: data, create: { id: "global", ...data } });
  await prisma.auditLog.create({ data: { userId: u.id, action: "update", entity: "Integrations", entityId: "global" } });
  res.json({ ok: true });
});

const feeConfigSchema = z.object({
  feeMode: z.enum(["MARKUP_PERCENT", "FIXED_FEE", "SETTLEMENT_DEDUCTION"]),
  feeValue: z.number().nonnegative(),
});

// PATCH /platform/fee-config — update the global platform fee (SUPER_ADMIN)
platformRouter.patch("/fee-config", async (req, res) => {
  const u = currentUser(req);
  const body = feeConfigSchema.parse(req.body);
  const setting = await prisma.platformSetting.upsert({
    where: { id: "global" },
    update: { feeMode: body.feeMode, feeValue: body.feeValue },
    create: { id: "global", feeMode: body.feeMode, feeValue: body.feeValue },
  });
  await prisma.auditLog.create({
    data: { userId: u.id, action: "update", entity: "PlatformSetting", entityId: "global", meta: body },
  });
  res.json(setting);
});

// ------------------------------------------------------------------
// Providers (institutions) — aggregate list + Provider 360
// ------------------------------------------------------------------

// GET /platform/providers — every institution with counts, revenue, avg rating
platformRouter.get("/providers", async (req, res) => {
  const q = strParam(req.query, "q");
  const where: any = q ? { name: { contains: q, mode: "insensitive" } } : {};

  const institutions = await prisma.institution.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { facilities: true, services: true, orders: true },
      },
    },
  });

  const ids = institutions.map((i) => i.id);

  // Instrument counts per institution (instruments live under facilities).
  const instrumentRows = ids.length
    ? await prisma.instrument.groupBy({
        by: ["facilityId"],
        where: { facility: { institutionId: { in: ids } } },
        _count: { _all: true },
      })
    : [];
  const facilities = ids.length
    ? await prisma.facility.findMany({
        where: { institutionId: { in: ids } },
        select: { id: true, institutionId: true },
      })
    : [];
  const facilityToInst = new Map(facilities.map((f) => [f.id, f.institutionId]));
  const instrumentsByInst = new Map<string, number>();
  for (const row of instrumentRows) {
    const instId = facilityToInst.get(row.facilityId);
    if (instId) instrumentsByInst.set(instId, (instrumentsByInst.get(instId) ?? 0) + row._count._all);
  }

  // Revenue = sum of PAID invoices per institution.
  const revenueRows = ids.length
    ? await prisma.invoice.groupBy({
        by: ["institutionId"],
        where: { status: "PAID", institutionId: { in: ids } },
        _sum: { total: true },
      })
    : [];
  const revenueByInst = new Map(revenueRows.map((r) => [r.institutionId, r._sum.total ?? 0]));

  // Avg rating per institution (reviews are attached via order -> institution).
  const reviewRows = ids.length
    ? await prisma.review.findMany({
        where: { order: { institutionId: { in: ids } } },
        select: { rating: true, order: { select: { institutionId: true } } },
      })
    : [];
  const ratingAgg = new Map<string, { sum: number; count: number }>();
  for (const r of reviewRows) {
    const k = r.order.institutionId;
    const cur = ratingAgg.get(k) ?? { sum: 0, count: 0 };
    cur.sum += r.rating;
    cur.count += 1;
    ratingAgg.set(k, cur);
  }

  const data = institutions.map((inst) => {
    const agg = ratingAgg.get(inst.id);
    return {
      ...inst,
      counts: {
        facilities: inst._count.facilities,
        instruments: instrumentsByInst.get(inst.id) ?? 0,
        services: inst._count.services,
        orders: inst._count.orders,
      },
      revenue: revenueByInst.get(inst.id) ?? 0,
      avgRating: agg && agg.count > 0 ? Math.round((agg.sum / agg.count) * 10) / 10 : null,
      reviewCount: agg?.count ?? 0,
    };
  });

  res.json({ data });
});

// GET /platform/providers/:id — Provider 360
platformRouter.get("/providers/:id", async (req, res) => {
  const id = req.params.id;
  const inst = await prisma.institution.findUnique({
    where: { id },
    include: {
      facilities: { include: { instruments: true }, orderBy: { name: "asc" } },
      services: { include: { instrument: { select: { id: true, name: true } } }, orderBy: { name: "asc" } },
      users: {
        select: { id: true, name: true, email: true, role: true, phone: true, isActive: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      experts: { orderBy: { name: "asc" } },
    },
  });
  if (!inst) throw new AppError(404, "Provider not found");

  const [recentOrders, revenueAgg, pendingOrders, settlementAgg, pendingSettlementAgg, ratingRows] =
    await Promise.all([
      prisma.serviceOrder.findMany({
        where: { institutionId: id },
        orderBy: { createdAt: "desc" },
        take: 15,
        include: {
          service: { select: { id: true, name: true, category: true } },
          buyer: { select: { id: true, name: true, orgName: true } },
          invoice: { select: { id: true, status: true, total: true } },
        },
      }),
      prisma.invoice.aggregate({
        where: { status: "PAID", institutionId: id },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.serviceOrder.count({
        where: {
          institutionId: id,
          status: { in: ["QUOTE_REQUESTED", "QUOTED", "ACCEPTED", "NDA_PENDING", "SAMPLE_AWAITED", "IN_PROGRESS", "REPORT_READY"] },
        },
      }),
      prisma.settlement.aggregate({
        where: { order: { institutionId: id } },
        _sum: { grossAmount: true, platformFee: true, netToProvider: true },
        _count: { _all: true },
      }),
      prisma.settlement.aggregate({
        where: { order: { institutionId: id }, status: "PENDING" },
        _sum: { netToProvider: true },
        _count: { _all: true },
      }),
      prisma.review.findMany({
        where: { order: { institutionId: id } },
        select: { rating: true },
      }),
    ]);

  const totalOrders = await prisma.serviceOrder.count({ where: { institutionId: id } });
  const ratingCount = ratingRows.length;
  const avgRating = ratingCount > 0
    ? Math.round((ratingRows.reduce((s, r) => s + r.rating, 0) / ratingCount) * 10) / 10
    : null;

  const instrumentCount = inst.facilities.reduce((s, f) => s + f.instruments.length, 0);

  res.json({
    institution: {
      id: inst.id, name: inst.name, slug: inst.slug, type: inst.type,
      city: inst.city, state: inst.state, country: inst.country, about: inst.about,
      logoUrl: inst.logoUrl, themeColor: inst.themeColor, currency: inst.currency,
      taxRate: inst.taxRate, accreditations: inst.accreditations,
      isPublished: inst.isPublished, onExchange: inst.onExchange,
      feeMode: inst.feeMode, feeValue: inst.feeValue,
      createdAt: inst.createdAt, updatedAt: inst.updatedAt,
    },
    facilities: inst.facilities,
    services: inst.services,
    users: inst.users,
    experts: inst.experts,
    recentOrders,
    stats: {
      revenue: revenueAgg._sum.total ?? 0,
      paidInvoices: revenueAgg._count._all,
      totalOrders,
      pendingOrders,
      facilities: inst.facilities.length,
      instruments: instrumentCount,
      services: inst.services.length,
      users: inst.users.length,
      avgRating,
      reviewCount: ratingCount,
    },
    settlements: {
      count: settlementAgg._count._all,
      grossAmount: settlementAgg._sum.grossAmount ?? 0,
      platformFee: settlementAgg._sum.platformFee ?? 0,
      netToProvider: settlementAgg._sum.netToProvider ?? 0,
      pendingCount: pendingSettlementAgg._count._all,
      pendingNetToProvider: pendingSettlementAgg._sum.netToProvider ?? 0,
    },
  });
});

// POST /platform/providers/:id/users — platform admin creates a login for a provider
// (e.g. the first INSTITUTION_ADMIN so a platform-created provider can sign in).
const providerUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().transform((e) => e.trim().toLowerCase()),
  password: z.string().min(6),
  role: z.enum(["INSTITUTION_ADMIN", "LAB_MANAGER", "OPERATOR", "FACULTY", "RESEARCHER"]).default("INSTITUTION_ADMIN"),
  phone: z.string().optional(),
});
platformRouter.post("/providers/:id/users", async (req, res) => {
  const u = currentUser(req);
  const body = providerUserSchema.parse(req.body);
  const inst = await prisma.institution.findUnique({ where: { id: req.params.id } });
  if (!inst) throw new AppError(404, "Provider not found");
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) throw new AppError(409, "Email already registered");
  const user = await prisma.user.create({
    data: {
      name: body.name, email: body.email, role: body.role, phone: body.phone ?? null,
      passwordHash: await hashPassword(body.password), institutionId: inst.id,
    },
    select: { id: true, name: true, email: true, role: true, phone: true, isActive: true, createdAt: true },
  });
  await prisma.auditLog.create({ data: { userId: u.id, action: "create-provider-user", entity: "User", entityId: user.id, meta: { institutionId: inst.id } } });
  res.status(201).json(user);
});

// ------------------------------------------------------------------
// Buyers — aggregate list + Buyer 360
// ------------------------------------------------------------------

// GET /platform/buyers — every INDUSTRY_BUYER with order count + total spend
platformRouter.get("/buyers", async (req, res) => {
  const q = strParam(req.query, "q");
  const where: any = { role: "INDUSTRY_BUYER" };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { orgName: { contains: q, mode: "insensitive" } },
    ];
  }

  const buyers = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, email: true, orgName: true, phone: true,
      isActive: true, createdAt: true,
      _count: { select: { buyerOrders: true } },
    },
  });

  const ids = buyers.map((b) => b.id);
  // Total spend = sum of PAID invoices on their orders.
  const spendRows = ids.length
    ? await prisma.invoice.findMany({
        where: { status: "PAID", order: { buyerId: { in: ids } } },
        select: { total: true, order: { select: { buyerId: true } } },
      })
    : [];
  const spendByBuyer = new Map<string, number>();
  for (const row of spendRows) {
    const k = row.order.buyerId;
    spendByBuyer.set(k, (spendByBuyer.get(k) ?? 0) + row.total);
  }

  const data = buyers.map((b) => ({
    id: b.id, name: b.name, email: b.email, orgName: b.orgName, phone: b.phone,
    isActive: b.isActive, createdAt: b.createdAt,
    orderCount: b._count.buyerOrders,
    totalSpend: spendByBuyer.get(b.id) ?? 0,
  }));

  res.json({ data });
});

// GET /platform/buyers/:id — Buyer 360
platformRouter.get("/buyers/:id", async (req, res) => {
  const id = req.params.id;
  const buyer = await prisma.user.findFirst({
    where: { id, role: "INDUSTRY_BUYER" },
    select: {
      id: true, name: true, email: true, orgName: true, phone: true,
      isActive: true, institutionId: true, createdAt: true,
    },
  });
  if (!buyer) throw new AppError(404, "Buyer not found");

  const [orders, spendAgg, invoices] = await Promise.all([
    prisma.serviceOrder.findMany({
      where: { buyerId: id },
      orderBy: { createdAt: "desc" },
      include: {
        service: { select: { id: true, name: true, category: true } },
        institution: { select: { id: true, name: true, slug: true } },
        invoice: { select: { id: true, status: true, total: true, currency: true } },
      },
    }),
    prisma.invoice.aggregate({
      where: { status: "PAID", order: { buyerId: id } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.invoice.findMany({
      where: { order: { buyerId: id } },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true, number: true, status: true, total: true, currency: true, issuedAt: true,
        order: { select: { id: true, code: true } },
        institution: { select: { id: true, name: true } },
      },
    }),
  ]);

  const activeStatuses = ["QUOTE_REQUESTED", "QUOTED", "ACCEPTED", "NDA_PENDING", "SAMPLE_AWAITED", "IN_PROGRESS", "REPORT_READY"];
  const activeOrders = orders.filter((o) => activeStatuses.includes(o.status)).length;
  const completedOrders = orders.filter((o) => o.status === "COMPLETED").length;

  res.json({
    buyer,
    orders,
    invoices,
    stats: {
      totalOrders: orders.length,
      activeOrders,
      completedOrders,
      totalSpend: spendAgg._sum.total ?? 0,
      paidInvoices: spendAgg._count._all,
    },
  });
});

// ------------------------------------------------------------------
// Orders — platform-wide across every institution
// ------------------------------------------------------------------

const orderListInclude = {
  service: { select: { id: true, name: true, category: true } },
  institution: { select: { id: true, name: true, slug: true } },
  buyer: { select: { id: true, name: true, orgName: true, email: true } },
  invoice: { select: { id: true, status: true, total: true, currency: true } },
  settlement: { select: { id: true, status: true, netToProvider: true, platformFee: true } },
};

// GET /platform/orders — ALL orders, filterable + paginated
platformRouter.get("/orders", async (req, res) => {
  const p = paginate(req.query);
  const where: any = {};
  const status = strParam(req.query, "status");
  const institutionId = strParam(req.query, "institutionId");
  const buyerId = strParam(req.query, "buyerId");
  if (status) where.status = status;
  if (institutionId) where.institutionId = institutionId;
  if (buyerId) where.buyerId = buyerId;
  if (p.q) {
    where.OR = [
      { code: { contains: p.q, mode: "insensitive" } },
      { service: { name: { contains: p.q, mode: "insensitive" } } },
      { institution: { name: { contains: p.q, mode: "insensitive" } } },
      { buyer: { name: { contains: p.q, mode: "insensitive" } } },
      { buyer: { orgName: { contains: p.q, mode: "insensitive" } } },
    ];
  }

  const dir: "asc" | "desc" = strParam(req.query, "dir") === "asc" ? "asc" : "desc";
  const sortMap: Record<string, any> = {
    order: { code: dir },
    provider: { institution: { name: dir } },
    buyer: { buyer: { name: dir } },
    service: { service: { name: dir } },
    created: { createdAt: dir },
    status: { status: dir },
    amount: { quotedPrice: { sort: dir, nulls: "last" } },
  };
  const orderBy = sortMap[strParam(req.query, "sort") ?? ""] ?? { createdAt: "desc" };

  const [data, total] = await Promise.all([
    prisma.serviceOrder.findMany({
      where,
      orderBy,
      skip: p.skip,
      take: p.take,
      include: orderListInclude,
    }),
    prisma.serviceOrder.count({ where }),
  ]);

  res.json(pageResult(data, total, p));
});

// GET /platform/orders/:id — full order incl events timeline
platformRouter.get("/orders/:id", async (req, res) => {
  const order = await prisma.serviceOrder.findUnique({
    where: { id: req.params.id },
    include: {
      service: true,
      institution: true,
      buyer: { select: { id: true, name: true, email: true, orgName: true, phone: true } },
      events: { orderBy: { createdAt: "asc" } },
      invoice: { include: { payment: true } },
      settlement: true,
      review: true,
      documents: { orderBy: { createdAt: "asc" } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) throw new AppError(404, "Order not found");
  res.json(order);
});

// ------------------------------------------------------------------
// Test-catalog configuration (industries → tests → packages)
// ------------------------------------------------------------------
const kebab = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

async function uniquePackageSlug(base: string, excludeId?: string): Promise<string> {
  const root = kebab(base) || "package";
  let slug = root;
  for (let i = 2; i < 100; i++) {
    const existing = await prisma.testPackage.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

// GET /platform/catalog — everything needed to configure the catalog
platformRouter.get("/catalog", async (_req, res) => {
  const [industries, packages, services, technologies, instrumentCats] = await Promise.all([
    prisma.industry.findMany({
      orderBy: { order: "asc" },
      include: {
        tests: { orderBy: { order: "asc" }, select: { id: true, slug: true, name: true, category: true, providers: { select: { serviceId: true } } } },
        _count: { select: { tests: true, packages: true } },
      },
    }),
    prisma.testPackage.findMany({
      orderBy: { order: "asc" },
      include: {
        industry: { select: { slug: true, title: true } },
        items: { orderBy: { sequence: "asc" }, include: { test: { select: { id: true, name: true, slug: true } } } },
      },
    }),
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, category: true, priceIndustry: true, institution: { select: { name: true } } },
    }),
    prisma.technology.findMany({ orderBy: { order: "asc" } }),
    prisma.instrument.findMany({ distinct: ["category"], select: { category: true } }),
  ]);

  // Category options a technology can map to (union of instrument/service/test categories).
  const catSet = new Set<string>();
  for (const s of services) catSet.add(s.category);
  for (const c of instrumentCats) catSet.add(c.category);
  for (const i of industries) for (const t of i.tests) catSet.add(t.category);
  const categoryOptions = [...catSet].filter(Boolean).sort();

  res.json({
    industries: industries.map((i) => ({
      id: i.id, slug: i.slug, title: i.title,
      testCount: i._count.tests, packageCount: i._count.packages,
      tests: i.tests.map((t) => ({ id: t.id, slug: t.slug, name: t.name, category: t.category, providerCount: t.providers.length, providerServiceIds: t.providers.map((p) => p.serviceId) })),
    })),
    packages: packages.map((p) => ({
      id: p.id, slug: p.slug, name: p.name, summary: p.summary, description: p.description,
      pricingMode: p.pricingMode, fixedPrice: p.fixedPrice, discountPct: p.discountPct,
      accreditation: p.accreditation, isActive: p.isActive, sampleFlow: p.sampleFlow,
      industry: p.industry,
      testIds: p.items.map((it) => it.testId),
      tests: p.items.map((it) => ({ id: it.test.id, name: it.test.name, slug: it.test.slug, sequence: it.sequence, dependsOnTestId: it.dependsOnTestId })),
    })),
    technologies: technologies.map((t) => ({
      id: t.id, slug: t.slug, title: t.title, icon: t.icon, blurb: t.blurb,
      categories: t.categories, isActive: t.isActive,
    })),
    categoryOptions,
    services,
  });
});

const packageSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  industrySlug: z.string().optional(),
  summary: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  pricingMode: z.enum(["DYNAMIC", "FIXED"]).default("DYNAMIC"),
  fixedPrice: z.number().nonnegative().nullable().optional(),
  discountPct: z.number().min(0).max(100).default(0),
  accreditation: z.string().optional().nullable(),
  sampleFlow: z.enum(["SHARED", "PER_TEST"]).optional(),
  isActive: z.boolean().optional(),
  testIds: z.array(z.string()).default([]),
});

// Build ordered package items; for a SHARED-sample flow each test depends on the
// previous one (linear prerequisite chain). PER_TEST runs independently.
function buildPackageItems(testIds: string[], sampleFlow: string) {
  return testIds.map((testId, i) => ({
    testId,
    sequence: i,
    dependsOnTestId: sampleFlow === "SHARED" && i > 0 ? testIds[i - 1] : null,
  }));
}

// GET /platform/packages/:id — full package detail (config + sequenced items)
platformRouter.get("/packages/:id", async (req, res) => {
  const p = await prisma.testPackage.findUnique({
    where: { id: req.params.id },
    include: {
      industry: { select: { slug: true, title: true } },
      items: { orderBy: { sequence: "asc" }, include: { test: { select: { id: true, slug: true, name: true, category: true } } } },
    },
  });
  if (!p) throw new AppError(404, "Package not found");
  res.json({
    id: p.id, slug: p.slug, name: p.name, summary: p.summary, description: p.description,
    pricingMode: p.pricingMode, fixedPrice: p.fixedPrice, discountPct: p.discountPct,
    accreditation: p.accreditation, sampleFlow: p.sampleFlow, isActive: p.isActive,
    industry: p.industry, industrySlug: p.industry?.slug ?? null,
    testIds: p.items.map((it) => it.testId),
    items: p.items.map((it) => ({ testId: it.testId, sequence: it.sequence, optional: it.optional, dependsOnTestId: it.dependsOnTestId, test: it.test })),
  });
});

// GET /platform/packages/:id/insights — live routing & price preview
platformRouter.get("/packages/:id/insights", async (req, res) => {
  const p = await prisma.testPackage.findUnique({ where: { id: req.params.id }, select: { slug: true } });
  if (!p) throw new AppError(404, "Package not found");
  const quote = await quotePackage(p.slug, { strategy: "BALANCED" });
  res.json(quote ?? { items: [], bundlePrice: 0, gross: 0, savings: 0, discountPct: 0, currency: "INR", pricingMode: "DYNAMIC" });
});

// POST /platform/packages — create a package
platformRouter.post("/packages", async (req, res) => {
  const u = currentUser(req);
  const body = packageSchema.parse(req.body);
  const industry = body.industrySlug ? await prisma.industry.findUnique({ where: { slug: body.industrySlug } }) : null;
  const slug = await uniquePackageSlug(body.slug || body.name);
  const count = await prisma.testPackage.count();

  const pkg = await prisma.testPackage.create({
    data: {
      slug,
      name: body.name,
      industryId: industry?.id ?? null,
      summary: body.summary ?? null,
      description: body.description ?? null,
      pricingMode: body.pricingMode,
      fixedPrice: body.pricingMode === "FIXED" ? body.fixedPrice ?? null : null,
      discountPct: body.discountPct,
      accreditation: body.accreditation ?? null,
      sampleFlow: body.sampleFlow ?? "PER_TEST",
      order: count,
      items: { create: buildPackageItems(body.testIds, body.sampleFlow ?? "PER_TEST") },
    },
  });
  await prisma.auditLog.create({ data: { userId: u.id, action: "create", entity: "TestPackage", entityId: pkg.id } });
  res.status(201).json(pkg);
});

// PATCH /platform/packages/:id — update a package (replaces items if testIds given)
platformRouter.patch("/packages/:id", async (req, res) => {
  const u = currentUser(req);
  const body = packageSchema.partial().parse(req.body);
  const existing = await prisma.testPackage.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError(404, "Package not found");

  const industry = body.industrySlug !== undefined
    ? (body.industrySlug ? await prisma.industry.findUnique({ where: { slug: body.industrySlug } }) : null)
    : undefined;

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.slug !== undefined && body.slug) data.slug = await uniquePackageSlug(body.slug, existing.id);
  if (industry !== undefined) data.industryId = industry?.id ?? null;
  if (body.summary !== undefined) data.summary = body.summary;
  if (body.description !== undefined) data.description = body.description;
  if (body.pricingMode !== undefined) data.pricingMode = body.pricingMode;
  if (body.fixedPrice !== undefined) data.fixedPrice = body.fixedPrice;
  if (body.pricingMode === "DYNAMIC") data.fixedPrice = null;
  if (body.discountPct !== undefined) data.discountPct = body.discountPct;
  if (body.accreditation !== undefined) data.accreditation = body.accreditation;
  if (body.sampleFlow !== undefined) data.sampleFlow = body.sampleFlow;
  if (body.isActive !== undefined) data.isActive = body.isActive;

  if (body.testIds) {
    const flow = body.sampleFlow ?? existing.sampleFlow;
    await prisma.testPackageItem.deleteMany({ where: { packageId: existing.id } });
    data.items = { create: buildPackageItems(body.testIds, flow) };
  }

  const pkg = await prisma.testPackage.update({ where: { id: existing.id }, data });
  await prisma.auditLog.create({ data: { userId: u.id, action: "update", entity: "TestPackage", entityId: pkg.id } });
  res.json(pkg);
});

// DELETE /platform/packages/:id
platformRouter.delete("/packages/:id", async (req, res) => {
  const u = currentUser(req);
  const existing = await prisma.testPackage.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError(404, "Package not found");
  await prisma.testPackage.delete({ where: { id: existing.id } });
  await prisma.auditLog.create({ data: { userId: u.id, action: "delete", entity: "TestPackage", entityId: existing.id } });
  res.json({ ok: true });
});

// POST /platform/tests/:id/providers — attach a provider Service to a test
platformRouter.post("/tests/:id/providers", async (req, res) => {
  const u = currentUser(req);
  const { serviceId } = z.object({ serviceId: z.string().min(1) }).parse(req.body);
  const test = await prisma.testDefinition.findUnique({ where: { id: req.params.id } });
  if (!test) throw new AppError(404, "Test not found");
  const link = await prisma.testProvider.upsert({
    where: { testId_serviceId: { testId: test.id, serviceId } },
    update: {},
    create: { testId: test.id, serviceId },
  });
  await prisma.auditLog.create({ data: { userId: u.id, action: "attach-provider", entity: "TestDefinition", entityId: test.id, meta: { serviceId } } });
  res.status(201).json(link);
});

// DELETE /platform/tests/:testId/providers/:serviceId — detach a provider
platformRouter.delete("/tests/:testId/providers/:serviceId", async (req, res) => {
  const u = currentUser(req);
  await prisma.testProvider.deleteMany({ where: { testId: req.params.testId, serviceId: req.params.serviceId } });
  await prisma.auditLog.create({ data: { userId: u.id, action: "detach-provider", entity: "TestDefinition", entityId: req.params.testId, meta: { serviceId: req.params.serviceId } } });
  res.json({ ok: true });
});

// ---- Test create / edit / delete ----
async function uniqueTestSlug(base: string, excludeId?: string): Promise<string> {
  const root = kebab(base) || "test";
  let slug = root;
  for (let i = 2; i < 200; i++) {
    const existing = await prisma.testDefinition.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

const testSchema = z.object({
  name: z.string().min(1),
  industrySlug: z.string().min(1),
  category: z.string().min(1),
  summary: z.string().optional().nullable(),
  purpose: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  standardCodes: z.array(z.string()).default([]),
  sampleRequirements: z.string().optional().nullable(),
  samplesRequired: z.number().int().min(0).optional(),
  sampleDestructive: z.boolean().optional(),
  sampleReturned: z.boolean().optional(),
  deliverables: z.array(z.string()).optional(),
  conformanceRows: z.array(z.object({
    standard: z.string().optional().default(""),
    clause: z.string().optional().default(""),
    testNo: z.string().optional().default(""),
    condition: z.string().optional().default(""),
    severity: z.string().optional().default(""),
  })).optional(),
  fixturesRequired: z.array(z.string()).optional(),
  severityNotes: z.string().optional().nullable(),
  turnaroundDays: z.number().int().positive().default(7),
  accreditation: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  procedures: z.array(z.object({ title: z.string().min(1), detail: z.string().optional().nullable() })).optional(),
  forms: z.array(z.object({ name: z.string().min(1), description: z.string().optional().nullable(), required: z.boolean().optional() })).optional(),
  providerServiceIds: z.array(z.string()).optional(),
});

// GET /platform/tests/:id — full editable test
platformRouter.get("/tests/:id", async (req, res) => {
  const test = await prisma.testDefinition.findUnique({
    where: { id: req.params.id },
    include: {
      industry: { select: { slug: true } },
      procedures: { orderBy: { stepNo: "asc" } },
      forms: true,
      providers: { select: { serviceId: true } },
    },
  });
  if (!test) throw new AppError(404, "Test not found");
  res.json({
    id: test.id, slug: test.slug, name: test.name, category: test.category,
    industrySlug: test.industry.slug, summary: test.summary, purpose: test.purpose, description: test.description,
    standardCodes: test.standardCodes, sampleRequirements: test.sampleRequirements,
    samplesRequired: test.samplesRequired, sampleDestructive: test.sampleDestructive,
    sampleReturned: test.sampleReturned, deliverables: test.deliverables,
    conformanceRows: (test.conformanceRows ?? []) as unknown,
    fixturesRequired: test.fixturesRequired, severityNotes: test.severityNotes,
    turnaroundDays: test.turnaroundDays, accreditation: test.accreditation, isActive: test.isActive,
    procedures: test.procedures.map((p) => ({ title: p.title, detail: p.detail })),
    forms: test.forms.map((f) => ({ name: f.name, description: f.description, required: f.required })),
    providerServiceIds: test.providers.map((p) => p.serviceId),
  });
});

// GET /platform/tests/:id/insights — operational 360: demand, pricing, equipment, buyers, packages
platformRouter.get("/tests/:id/insights", async (req, res) => {
  const test = await prisma.testDefinition.findUnique({
    where: { id: req.params.id },
    include: {
      industry: { select: { slug: true, title: true } },
      providers: { include: {
        service: { select: {
          id: true, name: true, priceIndustry: true, turnaroundDays: true, pricingMode: true,
          institution: { select: { id: true, slug: true, name: true } },
          instrument: { select: { id: true, name: true, category: true } },
        } },
      } },
      packageItems: { include: { package: { select: { id: true, slug: true, name: true } } } },
    },
  });
  if (!test) throw new AppError(404, "Test not found");

  const serviceIds = test.providers.map((p) => p.serviceId);
  const [byStatus, recent] = await Promise.all([
    serviceIds.length ? prisma.serviceOrder.groupBy({ by: ["status"], where: { serviceId: { in: serviceIds } }, _count: { _all: true } }) : Promise.resolve([]),
    serviceIds.length ? prisma.serviceOrder.findMany({
      where: { serviceId: { in: serviceIds } },
      orderBy: { createdAt: "desc" }, take: 8,
      select: {
        id: true, code: true, status: true, quotedPrice: true, buyerAmount: true, createdAt: true,
        buyer: { select: { id: true, name: true, orgName: true } },
        institution: { select: { id: true, slug: true, name: true } },
        service: { select: { name: true } },
      },
    }) : Promise.resolve([]),
  ]);

  const counts: Record<string, number> = {};
  let total = 0, completed = 0, active = 0;
  const idleStatuses = ["DRAFT", "CANCELLED", "QUOTE_REJECTED"];
  for (const g of byStatus) {
    counts[g.status] = g._count._all; total += g._count._all;
    if (g.status === "COMPLETED") completed += g._count._all;
    else if (!idleStatuses.includes(g.status)) active += g._count._all;
  }

  const prices = test.providers.map((p) => p.priceOverride ?? p.service.priceIndustry).filter((n) => n > 0);
  const turns = test.providers.map((p) => p.service.turnaroundDays);

  res.json({
    industry: test.industry,
    providers: test.providers.map((p) => ({
      serviceId: p.serviceId, serviceName: p.service.name,
      price: p.priceOverride ?? p.service.priceIndustry,
      turnaroundDays: p.service.turnaroundDays, pricingMode: p.service.pricingMode,
      institution: p.service.institution, instrument: p.service.instrument,
    })),
    priceRange: prices.length ? { min: Math.min(...prices), max: Math.max(...prices), avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) } : null,
    turnaroundRange: turns.length ? { min: Math.min(...turns), max: Math.max(...turns) } : null,
    orders: { total, completed, active, byStatus: counts },
    recentOrders: recent.map((o) => ({
      id: o.id, code: o.code, status: o.status, amount: o.buyerAmount ?? o.quotedPrice, createdAt: o.createdAt,
      buyer: o.buyer, lab: o.institution, service: o.service.name,
    })),
    packages: test.packageItems.map((pi) => pi.package),
  });
});

// POST /platform/tests — create a test
platformRouter.post("/tests", async (req, res) => {
  const u = currentUser(req);
  const body = testSchema.parse(req.body);
  const industry = await prisma.industry.findUnique({ where: { slug: body.industrySlug } });
  if (!industry) throw new AppError(400, "Unknown industry");
  const slug = await uniqueTestSlug(`${industry.slug}-${body.name}`);
  const order = await prisma.testDefinition.count({ where: { industryId: industry.id } });

  const test = await prisma.testDefinition.create({
    data: {
      slug, industryId: industry.id, name: body.name, category: body.category,
      summary: body.summary ?? null, purpose: body.purpose ?? null, description: body.description ?? null,
      standardCodes: body.standardCodes, sampleRequirements: body.sampleRequirements ?? null,
      samplesRequired: body.samplesRequired ?? 1, sampleDestructive: body.sampleDestructive ?? false,
      sampleReturned: body.sampleReturned ?? false, deliverables: body.deliverables ?? [],
      conformanceRows: (body.conformanceRows ?? []) as object,
      fixturesRequired: body.fixturesRequired ?? [], severityNotes: body.severityNotes ?? null,
      turnaroundDays: body.turnaroundDays, accreditation: body.accreditation ?? null, order,
      procedures: { create: (body.procedures ?? []).map((p, i) => ({ stepNo: i + 1, title: p.title, detail: p.detail ?? null })) },
      forms: { create: (body.forms ?? []).map((f) => ({ name: f.name, description: f.description ?? null, required: f.required ?? false })) },
      providers: { create: (body.providerServiceIds ?? []).map((serviceId) => ({ serviceId })) },
    },
  });
  await prisma.auditLog.create({ data: { userId: u.id, action: "create", entity: "TestDefinition", entityId: test.id } });
  res.status(201).json(test);
});

// PATCH /platform/tests/:id — update a test (replaces procedures/forms/providers if arrays given)
platformRouter.patch("/tests/:id", async (req, res) => {
  const u = currentUser(req);
  const body = testSchema.partial().parse(req.body);
  const existing = await prisma.testDefinition.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError(404, "Test not found");

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.category !== undefined) data.category = body.category;
  if (body.industrySlug !== undefined) {
    const ind = await prisma.industry.findUnique({ where: { slug: body.industrySlug } });
    if (!ind) throw new AppError(400, "Unknown industry");
    data.industryId = ind.id;
  }
  if (body.summary !== undefined) data.summary = body.summary;
  if (body.purpose !== undefined) data.purpose = body.purpose;
  if (body.description !== undefined) data.description = body.description;
  if (body.standardCodes !== undefined) data.standardCodes = body.standardCodes;
  if (body.sampleRequirements !== undefined) data.sampleRequirements = body.sampleRequirements;
  if (body.samplesRequired !== undefined) data.samplesRequired = body.samplesRequired;
  if (body.sampleDestructive !== undefined) data.sampleDestructive = body.sampleDestructive;
  if (body.sampleReturned !== undefined) data.sampleReturned = body.sampleReturned;
  if (body.deliverables !== undefined) data.deliverables = body.deliverables;
  if (body.conformanceRows !== undefined) data.conformanceRows = body.conformanceRows as object;
  if (body.fixturesRequired !== undefined) data.fixturesRequired = body.fixturesRequired;
  if (body.severityNotes !== undefined) data.severityNotes = body.severityNotes;
  if (body.turnaroundDays !== undefined) data.turnaroundDays = body.turnaroundDays;
  if (body.accreditation !== undefined) data.accreditation = body.accreditation;
  if (body.isActive !== undefined) data.isActive = body.isActive;

  if (body.procedures) {
    await prisma.testProcedureStep.deleteMany({ where: { testId: existing.id } });
    data.procedures = { create: body.procedures.map((p, i) => ({ stepNo: i + 1, title: p.title, detail: p.detail ?? null })) };
  }
  if (body.forms) {
    await prisma.testForm.deleteMany({ where: { testId: existing.id } });
    data.forms = { create: body.forms.map((f) => ({ name: f.name, description: f.description ?? null, required: f.required ?? false })) };
  }
  if (body.providerServiceIds) {
    await prisma.testProvider.deleteMany({ where: { testId: existing.id } });
    data.providers = { create: body.providerServiceIds.map((serviceId) => ({ serviceId })) };
  }

  const test = await prisma.testDefinition.update({ where: { id: existing.id }, data });
  await prisma.auditLog.create({ data: { userId: u.id, action: "update", entity: "TestDefinition", entityId: test.id } });
  res.json(test);
});

// DELETE /platform/tests/:id
platformRouter.delete("/tests/:id", async (req, res) => {
  const u = currentUser(req);
  const existing = await prisma.testDefinition.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError(404, "Test not found");
  await prisma.testDefinition.delete({ where: { id: existing.id } });
  await prisma.auditLog.create({ data: { userId: u.id, action: "delete", entity: "TestDefinition", entityId: existing.id } });
  res.json({ ok: true });
});

// ---- Technology CRUD (lightweight: title, icon, blurb, categories) ----
async function uniqueTechnologySlug(base: string, excludeId?: string): Promise<string> {
  const root = kebab(base) || "technology";
  let slug = root;
  for (let i = 2; i < 100; i++) {
    const existing = await prisma.technology.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

const technologySchema = z.object({
  title: z.string().min(1),
  icon: z.string().optional().nullable(),
  blurb: z.string().optional().nullable(),
  categories: z.array(z.string()).default([]),
  isActive: z.boolean().optional(),
});

// POST /platform/technologies
platformRouter.post("/technologies", async (req, res) => {
  const u = currentUser(req);
  const body = technologySchema.parse(req.body);
  const slug = await uniqueTechnologySlug(body.title);
  const order = await prisma.technology.count();
  const tech = await prisma.technology.create({
    data: { slug, title: body.title, icon: body.icon ?? null, blurb: body.blurb ?? null, categories: body.categories, order },
  });
  await prisma.auditLog.create({ data: { userId: u.id, action: "create", entity: "Technology", entityId: tech.id } });
  res.status(201).json(tech);
});

// PATCH /platform/technologies/:id
platformRouter.patch("/technologies/:id", async (req, res) => {
  const u = currentUser(req);
  const body = technologySchema.partial().parse(req.body);
  const existing = await prisma.technology.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError(404, "Technology not found");
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.icon !== undefined) data.icon = body.icon;
  if (body.blurb !== undefined) data.blurb = body.blurb;
  if (body.categories !== undefined) data.categories = body.categories;
  if (body.isActive !== undefined) data.isActive = body.isActive;
  const tech = await prisma.technology.update({ where: { id: existing.id }, data });
  await prisma.auditLog.create({ data: { userId: u.id, action: "update", entity: "Technology", entityId: tech.id } });
  res.json(tech);
});

// DELETE /platform/technologies/:id
platformRouter.delete("/technologies/:id", async (req, res) => {
  const u = currentUser(req);
  const existing = await prisma.technology.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError(404, "Technology not found");
  await prisma.technology.delete({ where: { id: existing.id } });
  await prisma.auditLog.create({ data: { userId: u.id, action: "delete", entity: "Technology", entityId: existing.id } });
  res.json({ ok: true });
});

// ---- Provider test-requests review queue ----
// GET /platform/test-requests?status=PENDING
platformRouter.get("/test-requests", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const requests = await prisma.testRequest.findMany({
    where: status ? { status: status as "PENDING" | "APPROVED" | "REJECTED" } : {},
    orderBy: { createdAt: "desc" },
    include: { institution: { select: { name: true } }, industry: { select: { slug: true, title: true } } },
  });
  res.json(requests);
});

// POST /platform/test-requests/:id/approve — create the test (+ auto-enrol requester's service)
platformRouter.post("/test-requests/:id/approve", async (req, res) => {
  const u = currentUser(req);
  const body = z.object({ industrySlug: z.string().optional(), category: z.string().optional() }).parse(req.body ?? {});
  const request = await prisma.testRequest.findUnique({ where: { id: req.params.id }, include: { industry: true } });
  if (!request) throw new AppError(404, "Request not found");
  if (request.status !== "PENDING") throw new AppError(409, "Request already reviewed");

  const industrySlug = body.industrySlug ?? request.industry?.slug;
  if (!industrySlug) throw new AppError(400, "Choose an industry to approve into");
  const industry = await prisma.industry.findUnique({ where: { slug: industrySlug } });
  if (!industry) throw new AppError(400, "Unknown industry");

  const slug = await uniqueTestSlug(`${industry.slug}-${request.name}`);
  const order = await prisma.testDefinition.count({ where: { industryId: industry.id } });
  const test = await prisma.testDefinition.create({
    data: {
      slug, industryId: industry.id, name: request.name, category: body.category ?? request.category,
      summary: request.summary, description: request.description, standardCodes: request.standardCodes,
      sampleRequirements: request.sampleRequirements, turnaroundDays: request.turnaroundDays, order,
      accreditation: "NABL",
      providers: request.serviceId ? { create: [{ serviceId: request.serviceId }] } : undefined,
    },
  });
  await prisma.testRequest.update({ where: { id: request.id }, data: { status: "APPROVED", createdTestId: test.id } });
  await prisma.auditLog.create({ data: { userId: u.id, action: "approve-request", entity: "TestRequest", entityId: request.id, meta: { testId: test.id } } });
  res.json({ ok: true, testId: test.id, slug: test.slug });
});

// POST /platform/test-requests/:id/reject { note }
platformRouter.post("/test-requests/:id/reject", async (req, res) => {
  const u = currentUser(req);
  const { note } = z.object({ note: z.string().optional() }).parse(req.body ?? {});
  const request = await prisma.testRequest.findUnique({ where: { id: req.params.id } });
  if (!request) throw new AppError(404, "Request not found");
  if (request.status !== "PENDING") throw new AppError(409, "Request already reviewed");
  await prisma.testRequest.update({ where: { id: request.id }, data: { status: "REJECTED", reviewNote: note ?? null } });
  await prisma.auditLog.create({ data: { userId: u.id, action: "reject-request", entity: "TestRequest", entityId: request.id } });
  res.json({ ok: true });
});
