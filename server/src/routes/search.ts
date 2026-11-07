import { Router } from "express";
import { prisma } from "../db";
import { ratingsForInstitutions } from "../lib/matching";

export const searchRouter = Router();

const ci = (q: string) => ({ contains: q, mode: "insensitive" as const });

/**
 * GET /search?q= — unified public discovery across the four "doors":
 * Tests (catalog), Packages, Labs (providers), Experts, plus matched Standards.
 * Each group is capped; returns counts so the UI can show "See all".
 */
searchRouter.get("/search", async (req, res) => {
  const q = (typeof req.query.q === "string" ? req.query.q : "").trim();
  const limit = Math.min(Number(req.query.limit) || 6, 12);
  if (q.length < 2) {
    return res.json({ q, tests: [], packages: [], labs: [], experts: [], standards: [] });
  }
  const ql = q.toLowerCase();

  const [tests, packages, labs, experts, testCodes, accreds] = await Promise.all([
    prisma.testDefinition.findMany({
      where: {
        isActive: true,
        OR: [{ name: ci(q) }, { summary: ci(q) }, { category: ci(q) }, { standardCodes: { has: q } }],
      },
      take: limit,
      orderBy: { order: "asc" },
      select: { id: true, slug: true, name: true, category: true, standardCodes: true, industry: { select: { slug: true } } },
    }),
    prisma.testPackage.findMany({
      where: { isActive: true, OR: [{ name: ci(q) }, { summary: ci(q) }, { description: ci(q) }] },
      take: limit,
      orderBy: { order: "asc" },
      select: { id: true, slug: true, name: true, summary: true },
    }),
    prisma.institution.findMany({
      where: { isPublished: true, OR: [{ name: ci(q) }, { city: ci(q) }, { state: ci(q) }, { accreditations: { has: q } }] },
      take: limit,
      orderBy: { name: "asc" },
      select: { id: true, slug: true, name: true, city: true, state: true, accreditations: true },
    }),
    prisma.expert.findMany({
      where: {
        isActive: true,
        institution: { isPublished: true },
        OR: [{ name: ci(q) }, { title: ci(q) }, { expertise: { has: q } }, { skills: { has: q } }],
      },
      take: limit,
      orderBy: { name: "asc" },
      select: { id: true, name: true, title: true, institution: { select: { name: true } } },
    }),
    // Standards: scan configured standard codes + accreditations for a partial match.
    prisma.testDefinition.findMany({ where: { isActive: true }, select: { standardCodes: true } }),
    prisma.service.findMany({ where: { isActive: true, accreditation: { not: null } }, select: { accreditation: true }, distinct: ["accreditation"] }),
  ]);

  const stdSet = new Set<string>();
  for (const t of testCodes) for (const c of t.standardCodes) if (c.toLowerCase().includes(ql)) stdSet.add(c);
  for (const a of accreds) if (a.accreditation && a.accreditation.toLowerCase().includes(ql)) stdSet.add(a.accreditation);
  const standards = [...stdSet].slice(0, limit);

  // Attach provider ratings (cheap, small set).
  const ratings = await ratingsForInstitutions(labs.map((l) => l.id));

  res.json({
    q,
    tests: tests.map((t) => ({
      id: t.id, slug: t.slug, name: t.name, category: t.category,
      standardCodes: t.standardCodes, industrySlug: t.industry.slug,
    })),
    packages: packages.map((p) => ({ id: p.id, slug: p.slug, name: p.name, summary: p.summary })),
    labs: labs.map((l) => ({
      id: l.id, slug: l.slug, name: l.name, city: l.city, state: l.state,
      accreditations: l.accreditations, rating: ratings.get(l.id) ?? { avg: 0, count: 0 },
    })),
    experts: experts.map((e) => ({ id: e.id, name: e.name, title: e.title, provider: e.institution.name })),
    standards,
  });
});

/**
 * GET /catalog/highlights — landing "get started" content:
 * the most-requested tests (those with the most enrolled providers) and the
 * standards buyers can browse by.
 */
searchRouter.get("/catalog/highlights", async (_req, res) => {
  const [tests, allCodes, accreds] = await Promise.all([
    prisma.testDefinition.findMany({
      where: { isActive: true },
      orderBy: [{ providers: { _count: "desc" } }, { order: "asc" }],
      take: 8,
      select: {
        id: true, slug: true, name: true, category: true, standardCodes: true,
        industry: { select: { slug: true, title: true } },
        _count: { select: { providers: true } },
      },
    }),
    prisma.testDefinition.findMany({ where: { isActive: true }, select: { standardCodes: true } }),
    prisma.service.findMany({ where: { isActive: true, accreditation: { not: null } }, select: { accreditation: true }, distinct: ["accreditation"] }),
  ]);

  const stdSet = new Set<string>();
  for (const t of allCodes) for (const c of t.standardCodes) if (c) stdSet.add(c);
  for (const a of accreds) if (a.accreditation) stdSet.add(a.accreditation);

  res.json({
    tests: tests.map((t) => ({
      id: t.id, slug: t.slug, name: t.name, category: t.category,
      standardCodes: t.standardCodes, industrySlug: t.industry.slug,
      industryTitle: t.industry.title, providerCount: t._count.providers,
    })),
    standards: [...stdSet].slice(0, 12),
  });
});
