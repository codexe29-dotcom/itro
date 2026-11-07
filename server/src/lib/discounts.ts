import { prisma } from "../db";
import { AppError } from "../http";
import { computeBreakdown, type Fee } from "./pricing";

/**
 * Discount & credit engine.
 *
 * One primitive — `applyLineReduction` — handles every discount source
 * (coupon, credit, service-level, quote-level, bundle-level). A discount always
 * carries a `funder`:
 *   PROVIDER → fee is recomputed on the discounted price (the platform fee
 *              shrinks proportionally; the provider bears the discount).
 *   PLATFORM → the platform absorbs it (buyer pays less, provider is untouched,
 *              the platform fee is reduced).
 */

export type Funder = "PLATFORM" | "PROVIDER";

export interface WorkingLine {
  lineId: string;
  institutionId: string;
  serviceId: string;
  category: string;
  fee: Fee;
  providerAmount: number;
  platformFeeAmount: number;
  buyerAmount: number;
  discount: number; // accumulated buyer-facing reduction on this line
}

const round = (n: number) => Math.round(n);

/** Reduce a line's buyer price by `amount`, allocating the cost to the funder. Returns the actual reduction. */
export function applyLineReduction(line: WorkingLine, amount: number, funder: Funder): number {
  const cut = Math.min(round(amount), line.buyerAmount);
  if (cut <= 0) return 0;
  const before = line.buyerAmount;
  if (funder === "PROVIDER") {
    // Fee-on-discounted: shrink the provider base by the same fraction, recompute.
    const frac = cut / before;
    const newBase = round(line.providerAmount * (1 - frac));
    const bd = computeBreakdown(newBase, line.fee);
    line.providerAmount = bd.providerAmount;
    line.platformFeeAmount = bd.platformFeeAmount;
    line.buyerAmount = bd.buyerAmount;
  } else {
    line.buyerAmount = round(line.buyerAmount - cut);
    line.platformFeeAmount = round(line.platformFeeAmount - cut); // platform absorbs (may go negative = subsidy)
  }
  const actual = before - line.buyerAmount;
  line.discount += actual;
  return actual;
}

/** Allocate a total discount across lines proportionally to their buyer amount. */
export function allocateAcross(lines: WorkingLine[], total: number, funder: Funder): number {
  const base = lines.reduce((s, l) => s + l.buyerAmount, 0);
  if (base <= 0 || total <= 0) return 0;
  let applied = 0;
  lines.forEach((l, i) => {
    // Last line soaks up rounding remainder.
    const share = i === lines.length - 1 ? total - applied : round((total * l.buyerAmount) / base);
    applied += applyLineReduction(l, share, funder);
  });
  return applied;
}

// ---- Coupons ------------------------------------------------------------
export function eligibleLinesFor(coupon: any, lines: WorkingLine[]): WorkingLine[] {
  return lines.filter((l) => {
    if (coupon.funder === "PROVIDER" && coupon.institutionId && l.institutionId !== coupon.institutionId) return false;
    if (coupon.appliesTo === "CATEGORY") return (coupon.categories ?? []).includes(l.category);
    if (coupon.appliesTo === "SERVICE") return (coupon.serviceIds ?? []).includes(l.serviceId);
    return true;
  });
}

export function couponDiscountAmount(coupon: any, eligibleSubtotal: number): number {
  let amt = coupon.kind === "PERCENT" ? (eligibleSubtotal * coupon.value) / 100 : coupon.value;
  if (coupon.kind === "PERCENT" && coupon.maxDiscount != null) amt = Math.min(amt, coupon.maxDiscount);
  return round(Math.min(amt, eligibleSubtotal));
}

/** Validate a coupon for a buyer + cart; throws AppError with a friendly message. */
export async function loadValidCoupon(code: string, buyerId: string, lines: WorkingLine[]) {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!coupon || !coupon.isActive) throw new AppError(400, "Invalid or inactive discount code");
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) throw new AppError(400, "This code isn't active yet");
  if (coupon.endsAt && coupon.endsAt < now) throw new AppError(400, "This code has expired");
  if (coupon.usageLimit != null && coupon.timesUsed >= coupon.usageLimit) throw new AppError(400, "This code has reached its usage limit");
  if (coupon.perBuyerLimit > 0) {
    const used = await prisma.couponRedemption.count({ where: { couponId: coupon.id, buyerId } });
    if (used >= coupon.perBuyerLimit) throw new AppError(400, "You have already used this code");
  }
  const eligible = eligibleLinesFor(coupon, lines);
  const eligibleSubtotal = eligible.reduce((s, l) => s + l.buyerAmount, 0);
  if (eligibleSubtotal <= 0) throw new AppError(400, "This code doesn't apply to any item in your cart");
  if (coupon.minOrder && eligibleSubtotal < coupon.minOrder) throw new AppError(400, `This code needs a minimum eligible total of ${coupon.minOrder}`);
  return { coupon, eligible, eligibleSubtotal, discount: couponDiscountAmount(coupon, eligibleSubtotal) };
}

// ---- Credits (wallet) ---------------------------------------------------
export interface CreditSummary { platform: number; byInstitution: Record<string, number>; total: number; }

/** Buyer wallet balance, split into platform-wide credits and provider-restricted credits. */
export async function creditSummary(buyerId: string): Promise<CreditSummary> {
  const now = new Date();
  const rows = await prisma.creditEntry.findMany({
    where: { buyerId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    select: { amount: true, funder: true, institutionId: true },
  });
  let platform = 0;
  const byInstitution: Record<string, number> = {};
  for (const r of rows) {
    if (r.funder === "PROVIDER" && r.institutionId) byInstitution[r.institutionId] = (byInstitution[r.institutionId] ?? 0) + r.amount;
    else platform += r.amount;
  }
  const total = platform + Object.values(byInstitution).reduce((a, b) => a + b, 0);
  return { platform: Math.max(0, round(platform)), byInstitution, total: Math.max(0, round(total)) };
}
