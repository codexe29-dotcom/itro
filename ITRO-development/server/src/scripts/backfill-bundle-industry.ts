/**
 * Backfill ServiceBundle.industryId for bundles that don't have one, by taking
 * the most common industry among the member services' linked catalog tests.
 * Idempotent — only touches bundles where industryId is null.
 */
import { prisma } from "../db";

async function main() {
  const bundles = await prisma.serviceBundle.findMany({
    where: { industryId: null },
    include: { items: { select: { serviceId: true } }, industry: true },
  });
  if (bundles.length === 0) { console.log("No bundles need backfilling."); return; }

  let updated = 0, skipped = 0;
  for (const b of bundles) {
    const serviceIds = b.items.map((i) => i.serviceId);
    if (serviceIds.length === 0) { skipped++; continue; }

    // Member services -> their catalog tests -> industries.
    const links = await prisma.testProvider.findMany({
      where: { serviceId: { in: serviceIds } },
      select: { test: { select: { industryId: true, industry: { select: { title: true } } } } },
    });
    const tally = new Map<string, { count: number; title: string }>();
    for (const l of links) {
      const id = l.test?.industryId;
      if (!id) continue;
      const cur = tally.get(id) ?? { count: 0, title: l.test!.industry?.title ?? id };
      cur.count += 1; tally.set(id, cur);
    }
    if (tally.size === 0) { console.log(`  — "${b.name}": no linked catalog industry, left blank`); skipped++; continue; }

    const [industryId, info] = [...tally.entries()].sort((a, b) => b[1].count - a[1].count)[0];
    await prisma.serviceBundle.update({ where: { id: b.id }, data: { industryId } });
    console.log(`  ✓ "${b.name}" → ${info.title}`);
    updated++;
  }
  console.log(`\nBackfilled ${updated} bundle(s); ${skipped} left blank (no linked industry).`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
