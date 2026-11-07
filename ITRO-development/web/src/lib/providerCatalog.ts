import { get, post, del } from "@/lib/api";

// Provider (lab) self-service catalog + platform review queue.

export interface ProvTest { id: string; slug: string; name: string; category: string; accreditation: string | null; summary: string | null; }
export interface ProvIndustry { slug: string; title: string; tests: ProvTest[]; }
export interface ProvService { id: string; name: string; category: string; priceIndustry: number; }
export interface ProvEnrollment { testId: string; serviceId: string; }
export interface ProvInstrument { id: string; name: string; category: string; }
export interface ProviderCatalog {
  industries: ProvIndustry[];
  myServices: ProvService[];
  enrollments: ProvEnrollment[];
  instruments: ProvInstrument[];
}
export interface OfferInput {
  name?: string;
  priceIndustry: number;
  pricingMode: "FIXED" | "QUOTE";
  turnaroundDays: number;
  instrumentId?: string | null;
  rushDays?: number | null;
  rushSurchargePct?: number | null;
}

export interface TestRequest {
  id: string; name: string; category: string; summary: string | null; description: string | null;
  standardCodes: string[]; sampleRequirements: string | null; turnaroundDays: number;
  serviceId: string | null; status: "PENDING" | "APPROVED" | "REJECTED"; reviewNote: string | null;
  createdTestId: string | null; createdAt: string;
  industry?: { title: string } | null;
  institution?: { name: string };
}
export interface TestRequestInput {
  name: string; industrySlug?: string; category: string;
  summary?: string | null; description?: string | null; standardCodes: string[];
  sampleRequirements?: string | null; turnaroundDays: number; serviceId?: string | null;
}

export interface ProviderSetup {
  facilities: number; instruments: number; services: number;
  servicesWithInstrument: number; enrollments: number;
  profileComplete: boolean; isPublished: boolean;
}
export const fetchProviderSetup = () => get<ProviderSetup>("/provider/setup");

// Provider
export const fetchProviderCatalog = () => get<ProviderCatalog>("/provider/catalog");
export const enrollService = (testId: string, serviceId: string) => post(`/provider/tests/${testId}/enroll`, { serviceId });
export const offerTest = (testId: string, body: OfferInput) => post(`/provider/tests/${testId}/offer`, body);
export interface CreateOfferInput {
  name: string; industrySlug: string; category: string; standardCodes?: string[]; summary?: string | null;
  priceIndustry: number; pricingMode: "FIXED" | "QUOTE"; turnaroundDays: number; instrumentId?: string | null;
}
export const createAndOfferTest = (body: CreateOfferInput) => post<{ test: { id: string }; service: { id: string } }>("/provider/tests/create-and-offer", body);
export const unenrollService = (testId: string, serviceId: string) => del(`/provider/tests/${testId}/enroll/${serviceId}`);
export const submitTestRequest = (body: TestRequestInput) => post<TestRequest>("/provider/test-requests", body);
export const fetchMyTestRequests = () => get<TestRequest[]>("/provider/test-requests");

// Platform review
export const fetchTestRequests = (status?: string) => get<TestRequest[]>("/platform/test-requests", status ? { status } : undefined);
export const approveTestRequest = (id: string, body?: { industrySlug?: string; category?: string }) => post<{ ok: boolean; slug: string }>(`/platform/test-requests/${id}/approve`, body ?? {});
export const rejectTestRequest = (id: string, note?: string) => post(`/platform/test-requests/${id}/reject`, { note });
