import { get, post } from "@/lib/api";
import type { Order } from "@/lib/types";

// Backend-driven test catalog. All of this is served from /api/industries.

export type Strategy = "BALANCED" | "FASTEST" | "CHEAPEST" | "NEAREST";

export interface IndustryStandard { code: string; name: string; }
export interface IndustryFaq { q: string; a: string; }

export interface CatalogTestSummary {
  id: string; slug: string; name: string; category: string;
  summary: string | null; turnaroundDays: number;
  accreditation: string | null; standardCodes: string[]; providerCount: number;
}
export interface CatalogPackageSummary {
  id: string; slug: string; name: string; summary: string | null;
  pricingMode: string; discountPct: number; accreditation: string | null; itemCount: number;
}
export interface IndustryDetail {
  id: string; slug: string; title: string; icon: string | null;
  seoTitle: string | null; seoDescription: string | null;
  heroTagline: string | null; intro: string | null;
  seoKeywords: string[]; relatedCategories: string[]; faq: IndustryFaq[];
  standards: IndustryStandard[]; tests: CatalogTestSummary[]; packages: CatalogPackageSummary[];
}
export interface IndustrySummary {
  id: string; slug: string; title: string; icon: string | null;
  seoTitle: string | null; heroTagline: string | null; testCount: number; packageCount: number;
}

export interface RankedProvider {
  providerLinkId: string; serviceId: string; institutionId: string; institutionName: string;
  city: string | null; state: string | null; accreditation: string | null; accreditations: string[];
  price: number; currency: string; turnaroundDays: number; pricingMode: string;
  nextAvailableStart: string | null; estimatedCompletion: string | null; etaDays: number | null;
  queueDepth: number; rating: number | null; reviewCount: number; accredited: boolean;
  distanceKm: number | null; score: number; recommended: boolean;
}
export interface TestProcedure { stepNo: number; title: string; detail: string | null; }
export interface TestForm { name: string; description: string | null; fileUrl: string | null; required: boolean; }
export interface TestAssoc { slug: string; name: string; summary: string | null; category: string; }
export interface ConformanceRow { standard: string; clause: string; testNo: string; condition: string; severity: string; }
export interface TestDetail {
  id: string; slug: string; name: string; category: string;
  summary: string | null; purpose: string | null; description: string | null;
  standardCodes: string[]; sampleRequirements: string | null;
  samplesRequired: number; sampleDestructive: boolean; sampleReturned: boolean; deliverables: string[];
  conformanceRows: ConformanceRow[]; fixturesRequired: string[]; severityNotes: string | null;
  turnaroundDays: number; accreditation: string | null;
  industry: { slug: string; title: string; icon: string | null };
  procedures: TestProcedure[]; forms: TestForm[]; associated: TestAssoc[];
  strategy: Strategy; providers: RankedProvider[];
}

export interface PackageItemRoute {
  testId: string; testSlug: string; testName: string;
  recommended: RankedProvider | null; providerCount: number;
}
export interface PackageQuote {
  strategy: Strategy; currency: string; items: PackageItemRoute[];
  gross: number; discountPct: number; bundlePrice: number; savings: number;
  earliestStart: string | null; estimatedCompletion: string | null; pricingMode: string;
}
export interface PackageDetail {
  id: string; slug: string; name: string; summary: string | null; description: string | null;
  pricingMode: string; discountPct: number; accreditation: string | null;
  industry: { slug: string; title: string; icon: string | null };
  items: { sequence: number; optional: boolean; test: { slug: string; name: string; summary: string | null; category: string; accreditation: string | null } }[];
  strategy: Strategy; quote: PackageQuote | null;
}

export interface TechnologySummary {
  id: string; slug: string; title: string; icon: string | null; blurb: string | null; categories: string[];
}
export interface TechTest {
  id: string; slug: string; name: string; category: string; summary: string | null;
  turnaroundDays: number; accreditation: string | null; providerCount: number;
  industry: { slug: string; title: string } | null;
}
export interface TechInstrument {
  id: string; name: string; category: string; make: string | null; model: string | null;
  image: string | null; status: string;
  facility: { id: string; name: string } | null;
  institution: { id: string; name: string; slug: string; city: string | null; state: string | null } | null;
}
export interface TechFacility {
  id: string; name: string; instrumentCount: number;
  institution: { id: string; name: string; slug: string; city: string | null; state: string | null };
}
export interface TechnologyDetail extends TechnologySummary {
  serviceCount: number; tests: TechTest[]; instruments: TechInstrument[]; facilities: TechFacility[];
}

export interface PackageListItem {
  id: string; slug: string; name: string; summary: string | null;
  pricingMode: string; discountPct: number;
  industry: { slug: string; title: string } | null; itemCount: number;
}
export const fetchPackages = () => get<PackageListItem[]>("/packages");

export const fetchTechnologies = () => get<TechnologySummary[]>("/technologies");
export const fetchTechnology = (slug: string) => get<TechnologyDetail>(`/technologies/${slug}`);

export const fetchIndustries = () => get<IndustrySummary[]>("/industries");
export const fetchIndustryDetail = (slug: string) => get<IndustryDetail>(`/industries/${slug}`);
export const fetchTestDetail = (slug: string, strategy: Strategy, coords?: { lat?: number; lng?: number }) =>
  get<TestDetail>(`/tests/${slug}`, { strategy, ...coords });
export const fetchPackageDetail = (slug: string, strategy: Strategy, coords?: { lat?: number; lng?: number }) =>
  get<PackageDetail>(`/packages/${slug}`, { strategy, ...coords });
export const addPackageToCart = (body: { packageSlug: string; strategy?: Strategy; lat?: number; lng?: number }) =>
  post<Order>("/cart/package", body);
