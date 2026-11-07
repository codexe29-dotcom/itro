import { get, post, patch, del } from "@/lib/api";

// Platform-admin catalog configuration (SUPER_ADMIN). All under /platform.

export interface AdminTest {
  id: string; slug: string; name: string; category: string;
  providerCount: number; providerServiceIds: string[];
}
export interface AdminIndustry {
  id: string; slug: string; title: string;
  testCount: number; packageCount: number; tests: AdminTest[];
}
export interface AdminService {
  id: string; name: string; category: string; priceIndustry: number;
  institution: { name: string };
}
export interface AdminPackage {
  id: string; slug: string; name: string; summary: string | null; description: string | null;
  pricingMode: string; fixedPrice: number | null; discountPct: number;
  accreditation: string | null; isActive: boolean; sampleFlow: "SHARED" | "PER_TEST";
  industry: { slug: string; title: string } | null;
  testIds: string[]; tests: { id: string; name: string; slug: string; sequence?: number; dependsOnTestId?: string | null }[];
}
export interface AdminTechnology {
  id: string; slug: string; title: string; icon: string | null; blurb: string | null;
  categories: string[]; isActive: boolean;
}
export interface AdminCatalog {
  industries: AdminIndustry[];
  packages: AdminPackage[];
  technologies: AdminTechnology[];
  categoryOptions: string[];
  services: AdminService[];
}
export interface TechnologyInput {
  title: string; icon?: string | null; blurb?: string | null; categories: string[]; isActive?: boolean;
}

export interface PackageInput {
  name: string;
  industrySlug?: string;
  summary?: string | null;
  description?: string | null;
  pricingMode: "DYNAMIC" | "FIXED";
  fixedPrice?: number | null;
  discountPct: number;
  accreditation?: string | null;
  sampleFlow?: "SHARED" | "PER_TEST";
  isActive?: boolean;
  testIds: string[];
}

export interface TestProcedureInput { title: string; detail?: string | null; }
export interface TestFormInput { name: string; description?: string | null; required?: boolean; }
export interface ConformanceRow { standard: string; clause: string; testNo: string; condition: string; severity: string; }
export interface TestFull {
  id: string; slug: string; name: string; category: string; industrySlug: string;
  summary: string | null; purpose: string | null; description: string | null; standardCodes: string[];
  sampleRequirements: string | null; samplesRequired: number; sampleDestructive: boolean;
  sampleReturned: boolean; deliverables: string[];
  conformanceRows: ConformanceRow[]; fixturesRequired: string[]; severityNotes: string | null;
  turnaroundDays: number; accreditation: string | null; isActive: boolean;
  procedures: TestProcedureInput[]; forms: TestFormInput[]; providerServiceIds: string[];
}
export interface TestInput {
  name: string; industrySlug: string; category: string;
  summary?: string | null; purpose?: string | null; description?: string | null; standardCodes: string[];
  sampleRequirements?: string | null; samplesRequired?: number; sampleDestructive?: boolean;
  sampleReturned?: boolean; deliverables?: string[];
  conformanceRows?: ConformanceRow[]; fixturesRequired?: string[]; severityNotes?: string | null;
  turnaroundDays: number; accreditation?: string | null; isActive?: boolean;
  procedures?: TestProcedureInput[]; forms?: TestFormInput[]; providerServiceIds?: string[];
}

export const fetchAdminCatalog = () => get<AdminCatalog>("/platform/catalog");
export interface TestInsights {
  industry: { slug: string; title: string };
  providers: { serviceId: string; serviceName: string; price: number; turnaroundDays: number; pricingMode: string; institution: { id: string; slug: string; name: string }; instrument: { id: string; name: string; category: string } | null }[];
  priceRange: { min: number; max: number; avg: number } | null;
  turnaroundRange: { min: number; max: number } | null;
  orders: { total: number; completed: number; active: number; byStatus: Record<string, number> };
  recentOrders: { id: string; code: string; status: string; amount: number | null; createdAt: string; buyer: { id: string; name: string; orgName: string | null }; lab: { id: string; slug: string; name: string }; service: string }[];
  packages: { id: string; slug: string; name: string }[];
}
export const fetchTestInsights = (id: string) => get<TestInsights>(`/platform/tests/${id}/insights`);
export const fetchTestFull = (id: string) => get<TestFull>(`/platform/tests/${id}`);
export const createTest = (body: TestInput) => post<{ id: string }>("/platform/tests", body);
export const updateTest = (id: string, body: Partial<TestInput>) => patch<{ id: string }>(`/platform/tests/${id}`, body);
export const deleteTest = (id: string) => del<{ ok: boolean }>(`/platform/tests/${id}`);
export interface PackageFull {
  id: string; slug: string; name: string; summary: string | null; description: string | null;
  pricingMode: string; fixedPrice: number | null; discountPct: number; accreditation: string | null;
  sampleFlow: "SHARED" | "PER_TEST"; isActive: boolean;
  industry: { slug: string; title: string } | null; industrySlug: string | null;
  testIds: string[];
  items: { testId: string; sequence: number; optional: boolean; dependsOnTestId: string | null; test: { id: string; slug: string; name: string; category: string } }[];
}
export interface PackageInsights {
  strategy?: string; currency: string;
  items: { testId: string; testSlug: string; testName: string; providerCount: number;
    recommended: { serviceId: string; institutionName: string; institutionId: string; price: number; turnaroundDays: number; pricingMode: string; accredited: boolean } | null }[];
  gross: number; discountPct: number; bundlePrice: number; savings: number;
  earliestStart?: string | null; estimatedCompletion?: string | null; pricingMode: string;
}
export const fetchPackageFull = (id: string) => get<PackageFull>(`/platform/packages/${id}`);
export const fetchPackageInsights = (id: string) => get<PackageInsights>(`/platform/packages/${id}/insights`);
export const createPackage = (body: PackageInput) => post<{ id: string }>("/platform/packages", body);
export const updatePackage = (id: string, body: Partial<PackageInput>) => patch<{ id: string }>(`/platform/packages/${id}`, body);
export const deletePackage = (id: string) => del<{ ok: boolean }>(`/platform/packages/${id}`);
export const attachProvider = (testId: string, serviceId: string) => post(`/platform/tests/${testId}/providers`, { serviceId });
export const detachProvider = (testId: string, serviceId: string) => del(`/platform/tests/${testId}/providers/${serviceId}`);

export const createTechnology = (body: TechnologyInput) => post<{ id: string }>("/platform/technologies", body);
export const updateTechnology = (id: string, body: Partial<TechnologyInput>) => patch<{ id: string }>(`/platform/technologies/${id}`, body);
export const deleteTechnology = (id: string) => del<{ ok: boolean }>(`/platform/technologies/${id}`);
