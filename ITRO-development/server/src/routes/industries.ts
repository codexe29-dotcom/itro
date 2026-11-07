import { Router } from "express";
import { prisma } from "../db";
import { AppError } from "../http";
import { rankTestProviders, quotePackage, type Strategy, type RoutingPrefs } from "../lib/routing";

export const industriesRouter = Router();

const STRATEGIES: Strategy[] = ["BALANCED", "FASTEST", "CHEAPEST", "NEAREST"];
function parsePrefs(q: Record<string, unknown>): RoutingPrefs {
  const raw = String(q.strategy ?? "BALANCED").toUpperCase() as Strategy;
  const strategy = STRATEGIES.includes(raw) ? raw : "BALANCED";
  const lat = q.lat != null ? Number(q.lat) : undefined;
  const lng = q.lng != null ? Number(q.lng) : undefined;
  return { strategy, lat: Number.isFinite(lat) ? lat : undefined, lng: Number.isFinite(lng) ? lng : undefined };
}

// GET /industries — all active industries with test/package counts
industriesRouter.get("/industries", async (_req, res) => {
  const industries = await prisma.industry.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    include: { _count: { select: { tests: true, packages: true } } },
  });
  res.json(industries.map((i) => ({
    id: i.id, slug: i.slug, title: i.title, icon: i.icon,
    seoTitle: i.seoTitle, seoDescription: i.seoDescription,
    heroTagline: i.heroTagline, intro: i.intro,
    testCount: i._count.tests, packageCount: i._count.packages,
  })));
});

// GET /industries/:slug — full industry page payload
industriesRouter.get("/industries/:slug", async (req, res) => {
  const industry = await prisma.industry.findUnique({
    where: { slug: req.params.slug },
    include: {
      standards: { orderBy: { order: "asc" } },
      tests: {
        where: { isActive: true },
        orderBy: { order: "asc" },
        include: { _count: { select: { providers: true } } },
      },
      packages: {
        where: { isActive: true },
        orderBy: { order: "asc" },
        include: { _count: { select: { items: true } } },
      },
    },
  });
  if (!industry) throw new AppError(404, "Industry not found");

  res.json({
    id: industry.id, slug: industry.slug, title: industry.title, icon: industry.icon,
    seoTitle: industry.seoTitle, seoDescription: industry.seoDescription,
    heroTagline: industry.heroTagline, intro: industry.intro,
    seoKeywords: industry.seoKeywords, relatedCategories: industry.relatedCategories,
    faq: industry.faq,
    standards: industry.standards.map((s) => ({ code: s.code, name: s.name })),
    tests: industry.tests.map((t) => ({
      id: t.id, slug: t.slug, name: t.name, category: t.category,
      summary: t.summary, turnaroundDays: t.turnaroundDays,
      accreditation: t.accreditation, standardCodes: t.standardCodes,
      providerCount: t._count.providers,
    })),
    packages: industry.packages.map((p) => ({
      id: p.id, slug: p.slug, name: p.name, summary: p.summary,
      pricingMode: p.pricingMode, discountPct: p.discountPct,
      accreditation: p.accreditation, itemCount: p._count.items,
    })),
  });
});

// GET /tests/:slug?strategy=&lat=&lng= — test detail + ranked providers
industriesRouter.get("/tests/:slug", async (req, res) => {
  const prefs = parsePrefs(req.query as Record<string, unknown>);
  const test = await prisma.testDefinition.findUnique({
    where: { slug: req.params.slug },
    include: {
      industry: { select: { slug: true, title: true, icon: true } },
      procedures: { orderBy: { stepNo: "asc" } },
      forms: true,
      associatedTo: { select: { slug: true, name: true, summary: true, category: true } },
      associatedFrom: { select: { slug: true, name: true, summary: true, category: true } },
    },
  });
  if (!test) throw new AppError(404, "Test not found");

  // Symmetric associated tests (union, deduped by slug).
  const assocMap = new Map<string, { slug: string; name: string; summary: string | null; category: string }>();
  for (const a of [...test.associatedTo, ...test.associatedFrom]) assocMap.set(a.slug, a);

  const providers = await rankTestProviders(test.id, test.accreditation, prefs);

  res.json({
    id: test.id, slug: test.slug, name: test.name, category: test.category,
    summary: test.summary, purpose: test.purpose, description: test.description,
    standardCodes: test.standardCodes, sampleRequirements: test.sampleRequirements,
    samplesRequired: test.samplesRequired, sampleDestructive: test.sampleDestructive,
    sampleReturned: test.sampleReturned, deliverables: test.deliverables,
    conformanceRows: (test.conformanceRows ?? []) as unknown,
    fixturesRequired: test.fixturesRequired, severityNotes: test.severityNotes,
    turnaroundDays: test.turnaroundDays, accreditation: test.accreditation,
    industry: test.industry,
    procedures: test.procedures.map((p) => ({ stepNo: p.stepNo, title: p.title, detail: p.detail })),
    forms: test.forms.map((f) => ({ name: f.name, description: f.description, fileUrl: f.fileUrl, required: f.required })),
    associated: [...assocMap.values()],
    strategy: prefs.strategy,
    providers,
  });
});

// GET /packages/:slug?strategy=&lat=&lng= — package detail + live routed quote
industriesRouter.get("/packages/:slug", async (req, res) => {
  const prefs = parsePrefs(req.query as Record<string, unknown>);
  const pkg = await prisma.testPackage.findUnique({
    where: { slug: req.params.slug },
    include: {
      industry: { select: { slug: true, title: true, icon: true } },
      items: { orderBy: { sequence: "asc" }, include: { test: { select: { slug: true, name: true, summary: true, category: true, accreditation: true } } } },
    },
  });
  if (!pkg) throw new AppError(404, "Package not found");

  const quote = await quotePackage(pkg.slug, prefs);

  res.json({
    id: pkg.id, slug: pkg.slug, name: pkg.name, summary: pkg.summary, description: pkg.description,
    pricingMode: pkg.pricingMode, discountPct: pkg.discountPct, accreditation: pkg.accreditation,
    industry: pkg.industry,
    items: pkg.items.map((it) => ({ sequence: it.sequence, optional: it.optional, test: it.test })),
    strategy: prefs.strategy,
    quote,
  });
});

// GET /technologies — all active technologies
industriesRouter.get("/technologies", async (_req, res) => {
  const techs = await prisma.technology.findMany({ where: { isActive: true }, orderBy: { order: "asc" } });
  res.json(techs.map((t) => ({ id: t.id, slug: t.slug, title: t.title, icon: t.icon, blurb: t.blurb, categories: t.categories })));
});

// GET /technologies/:slug — technology + its tests, instruments & facilities
industriesRouter.get("/technologies/:slug", async (req, res) => {
  const tech = await prisma.technology.findUnique({ where: { slug: req.params.slug } });
  if (!tech) throw new AppError(404, "Technology not found");
  const cats = tech.categories;
  const publishedInst = { facility: { institution: { isPublished: true, onExchange: true } } };

  const [tests, instruments, serviceCount] = await Promise.all([
    prisma.testDefinition.findMany({
      where: { isActive: true, category: { in: cats } },
      orderBy: { order: "asc" },
      select: {
        id: true, slug: true, name: true, category: true, summary: true, turnaroundDays: true,
        accreditation: true, industry: { select: { slug: true, title: true } },
        _count: { select: { providers: true } },
      },
    }),
    prisma.instrument.findMany({
      where: { category: { in: cats }, ...publishedInst },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, category: true, make: true, model: true, images: true, imageUrl: true, status: true,
        facility: { select: { id: true, name: true, institution: { select: { id: true, name: true, slug: true, city: true, state: true } } } },
      },
    }),
    prisma.service.count({ where: { isActive: true, category: { in: cats }, institution: { isPublished: true, onExchange: true } } }),
  ]);

  // Distinct facilities hosting these instruments.
  const facMap = new Map<string, { id: string; name: string; institution: { id: string; name: string; slug: string; city: string | null; state: string | null }; instrumentCount: number }>();
  for (const i of instruments) {
    const f = i.facility;
    if (!f) continue;
    const cur = facMap.get(f.id);
    if (cur) cur.instrumentCount += 1;
    else facMap.set(f.id, { id: f.id, name: f.name, institution: f.institution, instrumentCount: 1 });
  }

  res.json({
    id: tech.id, slug: tech.slug, title: tech.title, icon: tech.icon, blurb: tech.blurb, categories: cats,
    serviceCount,
    tests: tests.map((t) => ({
      id: t.id, slug: t.slug, name: t.name, category: t.category, summary: t.summary,
      turnaroundDays: t.turnaroundDays, accreditation: t.accreditation, industry: t.industry, providerCount: t._count.providers,
    })),
    instruments: instruments.map((i) => ({
      id: i.id, name: i.name, category: i.category, make: i.make, model: i.model,
      image: i.images?.[0] ?? i.imageUrl ?? null, status: i.status,
      facility: i.facility ? { id: i.facility.id, name: i.facility.name } : null,
      institution: i.facility?.institution ?? null,
    })),
    facilities: [...facMap.values()],
  });
});

// GET /packages — all active packages (for a catalog listing)
industriesRouter.get("/packages", async (_req, res) => {
  const packages = await prisma.testPackage.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    include: {
      industry: { select: { slug: true, title: true } },
      _count: { select: { items: true } },
    },
  });
  res.json(packages.map((p) => ({
    id: p.id, slug: p.slug, name: p.name, summary: p.summary,
    pricingMode: p.pricingMode, discountPct: p.discountPct,
    industry: p.industry, itemCount: p._count.items,
  })));
});
