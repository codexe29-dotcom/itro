import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { paginate, pageResult, strParam, numParam } from "../http";
import { interpretRequirement, distanceKmOrNull, ratingsForServices } from "../lib/matching";
import { attachBuyerPrices } from "../lib/pricing";
import { estimateSchedule } from "../lib/scheduling";

export const exchangeRouter = Router();

// GET /exchange/services — PUBLIC: all active services across published institutions
exchangeRouter.get("/services", async (req, res) => {
  const p = paginate(req.query);
  const where: any = {
    isActive: true,
    institution: { isPublished: true, onExchange: true },
  };

  const category = strParam(req.query, "category");
  const accreditation = strParam(req.query, "accreditation");
  const institutionId = strParam(req.query, "institutionId");
  const maxPrice = numParam(req.query, "maxPrice");
  const maxTurnaround = numParam(req.query, "maxTurnaround");
  const minRating = numParam(req.query, "minRating");
  const availableNow = strParam(req.query, "availableNow");
  const sort = strParam(req.query, "sort") ?? "recommended";

  if (category) where.category = category;
  if (accreditation) where.accreditation = accreditation;
  if (institutionId) where.institutionId = institutionId;
  if (maxPrice !== undefined) where.priceIndustry = { lte: maxPrice };
  if (maxTurnaround !== undefined) where.turnaroundDays = { lte: maxTurnaround };
  if (availableNow === "true" || availableNow === "1") where.instrument = { status: "AVAILABLE" };
  if (p.q) {
    where.OR = [
      { name: { contains: p.q, mode: "insensitive" } },
      { description: { contains: p.q, mode: "insensitive" } },
      { category: { contains: p.q, mode: "insensitive" } },
    ];
  }

  // Fetch matching set, attach ratings, then filter (minRating) / sort / paginate in memory.
  const all = await prisma.service.findMany({
    where,
    include: { institution: true, instrument: true },
    take: 500,
  });
  const ratings = await ratingsForServices(all.map((s) => s.id));
  let enriched = all.map((s) => ({ ...s, rating: ratings.get(s.id) ?? { avg: 0, count: 0 } }));
  if (minRating !== undefined) enriched = enriched.filter((s) => s.rating.avg >= minRating);

  const comparators: Record<string, (a: typeof enriched[number], b: typeof enriched[number]) => number> = {
    price_asc: (a, b) => a.priceIndustry - b.priceIndustry,
    price_desc: (a, b) => b.priceIndustry - a.priceIndustry,
    turnaround_asc: (a, b) => a.turnaroundDays - b.turnaroundDays,
    rating_desc: (a, b) => b.rating.avg - a.rating.avg || b.rating.count - a.rating.count,
    recommended: (a, b) => b.rating.avg - a.rating.avg || a.priceIndustry - b.priceIndustry,
  };
  enriched.sort(comparators[sort] ?? comparators.recommended);

  const total = enriched.length;
  const page = enriched.slice(p.skip, p.skip + p.take);
  const priced = await attachBuyerPrices(page);
  // Attach the truthful computed schedule (available-from / est. completion / queue).
  const data = await Promise.all(
    priced.map(async (s: any) => ({
      ...s,
      schedule: await estimateSchedule({ instrumentId: s.instrumentId ?? null, turnaroundDays: s.turnaroundDays }),
    }))
  );
  res.json(pageResult(data, total, p));
});

// GET /exchange/categories — PUBLIC: distinct categories with counts
exchangeRouter.get("/categories", async (_req, res) => {
  const grouped = await prisma.service.groupBy({
    by: ["category"],
    where: { isActive: true, institution: { isPublished: true, onExchange: true } },
    _count: { _all: true },
    orderBy: { category: "asc" },
  });
  res.json(
    grouped.map((g) => ({ category: g.category, count: g._count._all }))
  );
});

// GET /exchange/facets — PUBLIC: filter facets (categories, accreditations) with counts
exchangeRouter.get("/facets", async (_req, res) => {
  const base = { isActive: true, institution: { isPublished: true, onExchange: true } };
  const [cats, accreds, total] = await Promise.all([
    prisma.service.groupBy({ by: ["category"], where: base, _count: { _all: true }, orderBy: { category: "asc" } }),
    prisma.service.groupBy({ by: ["accreditation"], where: { ...base, accreditation: { not: null } }, _count: { _all: true } }),
    prisma.service.count({ where: base }),
  ]);
  res.json({
    total,
    categories: cats.map((c) => ({ category: c.category, count: c._count._all })),
    accreditations: accreds
      .filter((a) => a.accreditation)
      .map((a) => ({ accreditation: a.accreditation as string, count: a._count._all }))
      .sort((x, y) => y.count - x.count),
  });
});

// GET /exchange/experts — PUBLIC: all active experts across published institutions
exchangeRouter.get("/experts", async (req, res) => {
  const p = paginate(req.query);
  const where: any = {
    isActive: true,
    institution: { isPublished: true, onExchange: true },
  };

  const expertise = strParam(req.query, "expertise");
  const skill = strParam(req.query, "skill");
  const institutionId = strParam(req.query, "institutionId");
  if (expertise) where.expertise = { has: expertise };
  if (skill) where.skills = { has: skill };
  if (institutionId) where.institutionId = institutionId;
  if (p.q) {
    where.OR = [
      { name: { contains: p.q, mode: "insensitive" } },
      { title: { contains: p.q, mode: "insensitive" } },
      { bio: { contains: p.q, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.expert.findMany({
      where,
      orderBy: { name: "asc" },
      skip: p.skip,
      take: p.take,
      include: { institution: true },
    }),
    prisma.expert.count({ where }),
  ]);
  res.json(pageResult(data, total, p));
});

const aiSearchSchema = z.object({
  requirement: z.string().min(1),
  lat: z.number().optional(),
  lng: z.number().optional(),
  maxPrice: z.number().positive().optional(),
  maxTurnaround: z.number().positive().optional(),
});

// POST /exchange/ai-search — deterministic NL matcher over published services
exchangeRouter.post("/ai-search", async (req, res) => {
  const body = aiSearchSchema.parse(req.body);
  const interpreted = interpretRequirement(body.requirement);

  const services = await prisma.service.findMany({
    where: { isActive: true, institution: { isPublished: true, onExchange: true } },
    include: {
      institution: true,
      instrument: { select: { specs: true, category: true } },
    },
  });

  const ratings = await ratingsForServices(services.map((s) => s.id));
  const catSet = new Set(interpreted.categories);

  const scored = services.map((s) => {
    const reasons: string[] = [];
    let score = 0;

    // Category hit (+50)
    if (catSet.has(s.category)) {
      score += 50;
      reasons.push(`Matches ${s.category} category`);
    }

    // Keyword hits in name/description/specs (+ up to 25, 5 each)
    const haystack = [
      s.name,
      s.description ?? "",
      s.deliverable ?? "",
      s.category,
      s.instrument ? JSON.stringify(s.instrument.specs ?? {}) : "",
    ]
      .join(" ")
      .toLowerCase();
    let kwPoints = 0;
    const matchedKw: string[] = [];
    for (const kw of interpreted.keywords) {
      if (kwPoints >= 25) break;
      if (haystack.includes(kw)) {
        kwPoints += 5;
        matchedKw.push(kw);
      }
    }
    if (kwPoints > 0) {
      score += Math.min(kwPoints, 25);
      reasons.push(`Keyword match: ${matchedKw.join(", ")}`);
    }

    // Rating (+ up to 10): avg/5 * 10
    const rating = ratings.get(s.id) ?? { avg: 0, count: 0 };
    if (rating.count > 0) {
      const rPts = Math.round((rating.avg / 5) * 10);
      score += rPts;
      reasons.push(`Rated ${rating.avg}/5 (${rating.count} review${rating.count === 1 ? "" : "s"})`);
    }

    // Proximity (+ up to 10) if lat/lng provided
    const distanceKm = distanceKmOrNull(body.lat, body.lng, s.institution.latitude, s.institution.longitude);
    if (distanceKm !== null) {
      // 0 km -> +10, decaying to 0 at ~1500 km
      const proxPts = Math.max(0, Math.round(10 - (distanceKm / 1500) * 10));
      if (proxPts > 0) {
        score += proxPts;
        reasons.push(`~${distanceKm} km away`);
      }
    }

    // Mild price preference (+/-5)
    if (body.maxPrice !== undefined) {
      if (s.priceIndustry <= body.maxPrice) {
        score += 5;
        reasons.push("Within budget");
      } else {
        score -= 5;
        reasons.push("Above budget");
      }
    }

    // Mild turnaround preference (+/-5)
    if (body.maxTurnaround !== undefined) {
      if (s.turnaroundDays <= body.maxTurnaround) {
        score += 5;
        reasons.push("Meets turnaround");
      } else {
        score -= 5;
        reasons.push("Slower turnaround");
      }
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    return {
      id: s.id,
      name: s.name,
      category: s.category,
      description: s.description,
      deliverable: s.deliverable,
      turnaroundDays: s.turnaroundDays,
      priceInternal: s.priceInternal,
      priceAcademic: s.priceAcademic,
      priceIndustry: s.priceIndustry,
      accreditation: s.accreditation,
      institution: {
        id: s.institution.id,
        name: s.institution.name,
        slug: s.institution.slug,
        city: s.institution.city,
        state: s.institution.state,
        latitude: s.institution.latitude,
        longitude: s.institution.longitude,
      },
      rating,
      distanceKm,
      matchScore: score,
      matchReasons: reasons,
    };
  });

  const results = scored
    .filter((r) => r.matchScore > 0)
    .sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      if (a.distanceKm !== null && b.distanceKm !== null && a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
      return a.priceIndustry - b.priceIndustry;
    })
    .slice(0, 12);

  res.json({ requirement: body.requirement, interpreted, results });
});
