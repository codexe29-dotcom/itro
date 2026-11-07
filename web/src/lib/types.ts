// Shared types - mirror the API responses. Keep in sync with server DTOs.

export type Role =
  | "SUPER_ADMIN"
  | "INSTITUTION_ADMIN"
  | "LAB_MANAGER"
  | "OPERATOR"
  | "FACULTY"
  | "RESEARCHER"
  | "INDUSTRY_BUYER";

export type InstrumentStatus = "AVAILABLE" | "BOOKED" | "MAINTENANCE" | "OFFLINE";
export type BookingStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "COMPLETED";
export type OrderStatus =
  | "DRAFT" | "QUOTE_REQUESTED" | "QUOTED" | "ACCEPTED" | "NDA_PENDING"
  | "SAMPLE_AWAITED" | "IN_PROGRESS" | "REPORT_READY" | "COMPLETED" | "CANCELLED";
export type PricingTier = "INTERNAL" | "ACADEMIC" | "INDUSTRY";
export type InvoiceStatus = "DRAFT" | "ISSUED" | "PAID" | "VOID" | "OVERDUE";
export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";

export interface User {
  id: string; role: Role; name: string; email: string;
  phone?: string; orgName?: string; institutionId?: string | null;
  institution?: Institution | null; isActive: boolean;
}

export interface AccreditationRecord {
  id: string; body: string; certNumber?: string | null; scope: string[];
  issuedAt?: string | null; expiresAt?: string | null; verifyUrl?: string | null;
  status: "ACTIVE" | "EXPIRING" | "EXPIRED" | "UNKNOWN";
}
export interface Institution {
  id: string; name: string; slug: string; type: string;
  addressLine1?: string; addressLine2?: string; postalCode?: string;
  city?: string; state?: string; country: string; about?: string;
  logoUrl?: string; themeColor: string; currency: string; taxRate: number;
  accreditations: string[]; isPublished: boolean; onExchange: boolean;
  latitude?: number; longitude?: number; createdAt?: string; updatedAt?: string;
  feeMode?: FeeMode | null; feeValue?: number | null;
  rating?: { avg: number; count: number };
  accreditationRecords?: AccreditationRecord[];
  facilities?: { id: string; name: string; department?: string | null }[];
  _count?: { services?: number; facilities?: number };
}

export interface DayHours { open: string; close: string; }
export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type OpeningHours = Partial<Record<WeekdayKey, DayHours | null>>;

export interface Holiday {
  id: string; facilityId: string; date: string; name?: string | null; createdAt?: string;
}

export interface Facility {
  id: string; institutionId: string; name: string; department?: string;
  description?: string; location?: string; instruments?: Instrument[];
  // Facility-as-first-class-lab: its own team, contact and accreditations.
  inchargeName?: string | null; contactEmail?: string | null; contactPhone?: string | null;
  accreditations?: string[]; imageUrl?: string | null;
  openingHours?: OpeningHours | null; timezone?: string | null;
  holidays?: Holiday[];
}

/* Public facility profile (GET /facilities/public/:id) — team + instruments + services. */
export interface PublicFacility {
  id: string; name: string; department?: string | null; description?: string | null;
  location?: string | null; inchargeName?: string | null; contactEmail?: string | null;
  contactPhone?: string | null; accreditations?: string[]; imageUrl?: string | null;
  institution: { id: string; name: string; slug: string; city?: string | null; state?: string | null; country?: string | null; currency?: string | null; logoUrl?: string | null };
  instruments: Instrument[];
  services: Service[];
  events?: EventItem[];
}

export type DocumentType =
  | "WARRANTY" | "LICENSE" | "CALIBRATION_CERT" | "MANUAL"
  | "CERTIFICATE" | "DATASHEET" | "OTHER";

export interface InstrumentDocument {
  id: string; instrumentId: string; type: DocumentType;
  name: string; url: string; expiresAt?: string | null; createdAt: string;
}

export interface Certification {
  body: string; number: string; scope: string;
  validFrom: string; validUntil: string; documentUrl: string;
}

export interface SampleEnvelope {
  maxLengthMm?: number; maxWidthMm?: number; maxHeightMm?: number; maxWeightKg?: number; notes?: string;
}

export interface Instrument {
  id: string; facilityId: string; name: string; category: string;
  make?: string; model?: string; specs?: Record<string, unknown>;
  description?: string; imageUrl?: string; images?: string[]; applications?: string[];
  status: InstrumentStatus;
  accreditation?: string; certifications?: Certification[]; industries?: string[];
  documents?: InstrumentDocument[];
  hourlyRate: number; trainingRequired: boolean;
  maxSampleSpec?: SampleEnvelope | null; netTestHours?: number | null;
  lastCalibratedAt?: string; nextCalibrationAt?: string;
  facility?: Facility;
  // Capacity & scheduling
  capacityType?: CapacityType; concurrency?: number; throughputPerDay?: number | null;
  slotMinutes?: number; setupMinutes?: number; leadTimeDays?: number; requiresOperator?: boolean;
  maintenanceWindows?: MaintenanceWindow[];
  reservations?: CapacityReservationRow[];
}

export type CapacityType = "TIME_SLOT" | "THROUGHPUT";

export interface MaintenanceWindow {
  id: string; instrumentId: string; startAt: string; endAt: string;
  reason?: string | null; createdAt?: string;
}

export interface CapacityReservationRow {
  id: string; instrumentId: string; serviceOrderId?: string | null; bookingId?: string | null;
  startAt?: string | null; endAt?: string | null; date?: string | null; units: number; status: string;
  serviceOrder?: { id: string; code: string; service?: { name: string } } | null;
}

export type RatePeriod = "HOURLY" | "DAILY" | "PROJECT";

export interface Expert {
  id: string; institutionId: string; name: string; title: string;
  photoUrl?: string | null; bio?: string | null;
  expertise: string[]; skills: string[];
  experienceYears?: number | null;
  ratePeriod: RatePeriod; rate: number;
  availability?: string | null; certifications: string[];
  isActive: boolean; createdAt?: string; updatedAt?: string;
  institution?: Institution;
}

export type PricingMethod =
  | "FLAT" | "PER_HOUR" | "PER_SAMPLE" | "PER_TEST" | "PER_DAY" | "PER_UNIT" | "TIERED";

export type PricingMode = "QUOTE" | "FIXED";

export type FeeMode = "MARKUP_PERCENT" | "FIXED_FEE" | "SETTLEMENT_DEDUCTION";

export interface PlatformFeeConfig {
  id: string; feeMode: FeeMode; feeValue: number; updatedAt: string;
}

export interface Service {
  id: string; institutionId: string; instrumentId?: string; facilityId?: string | null;
  name: string; category: string; description?: string; images?: string[]; deliverable?: string;
  turnaroundDays: number; priceInternal: number; priceAcademic: number; priceIndustry: number;
  rushDays?: number | null; rushSurchargePct?: number | null; expeditedPrice?: number | null;
  pricingMethod?: PricingMethod; unitLabel?: string | null; setupFee?: number; minCharge?: number;
  accreditation?: string; isActive: boolean;
  pricingMode?: PricingMode; buyerPrice?: number;
  institution?: Institution; instrument?: Instrument;
  rating?: ServiceRating;
  schedule?: ServiceSchedule;
}

/* Events & workshops hosted by a lab / facility. */
export type EventType = "WORKSHOP" | "WEBINAR" | "TRAINING" | "OPEN_DAY" | "CONFERENCE";
export type EventMode = "IN_PERSON" | "ONLINE" | "HYBRID";
export interface EventItem {
  id: string; slug: string; title: string; description?: string | null;
  type: EventType; mode: EventMode; location?: string | null; onlineUrl?: string | null;
  imageUrl?: string | null; startAt: string; endAt?: string | null;
  capacity?: number | null; price: number; isPublished: boolean;
  institutionId: string; facilityId?: string | null;
  institution?: { id: string; name: string; slug: string; city?: string | null; state?: string | null; logoUrl?: string | null };
  facility?: { id: string; name: string } | null;
  registeredCount?: number; spotsLeft?: number | null; isFull?: boolean; registered?: boolean;
}
export interface EventRegistrationRow {
  id: string; status: string; name?: string | null; email?: string | null; createdAt: string;
  user?: { name?: string | null; email?: string | null; orgName?: string | null };
}

/* Public 360° instrument profile (GET /instruments/public/:id). */
export interface PublicInstrument {
  id: string; name: string; category: string; make?: string; model?: string;
  description?: string; specs?: Record<string, unknown>;
  imageUrl?: string; images: string[]; applications: string[];
  status: InstrumentStatus; accreditation?: string; industries: string[];
  certifications?: Certification[];
  documents?: InstrumentDocument[];
  hourlyRate: number; trainingRequired: boolean;
  maxSampleSpec?: SampleEnvelope | null; netTestHours?: number | null;
  lastCalibratedAt?: string; nextCalibrationAt?: string; calibrationDueSoon: boolean;
  uptimePct?: number;
  reviews?: {
    avg: number; count: number;
    items: { id: string; rating: number; comment?: string | null; author: string; service?: string; date: string; orderCode?: string }[];
  };
  rateCards?: InstrumentRateCard[];
  facility: { id: string; name: string; department?: string; location?: string };
  institution: {
    id: string; name: string; slug: string; city?: string; state?: string;
    country: string; accreditations: string[];
  };
  services: {
    id: string; name: string; category: string; deliverable?: string;
    turnaroundDays: number; priceAcademic: number; priceIndustry: number; accreditation?: string;
    pricingMethod?: PricingMethod; unitLabel?: string | null; setupFee?: number; minCharge?: number;
  }[];
  performableTests?: { id: string; slug: string; name: string; category: string; accreditation?: string | null }[];
}

export interface InstrumentRateCard {
  serviceId: string; name: string;
  pricingMethod: PricingMethod; unitLabel?: string | null;
  priceIndustry: number; priceAcademic: number;
  setupFee: number; minCharge: number;
  turnaroundDays: number; accreditation?: string;
}

export interface ExchangeFacets {
  total: number;
  categories: { category: string; count: number }[];
  accreditations: { accreditation: string; count: number }[];
}

export interface OrderEvent {
  id: string; orderId: string; type: string; message: string; actor?: string; createdAt: string;
}

export interface OrderDocument {
  id: string; serviceOrderId: string; uploadedById?: string | null;
  authorRole: string; authorName: string; kind: string; deliverable?: string | null; name: string; url: string; createdAt: string;
}
export interface IntakeAnswer { name: string; type: string; answer: string; required?: boolean }
export interface OrderMessage {
  id: string; serviceOrderId: string; userId?: string | null;
  authorRole: string; authorName: string; body: string; createdAt: string;
}

export interface ServiceOrder {
  id: string; code: string; orderId?: string | null; serviceId: string; institutionId: string; buyerId: string;
  status: OrderStatus; tier: PricingTier; sampleDetails?: string; quantity: number;
  requirements?: string; quotedPrice?: number; slaDays?: number; ndaSigned: boolean;
  ndaSignedAt?: string; reportUrl?: string; dueAt?: string; createdAt: string; updatedAt: string;
  intakeAnswers?: IntakeAnswer[];
  providerAmount?: number | null; platformFeeAmount?: number | null; buyerAmount?: number | null; listPrice?: number | null;
  service?: Service; institution?: Institution; buyer?: User;
  events?: OrderEvent[]; invoice?: Invoice; settlement?: Settlement; review?: { id: string; rating: number; comment?: string } | null;
  documents?: OrderDocument[]; messages?: OrderMessage[];
}

/** Parent aggregator order (basket) grouping ServiceOrder lines across providers. */
export interface OrderSample {
  id: string; label: string; description?: string | null;
  quantity: number; condition?: string | null; status: string; createdAt: string;
}
export interface Order {
  id: string; code: string; buyerId: string;
  status: string; // OPEN | PLACED
  subtotal: number; platformFee: number; taxAmount: number; total: number; currency: string;
  shippingNote?: string | null;
  createdAt: string; updatedAt: string;
  lines: ServiceOrder[];
  samples?: OrderSample[];
}

export interface Invoice {
  id: string; number: string; orderId: string; institutionId: string;
  subtotal: number; taxRate: number; taxAmount: number; total: number;
  currency: string; status: InvoiceStatus; issuedAt: string; dueAt?: string;
  payment?: Payment; order?: ServiceOrder;
}

export interface Payment {
  id: string; invoiceId: string; amount: number; method: string;
  reference?: string; status: PaymentStatus; paidAt?: string;
}

export interface Settlement {
  id: string; orderId: string; grossAmount: number; takeRate: number;
  platformFee: number; netToProvider: number; status: string; releasedAt?: string;
}

export interface Booking {
  id: string; instrumentId: string; userId: string; startAt: string; endAt: string;
  purpose?: string; status: BookingStatus; instrument?: Instrument; user?: User;
}

export interface AnalyticsSummary {
  totalOrders: number; revenue: number; activeOrders: number; completedOrders: number;
  instruments: number; utilizationPct: number;
  revenueByMonth: { month: string; revenue: number }[];
  ordersByStatus: { status: string; count: number }[];
  topServices: { name: string; orders: number; revenue: number }[];
}

export interface Paginated<T> { data: T[]; total: number; page: number; pageSize: number; }

/* ---- Platform (super-admin) console DTOs ---- */
export interface ProviderRow extends Institution {
  counts: { facilities: number; instruments: number; services: number; orders: number };
  revenue: number;
  avgRating: number | null;
  reviewCount: number;
}

export interface ProviderDetail {
  institution: Institution;
  facilities: Facility[];
  services: Service[];
  users: Pick<User, "id" | "name" | "email" | "role" | "phone" | "isActive">[];
  experts?: Expert[];
  recentOrders: ServiceOrder[];
  stats: {
    revenue: number; paidInvoices: number; totalOrders: number; pendingOrders: number;
    facilities: number; instruments: number; services: number; users: number;
    avgRating: number | null; reviewCount: number;
  };
  settlements: {
    count: number; grossAmount: number; platformFee: number; netToProvider: number;
    pendingCount: number; pendingNetToProvider: number;
  };
}

export interface BuyerRow {
  id: string; name: string; email: string; orgName?: string | null; phone?: string | null;
  isActive: boolean; createdAt: string; orderCount: number; totalSpend: number;
}

export interface BuyerDetail {
  buyer: {
    id: string; name: string; email: string; orgName?: string | null; phone?: string | null;
    isActive: boolean; institutionId?: string | null; createdAt: string;
  };
  orders: ServiceOrder[];
  invoices: (Invoice & { order?: { id: string; code: string }; institution?: { id: string; name: string } })[];
  stats: {
    totalOrders: number; activeOrders: number; completedOrders: number;
    totalSpend: number; paidInvoices: number;
  };
}

export interface PlatformAnalytics {
  totalInstitutions: number; totalServices: number; totalOrders: number; totalBuyers: number;
  activeOrders: number; totalRevenue: number; platformFees: number;
  ordersByStatus: { status: string; count: number }[];
  revenueByMonth: { month: string; revenue: number }[];
  settlements: {
    grossAmount: number; platformFee: number; netToProvider: number;
    releasedPlatformFee: number; pendingPlatformFee: number; pendingNetToProvider: number;
  };
  leaderboard: { id: string; institutionId: string; name: string; slug: string; revenue: number; orders: number; paidInvoices: number }[];
}

/* ---- v2: rich service detail + AI exchange ---- */
export interface ServiceRating { avg: number; count: number; }

export interface EquipmentCondition {
  status: InstrumentStatus;
  healthLabel: string;
  lastCalibratedAt?: string;
  nextCalibratedAt?: string;
  nextCalibrationAt?: string;
  calibrationDueSoon: boolean;
  utilizationPct: number;
  uptimePct: number;
}

export interface ServiceSchedule {
  nextAvailableStart: string | null;
  estimatedCompletion: string | null;
  queueDepth: number;
}

export interface ServiceDetail extends Service {
  condition?: EquipmentCondition | null;
  schedule?: ServiceSchedule;
  rating?: ServiceRating;
  certifications?: string[];
}

export interface AvailabilitySlot {
  start: string; end: string; available: boolean;
  startAt?: string; endAt?: string; capacity?: number; remaining?: number;
}
export interface AvailabilityDay {
  date: string; weekday: string; closed?: boolean; slots: AvailabilitySlot[];
}
export interface ThroughputDay {
  date: string; weekday: string; closed?: boolean;
  capacity: number; used: number; remaining: number;
}
export interface Availability {
  instrumentId: string | null;
  capacityType?: CapacityType | null;
  nextAvailable: string | null;
  slotMinutes?: number;
  concurrency?: number;
  throughputPerDay?: number | null;
  inMaintenanceNow?: boolean;
  days: AvailabilityDay[] | ThroughputDay[];
}

export interface SimilarService {
  id: string; name: string; category: string;
  priceIndustry: number; priceAcademic: number; turnaroundDays: number;
  accreditation?: string; rating: ServiceRating;
  institution: { id: string; name: string; slug: string; city?: string; state?: string; latitude?: number; longitude?: number };
  distanceKm: number | null; isCurrent: boolean;
}

export interface RecommendedService {
  id: string; name: string; category: string; priceIndustry: number; turnaroundDays: number; accreditation?: string;
}

export interface ReviewItem { id: string; rating: number; comment?: string; author: string; date: string; orderCode?: string; }
export interface ReviewsResponse {
  avg: number; count: number;
  distribution: Record<string, number>;
  items: ReviewItem[];
}

export interface AiSearchResult extends Service {
  institution?: Institution;
  rating?: ServiceRating;
  distanceKm: number | null;
  matchScore: number;
  matchReasons: string[];
}
export interface AiSearchResponse {
  requirement: string;
  interpreted: { categories: string[]; keywords: string[] };
  results: AiSearchResult[];
}
