import { prisma } from "../db";

// Exact taxonomy titles (must match web/src/lib/taxonomy.tsx so the UI links/filters work).
const INDUSTRIES = ["Aerospace & Defense", "Robotics & Drones", "Automotive & EV", "Electronics & Semiconductors", "Energy & Power"];

async function main() {
  const inst = await prisma.institution.findUnique({ where: { slug: "adart" } });
  if (!inst) throw new Error("ADART not found");

  const instruments = await prisma.instrument.findMany({ where: { facility: { institutionId: inst.id } }, select: { id: true } });
  for (const i of instruments) await prisma.instrument.update({ where: { id: i.id }, data: { industries: INDUSTRIES } });

  // Diagnostics: equipment <-> service links, and catalog (TestProvider) status.
  const services = await prisma.service.findMany({
    where: { institutionId: inst.id },
    select: { id: true, name: true, instrumentId: true, instrument: { select: { name: true } }, _count: { select: { testProviders: true } } },
  });
  const linked = services.filter((s) => s.instrumentId).length;
  const inCatalog = services.filter((s) => s._count.testProviders > 0).length;
  console.log(`Instruments updated with industries: ${instruments.length}`);
  console.log(`Services: ${services.length} | linked to an instrument: ${linked} | enrolled in global catalog (TestProvider): ${inCatalog}`);
  console.log("Sample link:", services.slice(0, 3).map((s) => `${s.name} -> ${s.instrument?.name ?? "NONE"}`).join(" | "));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
