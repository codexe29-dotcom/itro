/**
 * Scan the (production) DB for any image reference that points at a LOCAL
 * /uploads/* path. Those files live only on a developer's disk — the deploy
 * pipeline excludes server/uploads/, so seeded local files never reach prod and
 * 404 in the browser. Repoint known-local refs to real, externally-hosted URLs.
 *
 * Currently the only local ref is IIT Guwahati CIF's logo, seeded as
 * /uploads/iitg-logo.jpg. Point it at the institute's own hosted logo.
 *
 * Idempotent. Run:  npx tsx src/scripts/fix-local-image-refs.ts
 */
import { prisma } from "../db";

const IITG_LOGO = "https://www.iitg.ac.in/core/img/iitglogo.jpg";
const isLocal = (v?: string | null) => !!v && v.startsWith("/uploads/");

async function main() {
  // 1. Report every local /uploads ref so we know the true scope.
  const insts = await prisma.institution.findMany({ select: { id: true, slug: true, logoUrl: true } });
  const instruments = await prisma.instrument.findMany({ select: { id: true, name: true, imageUrl: true, images: true } });
  const services = await prisma.service.findMany({ select: { id: true, name: true, images: true } });

  const localInsts = insts.filter((i) => isLocal(i.logoUrl));
  const localInstr = instruments.filter((i) => isLocal(i.imageUrl) || i.images.some(isLocal));
  const localSvcs = services.filter((s) => s.images.some(isLocal));

  console.log("=== Local /uploads references found (won't exist on prod disk) ===");
  console.log(`Institutions (logoUrl): ${localInsts.length}`);
  localInsts.forEach((i) => console.log(`  - ${i.slug}: ${i.logoUrl}`));
  console.log(`Instruments (imageUrl/images): ${localInstr.length}`);
  localInstr.forEach((i) => console.log(`  - ${i.name}`));
  console.log(`Services (images): ${localSvcs.length}`);
  localSvcs.forEach((s) => console.log(`  - ${s.name}`));

  // 2. Fix the known one: IIT Guwahati CIF logo -> institute's hosted logo.
  const iitg = await prisma.institution.findUnique({ where: { slug: "iit-guwahati-cif" } });
  if (iitg && iitg.logoUrl !== IITG_LOGO) {
    await prisma.institution.update({ where: { id: iitg.id }, data: { logoUrl: IITG_LOGO } });
    console.log(`\nUpdated IIT Guwahati CIF logo -> ${IITG_LOGO}`);
  } else if (iitg) {
    console.log(`\nIIT Guwahati CIF logo already set to hosted URL.`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
