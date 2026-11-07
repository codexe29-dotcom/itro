import { api, get, post, patch, del } from "@/lib/api";
import type {
  AnalyticsSummary, Booking, Facility, Institution, Instrument, Invoice,
  Paginated, Service, ServiceOrder, Settlement, User,
  ServiceDetail, Availability, SimilarService, RecommendedService,
  ReviewsResponse, AiSearchResponse, PublicInstrument, Expert,
  PlatformAnalytics, ProviderRow, ProviderDetail, BuyerRow, BuyerDetail,
  Order, PlatformFeeConfig, FeeMode, AccreditationRecord,
} from "@/lib/types";

/**
 * Typed query-fn helpers. Pages call these inside useQuery to keep the
 * data-fetching layer thin and consistent. Every one hits a real API endpoint.
 */

// Exchange (public)
export interface ExchangeFilters {
  q?: string; category?: string; accreditation?: string;
  institutionId?: string; maxPrice?: number; maxTurnaround?: number;
  minRating?: number; availableNow?: boolean; sort?: string;
  page?: number; pageSize?: number;
}
export const fetchExchangeServices = (f: ExchangeFilters = {}) =>
  get<Paginated<Service>>("/exchange/services", clean(f));
export const fetchExchangeCategories = () =>
  get<{ category: string; count: number }[]>("/exchange/categories");
export const fetchExchangeFacets = () =>
  get<import("@/lib/types").ExchangeFacets>("/exchange/facets");

// Institutions - endpoint may return an array OR a paginated envelope; normalise to an array.
export const fetchInstitutions = async () => {
  const res = await get<Institution[] | Paginated<Institution>>("/institutions");
  return Array.isArray(res) ? res : res.data;
};
export const fetchInstitution = (slug: string) => get<Institution>(`/institutions/${slug}`);

// Services (admin scoped) + public detail
export const fetchServices = async (params?: object) =>
  asList(await get<Service[] | Paginated<Service>>("/services", params));
export const fetchService = (id: string) => get<ServiceDetail>(`/services/${id}`);

// v2 - rich service detail
export const fetchServiceAvailability = (id: string, days = 10) =>
  get<Availability>(`/services/${id}/availability`, { days });
export const fetchSimilarServices = (id: string, coords?: { lat?: number; lng?: number }) =>
  get<SimilarService[]>(`/services/${id}/similar`, clean(coords ?? {}));
export const fetchRecommendedServices = (id: string) =>
  get<RecommendedService[]>(`/services/${id}/recommended`);
export const fetchServiceReviews = (id: string) =>
  get<ReviewsResponse>(`/services/${id}/reviews`);

export interface ServiceInsights {
  fulfilledTests: { id: string; slug: string; name: string; category: string; samplesRequired: number; sampleRequirements: string | null; sampleDestructive: boolean; sampleReturned: boolean; deliverables: string[]; forms: { name: string; required: boolean }[] }[];
  orders: { total: number; active: number; completed: number };
  recentOrders: { id: string; code: string; status: string; amount: number | null; createdAt: string; buyer: { id: string; name: string; orgName: string | null } }[];
}
export const fetchServiceInsights = (id: string) => get<ServiceInsights>(`/services/${id}/insights`);
export const updateService = (id: string, body: Record<string, unknown>) => patch(`/services/${id}`, body);

// ---- Integrations config (platform admin) + payments ----
export interface IntegrationsConfig {
  razorpayEnabled: boolean; razorpayKeyId: string; hasRazorpaySecret: boolean;
  emailEnabled: boolean; smtpHost: string; smtpPort: number; smtpUser: string; emailFrom: string; hasSmtpPass: boolean;
  whatsappEnabled: boolean; twilioSid: string; twilioFrom: string; hasTwilioToken: boolean;
}
export const fetchIntegrations = () => get<IntegrationsConfig>("/platform/integrations");
export const updateIntegrations = (body: Record<string, unknown>) => patch<{ ok: boolean }>("/platform/integrations", body);
export const fetchPaymentStatus = () => get<{ razorpay: boolean }>("/payments/status");
export const createRazorpayOrder = (orderId: string) => post<{ orderId: string; keyId: string; amount: number; currency: string }>("/payments/razorpay/order", { orderId });
export const verifyRazorpayPayment = (body: { orderId: string; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => post<{ ok: boolean }>("/payments/razorpay/verify", body);

// Self-serve machine booking (industry buyers) — instant, paid.
export interface BookingCheckoutBody {
  instrumentId: string; startAt: string; endAt: string; purpose?: string;
  contactName?: string; contactEmail?: string; contactPhone?: string;
}
export interface BookingCheckoutResult {
  bookingId: string; needsPayment: boolean; amount: number; currency: string;
  razorpay?: { orderId: string; keyId: string; amount: number; currency: string };
}
export const checkoutBooking = (body: BookingCheckoutBody) =>
  post<BookingCheckoutResult>("/bookings/checkout", clean(body));
export const verifyBookingPayment = (
  bookingId: string,
  body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
) => post<{ ok: boolean }>(`/bookings/${bookingId}/pay/verify`, body);

// v2 - AI exchange search
export interface AiSearchBody { requirement: string; lat?: number; lng?: number; maxPrice?: number; maxTurnaround?: number; }
export const aiSearch = (body: AiSearchBody) =>
  post<AiSearchResponse>("/exchange/ai-search", clean(body));

// Facilities / Instruments - endpoints return a paginated envelope; normalise to arrays.
export const fetchFacilities = async () =>
  asList(await get<Facility[] | Paginated<Facility>>("/facilities"));
// Public facility profile — the team, its instruments and the services it offers.
export const fetchPublicFacility = (id: string) =>
  get<import("@/lib/types").PublicFacility>(`/facilities/public/${id}`);

// Events & workshops
import type { EventItem, EventRegistrationRow } from "@/lib/types";
export const fetchEvents = async (params?: { q?: string; type?: string; institutionId?: string; scope?: string }) =>
  asList(await get<EventItem[] | Paginated<EventItem>>("/events", params));
export const fetchEvent = (slug: string) => get<EventItem>(`/events/${slug}`);
export const registerEvent = (id: string) => post<{ ok: boolean }>(`/events/${id}/register`, {});
export const cancelEventRegistration = (id: string) => post<{ ok: boolean }>(`/events/${id}/cancel`, {});
export const fetchManagedEvents = () => get<EventItem[]>("/events/manage");
export const createEvent = (body: Record<string, unknown>) => post<EventItem>("/events", clean(body));
export const updateEvent = (id: string, body: Record<string, unknown>) => patch<EventItem>(`/events/${id}`, clean(body));
export const deleteEvent = (id: string) => del(`/events/${id}`);
export const fetchEventRegistrations = (id: string) => get<EventRegistrationRow[]>(`/events/${id}/registrations`);
export const fetchInstruments = async (params?: object) =>
  asList(await get<Instrument[] | Paginated<Instrument>>("/instruments", params));
export const fetchInstrument = (id: string) => get<Instrument>(`/instruments/${id}`);
// Engine-driven capacity grid for an instrument (public).
export const fetchInstrumentAvailability = (id: string, days = 14) =>
  get<import("@/lib/types").Availability>(`/instruments/${id}/availability`, { days });
// Maintenance windows (provider roles).
export const addMaintenanceWindow = (
  instrumentId: string,
  body: { startAt: string; endAt: string; reason?: string }
) => post<import("@/lib/types").MaintenanceWindow>(`/instruments/${instrumentId}/maintenance`, body);
export const removeMaintenanceWindow = (instrumentId: string, mwId: string) =>
  del(`/instruments/${instrumentId}/maintenance/${mwId}`);
// Facility hours + holidays (provider roles).
export const addHoliday = (facilityId: string, body: { date: string; name?: string }) =>
  post<import("@/lib/types").Holiday>(`/facilities/${facilityId}/holidays`, body);
export const removeHoliday = (facilityId: string, hid: string) =>
  del(`/facilities/${facilityId}/holidays/${hid}`);
// Public 360° instrument profile (no auth).
export const fetchPublicInstrument = (id: string) =>
  get<PublicInstrument>(`/instruments/public/${id}`);

export interface BrowseInstrument {
  id: string; name: string; category: string; make: string | null; model: string | null;
  status: string; hourlyRate: number; images: string[]; imageUrl: string | null;
  trainingRequired: boolean;
  institution: { name: string; slug: string; city: string | null; state: string | null; currency: string; latitude?: number | null; longitude?: number | null };
  facility: { name: string; location: string | null };
}
export interface BrowseInstrumentsResult { categories: string[]; cities?: string[]; total: number; data: BrowseInstrument[]; }
export const fetchBrowseInstruments = (params?: { q?: string; category?: string; industry?: string }) =>
  get<BrowseInstrumentsResult>("/instruments/browse", params);

// Experts / skilled resources (admin scoped) + public
export const fetchExperts = async (params?: object) =>
  asList(await get<Expert[] | Paginated<Expert>>("/experts", params));
export const fetchExpert = (id: string) => get<Expert>(`/experts/${id}`);

export interface ExpertFilters {
  q?: string; expertise?: string; skill?: string; institutionId?: string;
  page?: number; pageSize?: number;
}
export const fetchExchangeExperts = (f: ExpertFilters = {}) =>
  get<Paginated<Expert>>("/exchange/experts", clean(f));
export const fetchPublicExpert = (id: string) => get<Expert>(`/experts/public/${id}`);

// Orders - buyers receive parent Orders (baskets); providers/admins receive ServiceOrder lines.
export const fetchOrders = (params?: object) =>
  get<Paginated<Order> | Order[] | Paginated<ServiceOrder> | ServiceOrder[]>("/orders", params);
export const fetchOrder = (id: string) => get<Order & ServiceOrder>(`/orders/${id}`);

// Order thread - documents + messages between buyer, provider & platform.
export const postOrderMessage = (lineId: string, body: string) =>
  post<import("@/lib/types").OrderMessage>(`/orders/${lineId}/messages`, { body });
export const postOrderReview = (lineId: string, body: { rating: number; comment?: string }) =>
  post(`/orders/${lineId}/review`, body);
export const deleteOrderDocument = (lineId: string, docId: string) =>
  del<{ ok: boolean }>(`/orders/${lineId}/documents/${docId}`);
export const uploadOrderDocument = async (lineId: string, file: File, kind?: string, deliverable?: string) => {
  const form = new FormData();
  form.append("file", file);
  if (kind) form.append("kind", kind);
  if (deliverable) form.append("deliverable", deliverable);
  const { data } = await api.post<import("@/lib/types").OrderDocument>(`/orders/${lineId}/documents`, form);
  return data;
};
export const payOrder = (id: string, body?: { method?: string; reference?: string }) =>
  post<Order>(`/orders/${id}/pay`, body ?? {});

// Cart (buyer server-side draft Order)
export const fetchCart = () => get<Order>("/cart");
export const addToCart = (body: { serviceId: string; quantity?: number; expedited?: boolean; sampleDetails?: string; requirements?: string }) =>
  post<Order>("/cart/items", body);
export const updateCartItem = (lineId: string, quantity: number) =>
  patch<Order>(`/cart/items/${lineId}`, { quantity });
export const removeCartItem = (lineId: string) => del<Order>(`/cart/items/${lineId}`);

export interface SampleDeclaration { label: string; description?: string; quantity?: number; condition?: string }
export type IntakeFieldType = "TEXT" | "TEXTAREA" | "NUMBER" | "DATE" | "SELECT" | "CHECKBOX" | "FILE";
export interface IntakeForm { name: string; description?: string; required?: boolean; type?: IntakeFieldType; options?: string[] }
export interface CartRequirements {
  totalSamples: number;
  items: {
    lineId: string; service: string; provider: string;
    samplesRequired: number; sampleSpec: string | null;
    destructive: boolean; returned: boolean; deliverables: string[];
    intakeForms: IntakeForm[];
  }[];
}
export const fetchCartRequirements = () => get<CartRequirements>("/cart/requirements");

// Unified discovery search across tests, packages, labs, experts and standards.
export interface SearchResults {
  q: string;
  tests: { id: string; slug: string; name: string; category: string; standardCodes: string[]; industrySlug: string }[];
  packages: { id: string; slug: string; name: string; summary: string | null }[];
  labs: { id: string; slug: string; name: string; city?: string | null; state?: string | null; accreditations: string[]; rating: { avg: number; count: number } }[];
  experts: { id: string; name: string; title: string; provider: string }[];
  standards: string[];
}
export const searchAll = (q: string) => get<SearchResults>(`/search?q=${encodeURIComponent(q)}`);

export interface CatalogHighlights {
  tests: { id: string; slug: string; name: string; category: string; standardCodes: string[]; industrySlug: string; industryTitle: string; providerCount: number }[];
  standards: string[];
}
export const fetchCatalogHighlights = () => get<CatalogHighlights>("/catalog/highlights");

// Accreditation records (scope-verified) — lab admin / platform management
export interface AccreditationInput {
  body: string; certNumber?: string | null; scope?: string[];
  issuedAt?: string | null; expiresAt?: string | null; verifyUrl?: string | null;
}
export const fetchLabAccreditations = (institutionId: string) => get<AccreditationRecord[]>(`/institutions/${institutionId}/accreditations`);
export const createAccreditation = (institutionId: string, body: AccreditationInput) => post<AccreditationRecord>(`/institutions/${institutionId}/accreditations`, body);
export const updateAccreditation = (accId: string, body: Partial<AccreditationInput>) => patch<AccreditationRecord>(`/institutions/accreditations/${accId}`, body);
export const deleteAccreditation = (accId: string) => del<{ ok: boolean }>(`/institutions/accreditations/${accId}`);
export const checkoutCart = (body?: { samples?: SampleDeclaration[]; shippingNote?: string; couponCode?: string; useCredits?: boolean; intakeAnswers?: Record<string, Record<string, string>> }) =>
  post<Order>("/cart/checkout", body ?? {});
export const uploadCartIntakeFile = async (file: File) => {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<{ url: string }>("/cart/intake-files", form);
  return data;
};

// Platform fee config (super-admin)
export const fetchFeeConfig = () => get<PlatformFeeConfig>("/platform/fee-config");
export const updateFeeConfig = (body: { feeMode: FeeMode; feeValue: number }) =>
  patch<PlatformFeeConfig>("/platform/fee-config", body);

// Invoices
export const fetchInvoices = () => get<Paginated<Invoice> | Invoice[]>("/invoices");
export const fetchInvoice = (id: string) => get<Invoice>(`/invoices/${id}`);

// Bookings
export const fetchBookings = (params?: object) =>
  get<Paginated<Booking> | Booking[]>("/bookings", params);

// Users
export const fetchUsers = async () => asList(await get<User[] | Paginated<User>>("/users"));

// Analytics
export const fetchAnalyticsSummary = () => get<AnalyticsSummary>("/analytics/summary");
export const fetchPlatformAnalytics = () => get<PlatformAnalytics>("/analytics/platform");

// Operator
export const fetchOperatorQueue = () => get<OperatorQueue>("/operator/queue");

// Settlements - endpoint returns a paginated envelope; normalise to an array.
export const fetchSettlements = async () =>
  asList(await get<Settlement[] | Paginated<Settlement>>("/settlements"));

// Platform (super-admin) console
export const fetchPlatformProviders = async (q?: string) =>
  (await get<{ data: ProviderRow[] }>("/platform/providers", clean({ q }))).data;
export const fetchPlatformProvider = (id: string) =>
  get<ProviderDetail>(`/platform/providers/${id}`);
export const fetchPlatformBuyers = async (q?: string) =>
  (await get<{ data: BuyerRow[] }>("/platform/buyers", clean({ q }))).data;
export const fetchPlatformBuyer = (id: string) =>
  get<BuyerDetail>(`/platform/buyers/${id}`);
export const fetchPlatformOrders = (params?: object) =>
  get<Paginated<ServiceOrder>>("/platform/orders", clean(params ?? {}));
export const fetchPlatformOrder = (id: string) =>
  get<ServiceOrder>(`/platform/orders/${id}`);

/* ---- Ancillary response shapes not in types.ts ---- */
export interface OperatorQueue {
  orders: ServiceOrder[];
  bookings: Booking[];
}

/** Helper: normalise list responses that may come paginated or as arrays. */
export function asList<T>(res: Paginated<T> | T[] | undefined): T[] {
  if (!res) return [];
  return Array.isArray(res) ? res : res.data;
}

/** Strip empty/undefined filter values before sending as query params. */
function clean(obj: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  }
  return out;
}
