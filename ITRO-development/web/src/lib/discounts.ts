import { get, post, patch, del } from "@/lib/api";

export interface Coupon {
  id: string; code: string; name: string; kind: "PERCENT" | "FIXED"; value: number;
  funder: "PLATFORM" | "PROVIDER"; institutionId: string | null;
  appliesTo: "ALL" | "CATEGORY" | "SERVICE"; categories: string[]; serviceIds: string[];
  minOrder: number; maxDiscount: number | null; startsAt: string | null; endsAt: string | null;
  usageLimit: number | null; perBuyerLimit: number; timesUsed: number; isActive: boolean;
  createdAt: string; _count?: { redemptions: number }; institution?: { name: string } | null;
}
export interface CouponInput {
  code: string; name: string; kind: "PERCENT" | "FIXED"; value: number;
  funder?: "PLATFORM" | "PROVIDER"; institutionId?: string | null;
  appliesTo?: "ALL" | "CATEGORY" | "SERVICE"; categories?: string[]; serviceIds?: string[];
  minOrder?: number; maxDiscount?: number | null; startsAt?: string | null; endsAt?: string | null;
  usageLimit?: number | null; perBuyerLimit?: number; isActive?: boolean;
}
export interface CreditEntry {
  id: string; type: string; amount: number; funder: string; institutionId: string | null;
  reason: string | null; expiresAt: string | null; createdAt: string;
  institution?: { name: string } | null;
  buyer?: { name: string; orgName: string | null; email: string } | null;
}
export interface Wallet { platform: number; byInstitution: Record<string, number>; total: number; ledger: CreditEntry[]; }
export interface CartDiscountPreview {
  grossSubtotal: number; couponCode: string | null; discountAmount: number;
  creditApplied: number; newSubtotal: number; walletBalance: number; error: string | null;
}

export const fetchCoupons = () => get<Coupon[]>("/coupons");
export const createCoupon = (body: CouponInput) => post<Coupon>("/coupons", body);
export const updateCoupon = (id: string, body: Partial<CouponInput>) => patch<Coupon>(`/coupons/${id}`, body);
export const deleteCoupon = (id: string) => del<void>(`/coupons/${id}`);

export const fetchMyWallet = () => get<Wallet>("/credits/me");
export const issueCredit = (body: { buyerEmail: string; amount: number; reason?: string; expiresAt?: string | null }) =>
  post<{ entry: CreditEntry; buyerBalance: number }>("/credits/issue", body);
export const fetchIssuedCredits = () => get<CreditEntry[]>("/credits/issued");

export const previewCartDiscount = (body: { couponCode?: string; useCredits?: boolean }) =>
  post<CartDiscountPreview>("/cart/preview-discount", body);
