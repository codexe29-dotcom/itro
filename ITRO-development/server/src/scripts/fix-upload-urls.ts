/**
 * Normalise stored uploaded-file URLs to relative paths.
 * Rewrites any "http(s)://<host>/uploads/<file>" → "/uploads/<file>" so images
 * work on any host (dev via Vite proxy, prod via nginx proxy) and don't trip
 * mixed-content blocking on HTTPS pages.
 */
import { prisma } from "../db";

const rel = (v: string | null | undefined): string | null => {
  if (!v) return v ?? null;
  // Strip any "http(s)://<host>" and a stray "/api" prefix — uploads are served at /uploads.
  return v.replace(/^https?:\/\/[^/]+(?:\/api)?\/uploads\//i, "/uploads/");
};
const relArr = (a: string[] | null | undefined): string[] => (a ?? []).map((x) => rel(x)!).filter(Boolean) as string[];
const changed = (before: unknown, after: unknown) => JSON.stringify(before) !== JSON.stringify(after);

async function main() {
  let n = 0;

  const insts = await prisma.institution.findMany({ select: { id: true, logoUrl: true } });
  for (const i of insts) { const u = rel(i.logoUrl); if (changed(i.logoUrl, u)) { await prisma.institution.update({ where: { id: i.id }, data: { logoUrl: u } }); n++; } }

  const instr = await prisma.instrument.findMany({ select: { id: true, imageUrl: true, images: true } });
  for (const i of instr) { const iu = rel(i.imageUrl), im = relArr(i.images); if (changed(i.imageUrl, iu) || changed(i.images, im)) { await prisma.instrument.update({ where: { id: i.id }, data: { imageUrl: iu, images: im } }); n++; } }

  const svcs = await prisma.service.findMany({ select: { id: true, images: true } });
  for (const s of svcs) { const im = relArr(s.images); if (changed(s.images, im)) { await prisma.service.update({ where: { id: s.id }, data: { images: im } }); n++; } }

  const experts = await prisma.expert.findMany({ select: { id: true, photoUrl: true } });
  for (const e of experts) { const p = rel(e.photoUrl); if (changed(e.photoUrl, p)) { await prisma.expert.update({ where: { id: e.id }, data: { photoUrl: p } }); n++; } }

  const orders = await prisma.serviceOrder.findMany({ where: { reportUrl: { not: null } }, select: { id: true, reportUrl: true } });
  for (const o of orders) { const r = rel(o.reportUrl); if (changed(o.reportUrl, r)) { await prisma.serviceOrder.update({ where: { id: o.id }, data: { reportUrl: r } }); n++; } }

  const docs = await prisma.orderDocument.findMany({ select: { id: true, url: true } });
  for (const d of docs) { const u = rel(d.url); if (changed(d.url, u)) { await prisma.orderDocument.update({ where: { id: d.id }, data: { url: u! } }); n++; } }

  const idocs = await prisma.instrumentDocument.findMany({ select: { id: true, url: true } });
  for (const d of idocs) { const u = rel(d.url); if (changed(d.url, u)) { await prisma.instrumentDocument.update({ where: { id: d.id }, data: { url: u! } }); n++; } }

  console.log(`Normalised ${n} record(s) to relative /uploads/ URLs.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
