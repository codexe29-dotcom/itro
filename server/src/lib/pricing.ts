import type { Institution } from "@prisma/client";
import { prisma } from "../db";

/**
 * Platform-fee engine.
 *
 * Effective fee = per-provider override (Institution.feeMode/feeValue when set)
 * else the singleton "global" PlatformSetting. Money is rounded to whole units.
 */

export type FeeMode = "MARKUP_PERCENT" | "FIXED_FEE" | "SETTLEMENT_DEDUCTION";

export interface Fee {
  mode: FeeMode;
  value: number;
}

export interface Breakdown {
  providerAmount: number;   // what flows to the provider
  platformFeeAmount: number; // platform take
  buyerAmount: number;       // fee-inclusive buyer-facing amount
}

function round(n: number): number {
  return Math.round(n);
}

/** Fetch (creating if missing) the singleton "global" PlatformSetting row. */
export async function getGlobalSetting() {
  return prisma.platformSetting.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" },
  });
}

/**
 * Resolve the effective fee for an institution: per-provider override if both
 * feeMode & feeValue are set, otherwise the global platform setting.
 */
export async function resolveFee(
  institution: Pick<Institution, "feeMode" | "feeValue"> | null | undefined
): Promise<Fee> {
  if (institution && institution.feeMode && institution.feeValue != null) {
    return { mode: institution.feeMode as FeeMode, value: institution.feeValue };
  }
  const global = await getGlobalSetting();
  return { mode: global.feeMode as FeeMode, value: global.feeValue };
}

/**
 * Given a provider price and an effective fee, compute the money breakdown.
 * providerPrice is the raw per-line total (already multiplied by quantity if any).
 */
export function computeBreakdown(providerPrice: number, fee: Fee): Breakdown {
  switch (fee.mode) {
    case "MARKUP_PERCENT": {
      const buyerAmount = round(providerPrice * (1 + fee.value / 100));
      return {
        providerAmount: providerPrice,
        platformFeeAmount: buyerAmount - providerPrice,
        buyerAmount,
      };
    }
    case "FIXED_FEE": {
      const buyerAmount = round(providerPrice + fee.value);
      return {
        providerAmount: providerPrice,
        platformFeeAmount: round(fee.value),
        buyerAmount,
      };
    }
    case "SETTLEMENT_DEDUCTION": {
      const platformFeeAmount = round((providerPrice * fee.value) / 100);
      return {
        providerAmount: providerPrice - platformFeeAmount,
        platformFeeAmount,
        buyerAmount: providerPrice,
      };
    }
    default: {
      return { providerAmount: providerPrice, platformFeeAmount: 0, buyerAmount: providerPrice };
    }
  }
}

/**
 * Attach a fee-inclusive `buyerPrice` to a service given its institution.
 * Uses priceIndustry as the provider base. Returns the service enriched with
 * `buyerPrice`; `pricingMode` is already on the service.
 */
/** Provider base price after a standing service-level discount (fee-on-discounted). */
export function discountedBase(priceIndustry: number, discountPct?: number | null): number {
  const d = discountPct ?? 0;
  return d > 0 ? round(priceIndustry * (1 - d / 100)) : priceIndustry;
}

export async function attachBuyerPrice<
  T extends { priceIndustry: number; discountPct?: number; institution?: Pick<Institution, "feeMode" | "feeValue"> | null }
>(service: T, institution?: Pick<Institution, "feeMode" | "feeValue"> | null): Promise<T & { buyerPrice: number; listPrice: number }> {
  const inst = institution ?? service.institution ?? null;
  const fee = await resolveFee(inst);
  const disc = service.discountPct ?? 0;
  const { buyerAmount } = computeBreakdown(discountedBase(service.priceIndustry, disc), fee);
  const listPrice = disc > 0 ? computeBreakdown(service.priceIndustry, fee).buyerAmount : buyerAmount;
  return { ...service, buyerPrice: buyerAmount, listPrice };
}

/**
 * Batch helper: attach `buyerPrice` to many services efficiently. Institutions
 * are resolved once; the global setting is fetched once.
 */
export async function attachBuyerPrices<
  T extends { priceIndustry: number; discountPct?: number; institution?: Pick<Institution, "feeMode" | "feeValue"> | null }
>(services: T[]): Promise<(T & { buyerPrice: number; listPrice: number })[]> {
  const global = await getGlobalSetting();
  const globalFee: Fee = { mode: global.feeMode as FeeMode, value: global.feeValue };
  return services.map((s) => {
    const inst = s.institution;
    const fee: Fee =
      inst && inst.feeMode && inst.feeValue != null
        ? { mode: inst.feeMode as FeeMode, value: inst.feeValue }
        : globalFee;
    const disc = s.discountPct ?? 0;
    const { buyerAmount } = computeBreakdown(discountedBase(s.priceIndustry, disc), fee);
    const listPrice = disc > 0 ? computeBreakdown(s.priceIndustry, fee).buyerAmount : buyerAmount;
    return { ...s, buyerPrice: buyerAmount, listPrice };
  });
}
