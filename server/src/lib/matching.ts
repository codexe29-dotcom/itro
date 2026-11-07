// Shared helpers for rich-service-detail + AI-exchange features.
// Deterministic (no external LLM): Haversine distance, category-synonym map,
// and rating aggregation over orders → reviews.

import { prisma } from "../db";

// ------------------------------------------------------------------
// Haversine distance (km) between two lat/lng points.
// ------------------------------------------------------------------
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/** Distance when both endpoints are known, else null. */
export function distanceKmOrNull(
  fromLat: number | undefined,
  fromLng: number | undefined,
  toLat: number | null | undefined,
  toLng: number | null | undefined
): number | null {
  if (
    fromLat === undefined ||
    fromLng === undefined ||
    toLat === null ||
    toLat === undefined ||
    toLng === null ||
    toLng === undefined
  ) {
    return null;
  }
  return haversineKm(fromLat, fromLng, toLat, toLng);
}

// ------------------------------------------------------------------
// Category synonym map: token → categories it implies.
// ------------------------------------------------------------------
export const CATEGORY_SYNONYMS: Record<string, string[]> = {
  cnc: ["CNC"],
  machining: ["CNC"],
  machine: ["CNC"],
  milling: ["CNC"],
  mill: ["CNC"],
  turning: ["CNC"],
  lathe: ["CNC"],
  microscope: ["SEM", "TEM"],
  microscopy: ["SEM", "TEM"],
  imaging: ["SEM", "TEM"],
  microstructure: ["SEM", "TEM"],
  fractography: ["SEM", "TEM"],
  sem: ["SEM"],
  tem: ["TEM"],
  nanoscale: ["TEM"],
  tensile: ["UTM"],
  strength: ["UTM"],
  yield: ["UTM"],
  mechanical: ["UTM"],
  utm: ["UTM"],
  fatigue: ["Fatigue"],
  cyclic: ["Fatigue"],
  "s-n": ["Fatigue"],
  sn: ["Fatigue"],
  phase: ["XRD"],
  crystalline: ["XRD"],
  crystallography: ["XRD"],
  xrd: ["XRD"],
  diffraction: ["XRD"],
  ftir: ["FTIR"],
  infrared: ["FTIR"],
  "functional group": ["FTIR"],
  nmr: ["NMR"],
  "structure elucidation": ["NMR"],
  elucidation: ["NMR"],
  "gc-ms": ["GC-MS"],
  gcms: ["GC-MS"],
  volatile: ["GC-MS"],
  "compound id": ["GC-MS"],
  compound: ["GC-MS"],
  chromatography: ["GC-MS"],
  rheology: ["Rheometer"],
  viscosity: ["Rheometer"],
  viscoelastic: ["Rheometer"],
  rheometer: ["Rheometer"],
  "3d print": ["3D Metal Printer"],
  "3d printing": ["3D Metal Printer"],
  additive: ["3D Metal Printer"],
  dmls: ["3D Metal Printer"],
  slm: ["3D Metal Printer"],
  printing: ["3D Metal Printer"],
};

export interface Interpreted {
  categories: string[];
  keywords: string[];
}

const STOPWORDS = new Set([
  "a", "an", "the", "with", "for", "and", "or", "of", "to", "in", "on",
  "at", "my", "our", "need", "want", "please", "some", "that", "this",
  "have", "has", "get", "make", "do", "can", "you", "me", "is", "are",
  "be", "it", "as", "by", "from", "into",
]);

/**
 * Interpret a free-text requirement into categories + salient keywords.
 * Checks multi-word synonym phrases first, then single tokens.
 */
export function interpretRequirement(requirement: string): Interpreted {
  const lower = requirement.toLowerCase();
  const categories = new Set<string>();

  // Multi-word phrase synonyms.
  for (const [phrase, cats] of Object.entries(CATEGORY_SYNONYMS)) {
    if (phrase.includes(" ") && lower.includes(phrase)) {
      cats.forEach((c) => categories.add(c));
    }
  }

  // Tokenize into words (keep hyphenated tokens like s-n, gc-ms).
  const tokens = lower
    .split(/[^a-z0-9-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const keywords: string[] = [];
  const seenKw = new Set<string>();
  for (const tok of tokens) {
    const cats = CATEGORY_SYNONYMS[tok];
    if (cats) cats.forEach((c) => categories.add(c));
    if (tok.length >= 3 && !STOPWORDS.has(tok) && !seenKw.has(tok)) {
      seenKw.add(tok);
      keywords.push(tok);
    }
  }

  return { categories: [...categories], keywords };
}

// ------------------------------------------------------------------
// Rating aggregation: orders → review for a set of service ids.
// Returns a map serviceId → { avg, count }.
// ------------------------------------------------------------------
export interface Rating {
  avg: number;
  count: number;
}

export async function ratingsForServices(
  serviceIds: string[]
): Promise<Map<string, Rating>> {
  const result = new Map<string, Rating>();
  if (serviceIds.length === 0) return result;

  const reviews = await prisma.review.findMany({
    where: { order: { serviceId: { in: serviceIds } } },
    select: { rating: true, order: { select: { serviceId: true } } },
  });

  const acc = new Map<string, { sum: number; count: number }>();
  for (const r of reviews) {
    const sid = r.order.serviceId;
    const cur = acc.get(sid) ?? { sum: 0, count: 0 };
    cur.sum += r.rating;
    cur.count += 1;
    acc.set(sid, cur);
  }

  for (const sid of serviceIds) {
    const a = acc.get(sid);
    if (a && a.count > 0) {
      result.set(sid, { avg: Math.round((a.sum / a.count) * 10) / 10, count: a.count });
    } else {
      result.set(sid, { avg: 0, count: 0 });
    }
  }
  return result;
}

/** Convenience for a single service. */
export async function ratingForService(serviceId: string): Promise<Rating> {
  const map = await ratingsForServices([serviceId]);
  return map.get(serviceId) ?? { avg: 0, count: 0 };
}

/** Aggregate review ratings per institution (across all of its orders). */
export async function ratingsForInstitutions(
  institutionIds: string[]
): Promise<Map<string, Rating>> {
  const result = new Map<string, Rating>();
  if (institutionIds.length === 0) return result;

  const reviews = await prisma.review.findMany({
    where: { order: { institutionId: { in: institutionIds } } },
    select: { rating: true, order: { select: { institutionId: true } } },
  });

  const acc = new Map<string, { sum: number; count: number }>();
  for (const r of reviews) {
    const iid = r.order.institutionId;
    const cur = acc.get(iid) ?? { sum: 0, count: 0 };
    cur.sum += r.rating;
    cur.count += 1;
    acc.set(iid, cur);
  }

  for (const iid of institutionIds) {
    const a = acc.get(iid);
    result.set(iid, a && a.count > 0 ? { avg: Math.round((a.sum / a.count) * 10) / 10, count: a.count } : { avg: 0, count: 0 });
  }
  return result;
}

/** Convenience for a single institution. */
export async function ratingForInstitution(institutionId: string): Promise<Rating> {
  const map = await ratingsForInstitutions([institutionId]);
  return map.get(institutionId) ?? { avg: 0, count: 0 };
}
