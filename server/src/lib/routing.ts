// Provider routing / selection engine.
//
// Given a catalog test, rank the provider offerings (Services) by a buyer-chosen
// STRATEGY — Cheapest, Fastest, Balanced or Nearest — using real price, live
// schedule (estimateSchedule: ETA / availability / queue), accreditation match,
// rating and proximity. The top-ranked provider is the "recommended" one; the
// package price + ETA are derived from the recommended providers per strategy.

import { prisma } from "../db";
import { estimateSchedule } from "./scheduling";

export type Strategy = "BALANCED" | "FASTEST" | "CHEAPEST" | "NEAREST";
const DAY = 24 * 60 * 60 * 1000;

export interface RoutingPrefs {
  strategy?: Strategy;
  lat?: number;
  lng?: number;
}

export interface RankedProvider {
  providerLinkId: string;
  serviceId: string;
  institutionId: string;
  institutionName: string;
  city: string | null;
  state: string | null;
  accreditation: string | null;
  accreditations: string[];
  price: number;
  currency: string;
  turnaroundDays: number;
  pricingMode: string;
  nextAvailableStart: string | null;
  estimatedCompletion: string | null;
  etaDays: number | null;
  queueDepth: number;
  rating: number | null;
  reviewCount: number;
  accredited: boolean;
  distanceKm: number | null;
  score: number;
  recommended: boolean;
}

const WEIGHTS: Record<Strategy, { price: number; speed: number; accred: number; rating: number; prox: number }> = {
  BALANCED: { price: 0.30, speed: 0.30, accred: 0.20, rating: 0.15, prox: 0.05 },
  FASTEST: { price: 0.15, speed: 0.55, accred: 0.20, rating: 0.10, prox: 0.0 },
  CHEAPEST: { price: 0.55, speed: 0.15, accred: 0.20, rating: 0.10, prox: 0.0 },
  NEAREST: { price: 0.20, speed: 0.20, accred: 0.15, rating: 0.0, prox: 0.45 },
};

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Min-max normalize to [0,1]; higherBetter=false inverts (used for price/time/distance). */
function normalize(values: (number | null)[], higherBetter: boolean): (number | null)[] {
  const present = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (present.length === 0) return values.map(() => null);
  const min = Math.min(...present);
  const max = Math.max(...present);
  if (max === min) return values.map((v) => (v == null ? null : 1));
  return values.map((v) => {
    if (v == null || !Number.isFinite(v)) return null;
    const n = (v - min) / (max - min);
    return higherBetter ? n : 1 - n;
  });
}

interface RawCandidate {
  providerLinkId: string;
  serviceId: string;
  institutionId: string;
  institutionName: string;
  city: string | null;
  state: string | null;
  accreditation: string | null;
  accreditations: string[];
  price: number;
  currency: string;
  turnaroundDays: number;
  pricingMode: string;
  instrumentId: string | null;
  lat: number | null;
  lng: number | null;
}

/** Rank all providers of a single test. `requiredAccreditation` is a hard filter (soft fallback if it empties the set). */
export async function rankTestProviders(
  testId: string,
  requiredAccreditation: string | null,
  prefs: RoutingPrefs,
  now = new Date()
): Promise<RankedProvider[]> {
  const strategy: Strategy = prefs.strategy ?? "BALANCED";
  const links = await prisma.testProvider.findMany({
    where: { testId, service: { isActive: true } },
    include: { service: { include: { institution: true } } },
  });
  if (links.length === 0) return [];

  const serviceIds = links.map((l) => l.serviceId);
  // Ratings per service (avg + count) from completed reviews.
  const reviews = await prisma.review.findMany({
    where: { order: { serviceId: { in: serviceIds } } },
    select: { rating: true, order: { select: { serviceId: true } } },
  });
  const ratingAgg: Record<string, { sum: number; n: number }> = {};
  for (const r of reviews) {
    const sid = r.order.serviceId;
    (ratingAgg[sid] ??= { sum: 0, n: 0 });
    ratingAgg[sid].sum += r.rating;
    ratingAgg[sid].n += 1;
  }

  const candidates: RawCandidate[] = links.map((l) => ({
    providerLinkId: l.id,
    serviceId: l.serviceId,
    institutionId: l.service.institutionId,
    institutionName: l.service.institution.name,
    city: l.service.institution.city,
    state: l.service.institution.state,
    accreditation: l.service.accreditation,
    accreditations: l.service.institution.accreditations,
    price: l.priceOverride ?? l.service.priceIndustry,
    currency: l.service.institution.currency,
    turnaroundDays: l.service.turnaroundDays,
    pricingMode: l.service.pricingMode,
    instrumentId: l.service.instrumentId,
    lat: l.service.institution.latitude,
    lng: l.service.institution.longitude,
  }));

  // Hard accreditation filter (soft fallback: if nothing qualifies, keep all).
  const qualifies = (c: RawCandidate) =>
    !requiredAccreditation ||
    c.accreditations.includes(requiredAccreditation) ||
    (c.accreditation ?? "").includes(requiredAccreditation);
  const filtered = candidates.filter(qualifies);
  const pool = filtered.length > 0 ? filtered : candidates;

  // Live schedule per provider (parallel).
  const schedules = await Promise.all(
    pool.map((c) => estimateSchedule({ instrumentId: c.instrumentId, turnaroundDays: c.turnaroundDays }, now))
  );

  const prices = pool.map((c) => c.price);
  const etaDaysArr = schedules.map((s) =>
    s.estimatedCompletion ? Math.max(0, (new Date(s.estimatedCompletion).getTime() - now.getTime()) / DAY) : null
  );
  const availDaysArr = schedules.map((s) =>
    s.nextAvailableStart ? Math.max(0, (new Date(s.nextAvailableStart).getTime() - now.getTime()) / DAY) : null
  );
  const ratingArr = pool.map((c) => (ratingAgg[c.serviceId] ? ratingAgg[c.serviceId].sum / ratingAgg[c.serviceId].n : null));
  const distArr = pool.map((c) =>
    prefs.lat != null && prefs.lng != null && c.lat != null && c.lng != null
      ? haversineKm(prefs.lat, prefs.lng, c.lat, c.lng)
      : null
  );

  const priceN = normalize(prices, false);
  const etaN = normalize(etaDaysArr, false);
  const availN = normalize(availDaysArr, false);
  const ratingN = normalize(ratingArr, true);
  const distN = normalize(distArr, false);
  const hasProx = distArr.some((d) => d != null);
  const hasRating = ratingArr.some((r) => r != null);

  const w = WEIGHTS[strategy];

  const ranked: RankedProvider[] = pool.map((c, i) => {
    // Combined speed = blend of ETA and availability (fall back to whichever exists).
    const speedParts = [etaN[i], availN[i]].filter((v): v is number => v != null);
    const speed = speedParts.length ? speedParts.reduce((a, b) => a + b, 0) / speedParts.length : null;

    const dims: { val: number | null; weight: number }[] = [
      { val: priceN[i], weight: w.price },
      { val: speed, weight: w.speed },
      { val: qualifies(c) ? 1 : 0, weight: w.accred },
      { val: hasRating ? ratingN[i] : null, weight: w.rating },
      { val: hasProx ? distN[i] : null, weight: w.prox },
    ];
    let num = 0;
    let den = 0;
    for (const d of dims) {
      if (d.val == null || d.weight === 0) continue;
      num += d.val * d.weight;
      den += d.weight;
    }
    const score = den > 0 ? num / den : 0;

    return {
      providerLinkId: c.providerLinkId,
      serviceId: c.serviceId,
      institutionId: c.institutionId,
      institutionName: c.institutionName,
      city: c.city,
      state: c.state,
      accreditation: c.accreditation,
      accreditations: c.accreditations,
      price: c.price,
      currency: c.currency,
      turnaroundDays: c.turnaroundDays,
      pricingMode: c.pricingMode,
      nextAvailableStart: schedules[i].nextAvailableStart,
      estimatedCompletion: schedules[i].estimatedCompletion,
      etaDays: etaDaysArr[i] != null ? Math.round(etaDaysArr[i] as number) : null,
      queueDepth: schedules[i].queueDepth,
      rating: ratingArr[i],
      reviewCount: ratingAgg[c.serviceId]?.n ?? 0,
      accredited: qualifies(c),
      distanceKm: distArr[i] != null ? Math.round(distArr[i] as number) : null,
      score: Math.round(score * 1000) / 1000,
      recommended: false,
    };
  });

  // Choose the recommended provider by the STRATEGY's primary intent so the buyer's
  // choice visibly changes the pick + price. Extremes sort hard on their axis (with
  // sensible tie-breaks); BALANCED uses the weighted score.
  const eta = (r: RankedProvider) => (r.etaDays == null ? Number.POSITIVE_INFINITY : r.etaDays);
  const dist = (r: RankedProvider) => (r.distanceKm == null ? Number.POSITIVE_INFINITY : r.distanceKm);
  ranked.sort((a, b) => {
    switch (strategy) {
      case "CHEAPEST":
        return a.price - b.price || eta(a) - eta(b) || b.score - a.score;
      case "FASTEST":
        return eta(a) - eta(b) || a.price - b.price || b.score - a.score;
      case "NEAREST":
        return dist(a) - dist(b) || a.price - b.price || b.score - a.score;
      default:
        return b.score - a.score;
    }
  });
  if (ranked[0]) ranked[0].recommended = true;
  return ranked;
}

export interface PackageItemRoute {
  testId: string;
  testSlug: string;
  testName: string;
  recommended: RankedProvider | null;
  providerCount: number;
}

export interface PackageQuote {
  strategy: Strategy;
  currency: string;
  items: PackageItemRoute[];
  gross: number;          // Σ recommended provider prices
  discountPct: number;
  bundlePrice: number;    // FIXED price, or gross×(1−discount) for DYNAMIC
  savings: number;        // gross − bundlePrice
  earliestStart: string | null;
  estimatedCompletion: string | null; // critical path (max across tests)
  pricingMode: string;
}

/** Route every test in a package with the chosen strategy and roll up price + critical-path ETA. */
export async function quotePackage(packageSlug: string, prefs: RoutingPrefs, now = new Date()): Promise<PackageQuote | null> {
  const pkg = await prisma.testPackage.findUnique({
    where: { slug: packageSlug },
    include: { items: { orderBy: { sequence: "asc" }, include: { test: true } } },
  });
  if (!pkg) return null;
  const strategy: Strategy = prefs.strategy ?? "BALANCED";

  const items: PackageItemRoute[] = await Promise.all(
    pkg.items.map(async (it) => {
      const ranked = await rankTestProviders(it.testId, it.test.accreditation, prefs, now);
      return {
        testId: it.testId,
        testSlug: it.test.slug,
        testName: it.test.name,
        recommended: ranked.find((r) => r.recommended) ?? null,
        providerCount: ranked.length,
      };
    })
  );

  const chosen = items.map((i) => i.recommended).filter((r): r is RankedProvider => !!r);
  const currency = chosen[0]?.currency ?? "INR";
  const gross = chosen.reduce((n, r) => n + r.price, 0);
  const isFixed = pkg.pricingMode === "FIXED" && pkg.fixedPrice != null;
  const bundlePrice = isFixed ? (pkg.fixedPrice as number) : Math.round(gross * (1 - pkg.discountPct / 100));
  const completions = chosen.map((r) => r.estimatedCompletion).filter((d): d is string => !!d);
  const starts = chosen.map((r) => r.nextAvailableStart).filter((d): d is string => !!d);

  return {
    strategy,
    currency,
    items,
    gross,
    discountPct: pkg.discountPct,
    bundlePrice,
    savings: Math.max(0, gross - bundlePrice),
    earliestStart: starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : null,
    estimatedCompletion: completions.length ? completions.reduce((a, b) => (a > b ? a : b)) : null,
    pricingMode: pkg.pricingMode,
  };
}
