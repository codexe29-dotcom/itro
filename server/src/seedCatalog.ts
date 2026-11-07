// Seeds the configurable test catalog (Industries → Tests → Providers + Packages)
// from data/catalog.ts. Provider links point at real seeded Services so the
// routing engine has genuine price / turnaround / capacity to rank.
//
// Fully idempotent: clears catalog rows then rebuilds.

import type { Service, Institution, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { INDUSTRIES, PACKAGES, TECHNOLOGIES } from "./data/catalog";

type ServiceWithInst = Service & { institution: Institution };

const kebab = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Map a test to the instrument/service category whose providers should fulfil it. */
function categorize(name: string, blurb: string, related: string[]): string {
  const t = `${name} ${blurb}`.toLowerCase();
  if (/\btem\b|transmission electron/.test(t)) return "TEM";
  if (/sem|micrograph|fractograph|metallograph|\beds\b|morpholog|imaging/.test(t)) return "SEM";
  if (/xrd|x-ray|diffraction|\bphase\b|crystallin/.test(t)) return "XRD";
  if (/\bnmr\b/.test(t)) return "NMR";
  if (/gc-?ms|chromatograph|extractable|leachable|volatile|endotoxin|cytotox|steril|biocompat|chemical characteriz|\bcompound\b|bioburden/.test(t)) return "GC-MS";
  if (/ftir|infrared|functional group/.test(t)) return "FTIR";
  if (/rheolog|viscosity/.test(t)) return "Rheometer";
  if (/cnc|machin|\bcmm\b|dimensional|metrolog|gd&t|tolerance|prototyp|roundness|first article|surface roughness/.test(t)) return "CNC";
  if (/\b3d\b|additive|printed|dmls|slm|topology|lightweight/.test(t)) return "3D Metal Printer";
  if (/fatigue|crack growth|creep|durabilit|cyclic/.test(t)) return "Fatigue";
  if (/tensile|hardness|impact|charpy|\bload\b|structural|fracture|mechanical|compression|flexural|\bpmi\b|material verification/.test(t)) return "UTM";
  return related[0] ?? "UTM";
}

/** Pick up to 4 distinct provider services: the test's category first, then the
 *  industry's related categories - ensures most tests have 2–4 comparable providers. */
function providerPool(category: string, related: string[], byCat: Record<string, ServiceWithInst[]>): ServiceWithInst[] {
  const seen = new Set<string>();
  const out: ServiceWithInst[] = [];
  const push = (arr?: ServiceWithInst[]) => {
    for (const s of arr ?? []) {
      if (!seen.has(s.id) && out.length < 4) { seen.add(s.id); out.push(s); }
    }
  };
  push(byCat[category]);
  for (const c of related) { if (out.length >= 4) break; push(byCat[c]); }
  return out;
}

function procedureSteps(name: string, std: string) {
  return [
    { stepNo: 1, title: "Requirement & standard review", detail: `Confirm scope, applicable standard (${std}) and acceptance criteria for ${name}.` },
    { stepNo: 2, title: "Sample submission & chain-of-custody", detail: "Register samples, capture identifiers and log chain-of-custody on receipt." },
    { stepNo: 3, title: "Specimen preparation", detail: `Prepare and condition specimens as required for ${name}.` },
    { stepNo: 4, title: "Test execution", detail: `Execute ${name} on calibrated, accredited equipment per ${std}.` },
    { stepNo: 5, title: "Analysis & accredited report", detail: "Analyze results, quality-review and issue a NABL/ISO 17025 accredited report." },
  ];
}

const FORMS = [
  { name: "Test Request Form", description: "Scope, applicable standard, quantity and turnaround selection.", required: true },
  { name: "Sample Submission & Chain-of-Custody", description: "Sample identifiers, quantity, condition and handling instructions.", required: true },
  { name: "Mutual NDA", description: "Confidentiality agreement for sensitive programs.", required: false },
];

export async function seedCatalog() {
  // Load real provider services grouped by category.
  const services = (await prisma.service.findMany({
    where: { isActive: true },
    include: { institution: true },
  })) as ServiceWithInst[];
  const byCat: Record<string, ServiceWithInst[]> = {};
  for (const s of services) (byCat[s.category] ??= []).push(s);

  // Idempotent reset (order matters for FK cascades).
  await prisma.testPackage.deleteMany({});
  await prisma.testDefinition.deleteMany({});
  await prisma.industryStandard.deleteMany({});

  // testName -> id, keyed per industry, for packages + associations.
  const testIdByIndustry: Record<string, Record<string, string>> = {};

  for (let i = 0; i < INDUSTRIES.length; i++) {
    const ind = INDUSTRIES[i];
    const industry = await prisma.industry.upsert({
      where: { slug: ind.slug },
      update: {
        title: ind.title, icon: ind.icon, seoTitle: ind.seoTitle,
        seoDescription: ind.seoDescription, heroTagline: ind.heroTagline, intro: ind.intro,
        seoKeywords: ind.seoKeywords, relatedCategories: ind.relatedCategories,
        faq: ind.faq as unknown as Prisma.InputJsonValue, order: i, isActive: true,
      },
      create: {
        slug: ind.slug, title: ind.title, icon: ind.icon, seoTitle: ind.seoTitle,
        seoDescription: ind.seoDescription, heroTagline: ind.heroTagline, intro: ind.intro,
        seoKeywords: ind.seoKeywords, relatedCategories: ind.relatedCategories,
        faq: ind.faq as unknown as Prisma.InputJsonValue, order: i, isActive: true,
      },
    });

    await prisma.industryStandard.createMany({
      data: ind.standards.map((s, idx) => ({ industryId: industry.id, code: s.code, name: s.name, order: idx })),
    });

    testIdByIndustry[ind.slug] = {};

    for (let j = 0; j < ind.commonTests.length; j++) {
      const t = ind.commonTests[j];
      const category = categorize(t.name, t.blurb, ind.relatedCategories);
      const pool = providerPool(category, ind.relatedCategories, byCat);
      // Relevant standard codes: any industry standard referenced in the test text.
      const text = `${t.name} ${t.blurb}`.toLowerCase();
      let stdCodes = ind.standards.filter((s) => text.includes(s.code.toLowerCase())).map((s) => s.code);
      if (stdCodes.length === 0) stdCodes = [ind.standards[0].code];
      const turnaround = pool.length ? Math.round(pool.reduce((n, s) => n + s.turnaroundDays, 0) / pool.length) : 10;

      const test = await prisma.testDefinition.create({
        data: {
          slug: `${ind.slug}-${kebab(t.name)}`,
          industryId: industry.id,
          name: t.name,
          category,
          summary: t.blurb,
          description: `${t.name} - ${t.blurb}. Sourced from accredited providers on the network with live pricing, turnaround and capacity.`,
          standardCodes: stdCodes,
          sampleRequirements: "Provide representative samples with quantity, material grade and any handling/safety notes. Sample-prep guidance is confirmed on order.",
          turnaroundDays: turnaround,
          accreditation: "NABL",
          order: j,
          procedures: { create: procedureSteps(t.name, stdCodes[0]) },
          forms: { create: FORMS },
          providers: {
            create: pool.map((s, idx) => ({ serviceId: s.id, isPreferred: idx === 0 })),
          },
        },
      });
      testIdByIndustry[ind.slug][t.name] = test.id;
    }

    // Associated tests: link each test to 3 siblings (symmetric via API union).
    const ids = Object.values(testIdByIndustry[ind.slug]);
    for (let k = 0; k < ids.length; k++) {
      const siblings = [ids[(k + 1) % ids.length], ids[(k + 2) % ids.length], ids[(k + 3) % ids.length]]
        .filter((id) => id !== ids[k]);
      await prisma.testDefinition.update({
        where: { id: ids[k] },
        data: { associatedTo: { connect: siblings.map((id) => ({ id })) } },
      });
    }
  }

  // Packages
  for (let p = 0; p < PACKAGES.length; p++) {
    const pkg = PACKAGES[p];
    const industry = await prisma.industry.findUnique({ where: { slug: pkg.industrySlug } });
    if (!industry) continue;
    const map = testIdByIndustry[pkg.industrySlug] ?? {};
    const items = pkg.testNames
      .map((n, seq) => ({ testId: map[n], sequence: seq }))
      .filter((it) => !!it.testId) as { testId: string; sequence: number }[];
    if (items.length === 0) continue;

    await prisma.testPackage.create({
      data: {
        slug: pkg.slug,
        industryId: industry.id,
        name: pkg.name,
        summary: pkg.summary,
        description: pkg.description,
        pricingMode: "DYNAMIC",
        discountPct: pkg.discountPct,
        accreditation: pkg.accreditation,
        order: p,
        items: { create: items },
      },
    });
  }

  // Technologies (buyer-facing groupings of instrument categories)
  for (let i = 0; i < TECHNOLOGIES.length; i++) {
    const t = TECHNOLOGIES[i];
    await prisma.technology.upsert({
      where: { slug: t.slug },
      update: { title: t.title, icon: t.icon, blurb: t.blurb, categories: t.categories, order: i, isActive: true },
      create: { slug: t.slug, title: t.title, icon: t.icon, blurb: t.blurb, categories: t.categories, order: i, isActive: true },
    });
  }

  const [ic, tc, pc, tpc] = await Promise.all([
    prisma.industry.count(),
    prisma.testDefinition.count(),
    prisma.testPackage.count(),
    prisma.testProvider.count(),
  ]);
  // eslint-disable-next-line no-console
  console.log(`Catalog seeded: ${ic} industries, ${tc} tests, ${pc} packages, ${tpc} provider links.`);
}
