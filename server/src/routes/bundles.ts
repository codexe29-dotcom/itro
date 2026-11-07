import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { AppError } from "../http";
import { requireAuth, requireRole, currentUser } from "../middleware/auth";
import { resolveFee, computeBreakdown, discountedBase } from "../lib/pricing";
import { ratingsForServices } from "../lib/matching";

export const bundlesRouter = Router();

const providerRoles = ["INSTITUTION_ADMIN", "LAB_MANAGER"] as const;
const requireInst = (u: { institutionId: string | null }) => {
  if (!u.institutionId) throw new AppError(403, "No institution for this user");
  return u.institutionId;
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "bundle";
}
async function uniqueSlug(base: string) {
  let slug = base;
  for (let i = 2; await prisma.serviceBundle.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
  return slug;
}

// Compute the fee-inclusive gross / bundled price / savings for a bundle.
async function quoteBundle(bundle: { discountPct: number; institution: any; items: { service: any }[] }) {
  const fee = await resolveFee(bundle.institution);
  const factor = 1 - (bundle.discountPct ?? 0) / 100;
  let gross = 0, bundled = 0;
  const items = bundle.items
    .filter((it) => it.service && it.service.isActive && it.service.pricingMode === "FIXED")
    .map((it) => {
      const s = it.service;
      const base = discountedBase(s.priceIndustry, s.discountPct); // service-level discount first
      const listPrice = computeBreakdown(base, fee).buyerAmount;
      const price = computeBreakdown(Math.round(base * factor), fee).buyerAmount;
      gross += listPrice; bundled += price;
      return {
        serviceId: s.id, name: s.name, category: s.category,
        turnaroundDays: s.turnaroundDays, accreditation: s.accreditation ?? null,
        deliverable: s.deliverable ?? null, images: s.images ?? [],
        listPrice, price,
      };
    });
  return { items, gross, bundlePrice: bundled, savings: gross - bundled, discountPct: bundle.discountPct };
}

const bundleInclude = { items: { include: { service: true } }, institution: true, industry: { select: { slug: true, title: true } } } as const;

const bundleSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  industrySlug: z.string().nullable().optional(),
  discountPct: z.number().min(0).max(100),
  serviceIds: z.array(z.string()).min(1),
  images: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

async function resolveIndustryId(slug: string | null | undefined): Promise<string | null> {
  if (!slug) return null;
  const ind = await prisma.industry.findUnique({ where: { slug } });
  return ind?.id ?? null;
}

async function assertServicesOwned(serviceIds: string[], institutionId: string) {
  const count = await prisma.service.count({ where: { id: { in: serviceIds }, institutionId } });
  if (count !== new Set(serviceIds).size) throw new AppError(400, "One or more services aren't yours");
}

// ---- Provider CRUD ----
bundlesRouter.get("/bundles", requireAuth, requireRole(...providerRoles), async (req, res) => {
  const u = currentUser(req);
  const instId = requireInst(u);
  const bundles = await prisma.serviceBundle.findMany({ where: { institutionId: instId }, orderBy: { createdAt: "desc" }, include: bundleInclude });
  res.json(await Promise.all(bundles.map(async (b) => ({ ...b, quote: await quoteBundle(b) }))));
});

bundlesRouter.post("/bundles", requireAuth, requireRole(...providerRoles), async (req, res) => {
  const u = currentUser(req);
  const instId = requireInst(u);
  const body = bundleSchema.parse(req.body);
  await assertServicesOwned(body.serviceIds, instId);
  const slug = await uniqueSlug(slugify(body.name));
  const bundle = await prisma.serviceBundle.create({
    data: {
      institutionId: instId, slug, name: body.name, description: body.description ?? null,
      industryId: await resolveIndustryId(body.industrySlug),
      discountPct: body.discountPct, images: body.images ?? [], isActive: body.isActive ?? true,
      items: { create: [...new Set(body.serviceIds)].map((serviceId) => ({ serviceId })) },
    },
    include: bundleInclude,
  });
  await prisma.auditLog.create({ data: { userId: u.id, action: "create", entity: "ServiceBundle", entityId: bundle.id } });
  res.status(201).json({ ...bundle, quote: await quoteBundle(bundle) });
});

async function ownBundle(id: string, instId: string) {
  const b = await prisma.serviceBundle.findUnique({ where: { id }, include: bundleInclude });
  if (!b) throw new AppError(404, "Bundle not found");
  if (b.institutionId !== instId) throw new AppError(403, "Not your bundle");
  return b;
}

bundlesRouter.patch("/bundles/:id", requireAuth, requireRole(...providerRoles), async (req, res) => {
  const u = currentUser(req);
  const instId = requireInst(u);
  await ownBundle(req.params.id, instId);
  const body = bundleSchema.partial().parse(req.body);
  const data: Record<string, unknown> = {};
  for (const k of ["name", "description", "discountPct", "images", "isActive"] as const) if (body[k] !== undefined) data[k] = body[k];
  if (body.industrySlug !== undefined) data.industryId = await resolveIndustryId(body.industrySlug);
  if (body.serviceIds) {
    await assertServicesOwned(body.serviceIds, instId);
    await prisma.serviceBundleItem.deleteMany({ where: { bundleId: req.params.id } });
    data.items = { create: [...new Set(body.serviceIds)].map((serviceId) => ({ serviceId })) };
  }
  const bundle = await prisma.serviceBundle.update({ where: { id: req.params.id }, data, include: bundleInclude });
  res.json({ ...bundle, quote: await quoteBundle(bundle) });
});

bundlesRouter.delete("/bundles/:id", requireAuth, requireRole(...providerRoles), async (req, res) => {
  const u = currentUser(req);
  const instId = requireInst(u);
  await ownBundle(req.params.id, instId);
  await prisma.serviceBundle.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// ---- Public ----
// GET /bundles/lab/:slug — a lab's active bundles (for its public profile)
bundlesRouter.get("/bundles/lab/:slug", async (req, res) => {
  const inst = await prisma.institution.findUnique({ where: { slug: req.params.slug } });
  if (!inst || !inst.isPublished || !inst.onExchange) return res.json([]);
  const bundles = await prisma.serviceBundle.findMany({ where: { institutionId: inst.id, isActive: true }, include: bundleInclude });
  res.json(await Promise.all(bundles.map(async (b) => ({
    id: b.id, slug: b.slug, name: b.name, description: b.description, images: b.images, discountPct: b.discountPct,
    industry: b.industry, quote: await quoteBundle(b),
  }))));
});

// GET /bundles/browse?industry=slug — all active bundles across published labs (exchange)
bundlesRouter.get("/bundles/browse", async (req, res) => {
  const industrySlug = typeof req.query.industry === "string" ? req.query.industry : undefined;
  const where: any = { isActive: true, institution: { isPublished: true, onExchange: true } };
  if (industrySlug) where.industry = { slug: industrySlug };
  const bundles = await prisma.serviceBundle.findMany({ where, orderBy: { createdAt: "desc" }, take: 60, include: bundleInclude });
  const out = await Promise.all(bundles.map(async (b) => ({
    id: b.id, slug: b.slug, name: b.name, description: b.description, images: b.images, discountPct: b.discountPct,
    industry: b.industry,
    institution: { name: b.institution.name, slug: b.institution.slug, city: b.institution.city, state: b.institution.state, currency: b.institution.currency },
    quote: await quoteBundle(b),
  })));
  // Only bundles that actually have priced members are useful.
  res.json(out.filter((b) => b.quote.items.length > 0));
});

// GET /bundles/public/:slug — public bundle detail
bundlesRouter.get("/bundles/public/:slug", async (req, res) => {
  const b = await prisma.serviceBundle.findUnique({ where: { slug: req.params.slug }, include: bundleInclude });
  if (!b || !b.isActive) throw new AppError(404, "Bundle not found");
  const inst = b.institution;
  if (!inst.isPublished || !inst.onExchange) throw new AppError(404, "Bundle not found");
  const quote = await quoteBundle(b);
  // Enrich each line with its service rating (like the certification-package page).
  const ratingMap = await ratingsForServices(quote.items.map((i) => i.serviceId));
  quote.items = quote.items.map((i) => ({ ...i, rating: ratingMap.get(i.serviceId) ?? { avg: 0, count: 0 } }));
  res.json({
    id: b.id, slug: b.slug, name: b.name, description: b.description, images: b.images, discountPct: b.discountPct,
    industry: b.industry,
    institution: { id: inst.id, name: inst.name, slug: inst.slug, city: inst.city, state: inst.state, currency: inst.currency },
    quote,
  });
});
