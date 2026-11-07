import { get, post, patch, del } from "@/lib/api";

export interface BundleQuoteItem {
  serviceId: string; name: string; category: string; listPrice: number; price: number;
  turnaroundDays?: number; accreditation?: string | null; deliverable?: string | null;
  images?: string[]; rating?: { avg: number; count: number };
}
export interface BundleQuote { items: BundleQuoteItem[]; gross: number; bundlePrice: number; savings: number; discountPct: number; }
export interface BundleIndustry { slug: string; title: string; }
export interface Bundle {
  id: string; slug: string; name: string; description: string | null; discountPct: number;
  images: string[]; isActive: boolean; industry: BundleIndustry | null;
  items: { serviceId: string; service: { id: string; name: string; category: string; priceIndustry: number } }[];
  quote: BundleQuote;
}
export interface BundleInput {
  name: string; description?: string | null; industrySlug?: string | null; discountPct: number; serviceIds: string[];
  images?: string[]; isActive?: boolean;
}
export interface PublicBundle {
  id: string; slug: string; name: string; description: string | null; images: string[]; discountPct: number;
  industry: BundleIndustry | null;
  quote: BundleQuote;
  institution?: { id?: string; name: string; slug: string; city: string | null; state: string | null; currency: string };
}

export const fetchBundles = () => get<Bundle[]>("/bundles");
export const createBundle = (body: BundleInput) => post<Bundle>("/bundles", body);
export const updateBundle = (id: string, body: Partial<BundleInput>) => patch<Bundle>(`/bundles/${id}`, body);
export const deleteBundle = (id: string) => del<void>(`/bundles/${id}`);

export const fetchLabBundles = (slug: string) => get<PublicBundle[]>(`/bundles/lab/${slug}`);
export const fetchBrowseBundles = (industry?: string) => get<PublicBundle[]>("/bundles/browse", industry ? { industry } : undefined);
export const fetchPublicBundle = (slug: string) => get<PublicBundle>(`/bundles/public/${slug}`);
export const addBundleToCart = (bundleSlug: string) => post("/cart/bundle", { bundleSlug });
