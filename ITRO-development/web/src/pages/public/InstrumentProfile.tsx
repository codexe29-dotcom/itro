import { useState } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ShieldCheck, Building2, MapPin, Cpu, Wrench, CalendarCheck,
  ListChecks, Factory, X, ChevronLeft, ChevronRight, ArrowRight, Layers,
  BadgeCheck, FileText, Download, ReceiptText, Star, FlaskConical, AlertTriangle,
  CreditCard, Clock, CheckCircle2, LogIn,
} from "lucide-react";
import clsx from "clsx";
import {
  fetchPublicInstrument, fetchInstrumentAvailability, fetchPaymentStatus,
  checkoutBooking, verifyBookingPayment,
} from "@/lib/queries";
import { money, dateShort } from "@/lib/format";
import { imageForCategory } from "@/lib/imagery";
import { RatingStars } from "@/components/RatingStars";
import { useAuth } from "@/lib/auth";
import type { DocumentType, AvailabilityDay, AvailabilitySlot } from "@/lib/types";
import { Card, Badge, LoadingBlock, ErrorState, StatusBadge, Button, useToast } from "@/components/ui";

const PRICING_LABEL: Record<string, string> = {
  FLAT: "Flat", PER_HOUR: "Per hour", PER_SAMPLE: "Per sample", PER_TEST: "Per test",
  PER_DAY: "Per day", PER_UNIT: "Per unit", TIERED: "Tiered",
};
const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  WARRANTY: "Warranty", LICENSE: "License", CALIBRATION_CERT: "Calibration cert",
  MANUAL: "Manual", CERTIFICATE: "Certificate", DATASHEET: "Datasheet", OTHER: "Document",
};

function humanize(k: string): string {
  return k.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").replace(/^\w/, (c) => c.toUpperCase()).trim();
}
function renderSpec(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (v && typeof v === "object") return Object.entries(v).map(([k, val]) => `${k}: ${val}`).join(", ");
  return String(v);
}

export default function InstrumentProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [lightbox, setLightbox] = useState<number | null>(null);
  const goBack = () => (location.key !== "default" ? navigate(-1) : navigate("/exchange?tab=equipment"));

  const { data: inst, isLoading, isError, error } = useQuery({
    queryKey: ["public-instrument", id],
    queryFn: () => fetchPublicInstrument(id!),
    enabled: !!id,
  });

  if (isLoading) return <div className="mx-auto max-w-6xl px-4 py-10"><LoadingBlock /></div>;
  if (isError || !inst)
    return <div className="mx-auto max-w-6xl px-4 py-10"><ErrorState error={error} /></div>;

  const gallery = inst.images && inst.images.length > 0
    ? inst.images
    : inst.imageUrl
      ? [inst.imageUrl]
      : [];
  const primary = gallery[0] ?? imageForCategory(inst.category, 1400);
  const specs = inst.specs ?? {};
  const specKeys = Object.keys(specs);
  const org = inst.institution;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <button onClick={goBack} className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to catalog
      </button>

      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl">
        <img src={primary} alt={inst.name} className="h-56 w-full object-cover sm:h-64" loading="eager" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/92 via-ink/55 to-ink/25" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-ink">{inst.category}</span>
            {inst.accreditation && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                <ShieldCheck className="h-3 w-3" /> {inst.accreditation}
              </span>
            )}
            <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-ink">{inst.status}</span>
          </div>
          <h1 className="mt-2.5 text-3xl font-bold tracking-tight text-white drop-shadow-sm">{inst.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-white/90">
            {(inst.make || inst.model) && (
              <span className="inline-flex items-center gap-1.5"><Cpu className="h-4 w-4" /> {[inst.make, inst.model].filter(Boolean).join(" · ")}</span>
            )}
            <Link to={`/institutions/${org.slug}`} className="inline-flex items-center gap-1.5 font-medium text-white hover:underline">
              <Building2 className="h-4 w-4" /> {org.name}
            </Link>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> {[org.city, org.state].filter(Boolean).join(", ") || org.country}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_360px]">
        {/* MAIN */}
        <div className="min-w-0 space-y-6">
          {/* Gallery */}
          {gallery.length > 0 && (
            <Card className="card-pad">
              <h2 className="section-title mb-3">Photo gallery</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {gallery.map((url, idx) => (
                  <button
                    key={url + idx}
                    className="aspect-square overflow-hidden rounded-lg border border-surface-border bg-surface-muted"
                    onClick={() => setLightbox(idx)}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover transition hover:scale-105" />
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Overview */}
          {inst.description && (
            <Card className="card-pad">
              <h2 className="section-title mb-3">Overview</h2>
              <p className="text-ink-soft">{inst.description}</p>
            </Card>
          )}

          {/* Availability calendar */}
          <InstrumentAvailability instrumentId={inst.id} />

          {/* Applications */}
          {inst.applications && inst.applications.length > 0 && (
            <Card className="card-pad">
              <div className="mb-3 flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-brand-600" />
                <h2 className="section-title">Applications</h2>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {inst.applications.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-soft">
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /> {a}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Specifications */}
          {specKeys.length > 0 && (
            <Card className="card-pad">
              <div className="mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4 text-brand-600" />
                <h2 className="section-title">Technical specifications</h2>
              </div>
              <div className="overflow-hidden rounded-lg border border-surface-border">
                <table className="w-full text-sm">
                  <tbody>
                    {specKeys.map((k, i) => (
                      <tr key={k} className={i % 2 ? "bg-surface-subtle" : ""}>
                        <td className="w-1/3 px-4 py-2 font-medium capitalize text-ink-soft">{humanize(k)}</td>
                        <td className="px-4 py-2 text-ink">{renderSpec((specs as Record<string, unknown>)[k])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Sample handling & test timing */}
          {(inst.maxSampleSpec || inst.netTestHours != null) && (() => {
            const s = inst.maxSampleSpec ?? {};
            const dims = [s.maxLengthMm, s.maxWidthMm, s.maxHeightMm].filter((n) => n != null);
            const rows: { label: string; value: string }[] = [];
            if (dims.length) rows.push({ label: "Max sample size", value: `${dims.join(" × ")} mm` });
            if (s.maxWeightKg != null) rows.push({ label: "Max sample weight", value: `${s.maxWeightKg} kg` });
            if (inst.netTestHours != null) rows.push({ label: "Net test time", value: `${inst.netTestHours} h / cycle (excl. pre/post checks)` });
            return (
              <Card className="card-pad">
                <div className="mb-3 flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-brand-600" />
                  <h2 className="section-title">Sample handling &amp; test timing</h2>
                </div>
                {rows.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-surface-border">
                    <table className="w-full text-sm">
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={r.label} className={i % 2 ? "bg-surface-subtle" : ""}>
                            <td className="w-1/3 px-4 py-2 font-medium text-ink-soft">{r.label}</td>
                            <td className="px-4 py-2 text-ink">{r.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {s.notes && <p className="mt-3 text-sm text-ink-muted">{s.notes}</p>}
              </Card>
            );
          })()}

          {/* Applicable industries */}
          {inst.industries && inst.industries.length > 0 && (
            <Card className="card-pad">
              <div className="mb-3 flex items-center gap-2">
                <Factory className="h-4 w-4 text-brand-600" />
                <h2 className="section-title">Applicable industries</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {inst.industries.map((ind) => (
                  <span key={ind} className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700">{ind}</span>
                ))}
              </div>
            </Card>
          )}

          {/* Linked services */}
          {inst.services && inst.services.length > 0 && (
            <Card className="card-pad">
              <div className="mb-3 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-brand-600" />
                <h2 className="section-title">Services on this instrument</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {inst.services.map((s) => (
                  <Link key={s.id} to={`/services/${s.id}`} className="group rounded-lg border border-surface-border p-4 transition hover:border-brand-300 hover:shadow-card">
                    <div className="flex items-center justify-between">
                      <Badge tone="gray">{s.category}</Badge>
                      {s.accreditation && <span className="text-xs font-medium text-brand-700">{s.accreditation}</span>}
                    </div>
                    <p className="mt-2 font-medium text-ink group-hover:text-brand-700">{s.name}</p>
                    <p className="mt-1 text-sm text-ink-muted">{money(s.priceIndustry)} · {s.turnaroundDays} days</p>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {inst.performableTests && inst.performableTests.length > 0 && (
            <Card className="card-pad">
              <div className="mb-3 flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-brand-600" />
                <h2 className="section-title">Tests you can run here</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {inst.performableTests.map((t) => (
                  <Link key={t.id} to={`/tests/${t.slug}`} className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-white px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-700">
                    <FlaskConical className="h-3.5 w-3.5 text-brand-600" /> {t.name}
                    {t.accreditation && <span className="text-xs text-ink-faint">· {t.accreditation}</span>}
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* Certifications */}
          {inst.certifications && inst.certifications.length > 0 && (
            <Card className="card-pad">
              <div className="mb-3 flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-brand-600" />
                <h2 className="section-title">Certifications & accreditation</h2>
              </div>
              <div className="space-y-3">
                {inst.certifications.map((c, i) => (
                  <div key={i} className="rounded-lg border border-surface-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                          <ShieldCheck className="h-3 w-3" /> {c.body || "Accreditation"}
                        </span>
                        {c.number && <span className="text-sm font-medium text-ink">{c.number}</span>}
                      </div>
                      {c.documentUrl && (
                        <a href={c.documentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
                          <FileText className="h-4 w-4" /> View certificate
                        </a>
                      )}
                    </div>
                    {c.scope && <p className="mt-2 text-sm text-ink-soft">{c.scope}</p>}
                    {(c.validFrom || c.validUntil) && (
                      <p className="mt-1.5 text-xs text-ink-muted">
                        Valid {c.validFrom ? dateShort(c.validFrom) : "-"} to {c.validUntil ? dateShort(c.validUntil) : "-"}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Rate card */}
          {inst.rateCards && inst.rateCards.length > 0 && (
            <Card className="card-pad">
              <div className="mb-3 flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-brand-600" />
                <h2 className="section-title">Rate card</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {["Service", "Method", "Industry price", "Setup / Min", "TAT", "Accreditation"].map((h) => (
                        <th key={h} className="th whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inst.rateCards.map((rc) => (
                      <tr key={rc.serviceId}>
                        <td className="td font-medium text-ink">
                          <Link to={`/services/${rc.serviceId}`} className="hover:text-brand-700 hover:underline">{rc.name}</Link>
                        </td>
                        <td className="td whitespace-nowrap text-ink-muted">
                          {PRICING_LABEL[rc.pricingMethod] ?? rc.pricingMethod}{rc.unitLabel ? ` · ${rc.unitLabel}` : ""}
                        </td>
                        <td className="td whitespace-nowrap font-semibold text-ink">
                          {money(rc.priceIndustry)}{rc.unitLabel ? <span className="text-xs font-normal text-ink-muted"> {rc.unitLabel}</span> : null}
                        </td>
                        <td className="td whitespace-nowrap text-ink-muted">
                          {rc.setupFee ? `Setup ${money(rc.setupFee)}` : "-"}{rc.minCharge ? ` · Min ${money(rc.minCharge)}` : ""}
                        </td>
                        <td className="td whitespace-nowrap">{rc.turnaroundDays} days</td>
                        <td className="td whitespace-nowrap">{rc.accreditation ? <Badge tone="success">{rc.accreditation}</Badge> : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Documents */}
          {inst.documents && inst.documents.length > 0 && (
            <Card className="card-pad">
              <div className="mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-brand-600" />
                <h2 className="section-title">Documents</h2>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {inst.documents.map((d) => (
                  <li key={d.id}>
                    <a href={d.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-lg border border-surface-border px-3 py-2.5 text-sm hover:border-brand-300 hover:bg-surface-subtle">
                      <span className="flex min-w-0 items-center gap-2">
                        <Badge tone="gray">{DOC_TYPE_LABEL[d.type] ?? d.type}</Badge>
                        <span className="truncate font-medium text-ink">{d.name}</span>
                      </span>
                      <Download className="h-4 w-4 shrink-0 text-brand-600" />
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Reviews */}
          {inst.reviews && inst.reviews.count > 0 && (
            <Card className="card-pad">
              <div className="mb-4 flex items-center gap-2">
                <Star className="h-4 w-4 text-brand-600" />
                <h2 className="section-title">Reviews</h2>
              </div>
              <div className="mb-4 flex items-center gap-3">
                <p className="text-3xl font-bold text-ink">{inst.reviews.avg.toFixed(1)}</p>
                <div>
                  <RatingStars value={inst.reviews.avg} />
                  <p className="mt-0.5 text-xs text-ink-muted">{inst.reviews.count} verified {inst.reviews.count === 1 ? "review" : "reviews"} across linked services</p>
                </div>
              </div>
              <div className="space-y-3">
                {inst.reviews.items.map((r) => (
                  <div key={r.id} className="rounded-lg border border-surface-border p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RatingStars value={r.rating} size={13} />
                        <span className="text-sm font-medium text-ink">{r.author}</span>
                      </div>
                      <span className="text-xs text-ink-faint">{dateShort(r.date)}</span>
                    </div>
                    {r.service && <p className="mt-0.5 text-xs text-ink-muted">on {r.service}</p>}
                    {r.comment && <p className="mt-1.5 text-sm text-ink-soft">{r.comment}</p>}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* SIDEBAR */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="card-pad">
            <p className="text-sm text-ink-muted">Hourly rate</p>
            <p className="mt-0.5 text-3xl font-bold text-ink">{money(inst.hourlyRate)}</p>

            <div className="mt-4 space-y-2.5 border-t border-surface-border pt-4 text-sm">
              <SideFact icon={<Cpu className="h-4 w-4" />} label="Condition" value={<StatusBadge status={inst.status} />} />
              {inst.accreditation && <SideFact icon={<ShieldCheck className="h-4 w-4" />} label="Certification" value={inst.accreditation} />}
              {(inst.make || inst.model) && <SideFact icon={<Layers className="h-4 w-4" />} label="Make / model" value={[inst.make, inst.model].filter(Boolean).join(" ")} />}
              <SideFact icon={<Building2 className="h-4 w-4" />} label="Facility" value={inst.facility.name} />
              {inst.facility.location && <SideFact icon={<MapPin className="h-4 w-4" />} label="Location" value={inst.facility.location} />}
              <SideFact
                icon={<ListChecks className="h-4 w-4" />}
                label="Training"
                value={inst.trainingRequired ? "Required before use" : "Not required"}
              />
            </div>
          </Card>

          <Card className="card-pad">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-muted">
              <Wrench className="h-4 w-4" /> Calibration
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-muted">Last calibrated</span>
                <span className="font-medium text-ink">{dateShort(inst.lastCalibratedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Next calibration</span>
                <span className={clsx("font-medium", inst.calibrationDueSoon ? "text-brand-700" : "text-ink")}>
                  {dateShort(inst.nextCalibrationAt)}{inst.calibrationDueSoon ? " · due soon" : ""}
                </span>
              </div>
            </div>
          </Card>

          <InstrumentBooking instrumentId={inst.id} instrumentName={inst.name} hourlyRate={inst.hourlyRate} status={inst.status} />
        </div>
      </div>

      {/* Lightbox */}
      {lightbox !== null && gallery[lightbox] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4" onClick={() => setLightbox(null)}>
          <button className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-ink hover:bg-white" onClick={() => setLightbox(null)}>
            <X className="h-5 w-5" />
          </button>
          {gallery.length > 1 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-ink hover:bg-white"
              onClick={(e) => { e.stopPropagation(); setLightbox((n) => (n! - 1 + gallery.length) % gallery.length); }}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <img src={gallery[lightbox]} alt="" className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          {gallery.length > 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-ink hover:bg-white"
              onClick={(e) => { e.stopPropagation(); setLightbox((n) => (n! + 1) % gallery.length); }}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function InstrumentAvailability({ instrumentId }: { instrumentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["instrument-availability", instrumentId],
    queryFn: () => fetchInstrumentAvailability(instrumentId, 8),
    enabled: !!instrumentId,
  });
  if (isLoading) return <Card className="card-pad"><h2 className="section-title mb-3">Availability</h2><div className="skeleton h-24 w-full" /></Card>;
  if (!data) return null;

  const isThroughput = (data as any).capacityType === "THROUGHPUT";
  const days = ((data as any).days as any[] ?? []).slice(0, 7);
  const nextAvailable = (data as any).nextAvailable as string | null;

  return (
    <Card className="card-pad">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-brand-600" />
          <h2 className="section-title">Availability schedule</h2>
        </div>
        {nextAvailable && (
          <span className="badge-brand"><CalendarCheck className="h-3.5 w-3.5" /> Available from {dateShort(nextAvailable)}</span>
        )}
      </div>

      {(data as any).inMaintenanceNow && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-soft">
          <AlertTriangle className="h-3.5 w-3.5" /> Instrument is currently in a maintenance window.
        </p>
      )}

      {isThroughput ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {days.map((d: any) => (
            <div key={d.date} className="rounded-lg border border-surface-border p-2 text-center">
              <p className="text-xs font-semibold text-ink">{d.weekday}</p>
              <p className="mb-2 text-[11px] text-ink-faint">{dateShort(d.date).replace(/ \d{4}$/, "")}</p>
              {d.closed ? (
                <p className="text-[11px] text-ink-faint">Closed</p>
              ) : (
                <p className={clsx("text-sm font-semibold", d.remaining > 0 ? "text-brand-700" : "text-ink-faint")}>
                  {d.remaining}/{d.capacity}
                  <span className="block text-[10px] font-normal text-ink-muted">units left</span>
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {days.map((d: any) => (
            <div key={d.date} className="rounded-lg border border-surface-border p-2">
              <p className="text-center text-xs font-semibold text-ink">{d.weekday}</p>
              <p className="mb-2 text-center text-[11px] text-ink-faint">{dateShort(d.date).replace(/ \d{4}$/, "")}</p>
              <div className="space-y-1">
                {d.closed ? (
                  <p className="text-center text-[11px] text-ink-faint">Closed</p>
                ) : (
                  (d.slots ?? []).slice(0, 6).map((s: any) => (
                    <div key={s.start} className={clsx(
                      "rounded px-1.5 py-1 text-center text-[11px] font-medium",
                      s.available ? "bg-brand-50 text-brand-700" : "bg-surface-muted text-ink-faint line-through"
                    )}>
                      {s.start}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-ink-faint">Live capacity from the facility calendar — honours opening hours, holidays and maintenance. Confirm your window on quote acceptance.</p>
    </Card>
  );
}

function InstrumentBooking({ instrumentId, instrumentName, hourlyRate, status }: {
  instrumentId: string; instrumentName: string; hourlyRate: number; status: string;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [dayIdx, setDayIdx] = useState(0);
  const [slotStart, setSlotStart] = useState<string | null>(null);
  const [durationSlots, setDurationSlots] = useState(1);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<null | { paid: boolean }>(null);

  const bookable = status === "AVAILABLE" && hourlyRate > 0;

  const { data: avail, isLoading } = useQuery({
    queryKey: ["inst-book-avail", instrumentId],
    queryFn: () => fetchInstrumentAvailability(instrumentId, 14),
    enabled: bookable,
  });
  const { data: payStatus } = useQuery({ queryKey: ["payment-status"], queryFn: fetchPaymentStatus });

  const isTimeSlot = !avail || avail.capacityType !== "THROUGHPUT";
  const slotMinutes = avail?.slotMinutes ?? 60;

  const days = ((avail?.days as AvailabilityDay[]) ?? []).filter(
    (d) => !d.closed && (d.slots ?? []).some((s: AvailabilitySlot) => s.available)
  );
  const day = days[Math.min(dayIdx, Math.max(0, days.length - 1))];
  const allDaySlots = day?.slots ?? [];
  const slots = allDaySlots.filter((s) => s.available);

  const chosen = allDaySlots.find((s) => s.startAt === slotStart && s.available) ?? slots[0];
  const effectiveStart = chosen?.startAt ?? null;
  const startIndex = effectiveStart ? allDaySlots.findIndex((s) => s.startAt === effectiveStart) : -1;
  let maxDuration = 1;
  if (startIndex >= 0) {
    maxDuration = 0;
    for (let i = startIndex; i < allDaySlots.length && allDaySlots[i].available && maxDuration < 8; i++) maxDuration++;
  }
  const dur = Math.min(durationSlots, Math.max(1, maxDuration));
  const hours = (dur * slotMinutes) / 60;
  const amount = Math.round(hourlyRate * hours * 100) / 100;
  const endAt = effectiveStart ? new Date(new Date(effectiveStart).getTime() + dur * slotMinutes * 60000).toISOString() : null;

  async function loadRazorpay(): Promise<boolean> {
    if ((window as any).Razorpay) return true;
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true); s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });
  }

  async function book() {
    if (!effectiveStart || !endAt) { toast.push("error", "Pick a time slot first."); return; }
    setPending(true);
    try {
      const res = await checkoutBooking({
        instrumentId, startAt: effectiveStart, endAt,
        contactName: user?.name, contactEmail: user?.email,
      });
      if (!res.needsPayment) {
        setDone({ paid: false });
        toast.push("success", "Booking request sent — the facility will confirm shortly.");
        qc.invalidateQueries({ queryKey: ["inst-book-avail", instrumentId] });
        return;
      }
      const rp = res.razorpay!;
      const loaded = await loadRazorpay();
      if (!loaded) { toast.push("error", "Could not load the payment gateway."); return; }
      const rz = new (window as any).Razorpay({
        key: rp.keyId, amount: rp.amount, currency: rp.currency, name: "ITRO",
        description: `Booking · ${instrumentName}`, order_id: rp.orderId,
        prefill: { name: user?.name, email: user?.email },
        theme: { color: "#0d9488" },
        handler: async (resp: any) => {
          try {
            await verifyBookingPayment(res.bookingId, {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            setDone({ paid: true });
            toast.push("success", "Booking confirmed — payment received.");
            qc.invalidateQueries({ queryKey: ["inst-book-avail", instrumentId] });
          } catch (e: any) {
            toast.push("error", e?.response?.data?.message || "Payment verification failed.");
          }
        },
      });
      rz.on("payment.failed", () => toast.push("error", "Payment failed."));
      rz.open();
    } catch (e: any) {
      toast.push("error", e?.response?.data?.message || "Could not start booking.");
    } finally {
      setPending(false);
    }
  }

  if (!bookable) {
    return (
      <Card className="card-pad">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-muted">
          <CalendarCheck className="h-4 w-4" /> Booking
        </div>
        <p className="text-sm text-ink-soft">
          {status !== "AVAILABLE"
            ? `Currently ${status.toLowerCase()}. Contact the facility for the next available window.`
            : "This machine isn't set up for instant online booking. Request a service quote to schedule time."}
        </p>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="card-pad">
        <div className="flex items-center gap-2 text-brand-700">
          <CheckCircle2 className="h-5 w-5" />
          <h3 className="font-semibold">{done.paid ? "Booking confirmed" : "Request sent"}</h3>
        </div>
        <p className="mt-2 text-sm text-ink-soft">
          {done.paid
            ? "Your payment was received and the slot is reserved. Details are in your bookings."
            : "The facility will review and confirm your booking request."}
        </p>
        <Link to="/app" className="btn-secondary btn-sm mt-4 inline-flex">Go to dashboard</Link>
      </Card>
    );
  }

  return (
    <Card className="card-pad">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
        <CalendarCheck className="h-4 w-4 text-brand-600" /> Book this machine
      </div>
      <p className="text-xs text-ink-muted">{money(hourlyRate)} / hour</p>

      {isLoading ? (
        <div className="skeleton mt-4 h-28 w-full" />
      ) : !isTimeSlot ? (
        <p className="mt-3 text-sm text-ink-soft">This machine is booked per day. Request a service quote to schedule.</p>
      ) : days.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">No open slots in the next two weeks. Check back soon or request a quote.</p>
      ) : (
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">Date</label>
            <div className="flex flex-wrap gap-1.5">
              {days.slice(0, 8).map((d, i) => (
                <button key={d.date} onClick={() => { setDayIdx(i); setSlotStart(null); setDurationSlots(1); }}
                  className={clsx("rounded-lg border px-2.5 py-1.5 text-center text-xs font-medium leading-tight",
                    i === dayIdx ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-border text-ink-soft hover:border-brand-300")}>
                  {d.weekday}<br /><span className="text-[10px] text-ink-faint">{dateShort(d.date).replace(/ \d{4}$/, "")}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">Start time</label>
            <div className="flex flex-wrap gap-1.5">
              {slots.slice(0, 12).map((s) => (
                <button key={s.startAt} onClick={() => { setSlotStart(s.startAt ?? null); setDurationSlots(1); }}
                  className={clsx("rounded-md border px-2 py-1 text-xs font-medium",
                    effectiveStart === s.startAt ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-border text-ink-soft hover:border-brand-300")}>
                  {s.start}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">Duration</label>
            <div className="flex items-center gap-2">
              <select value={dur} onChange={(e) => setDurationSlots(Number(e.target.value))}
                className="rounded-lg border border-surface-border px-2 py-1.5 text-sm">
                {Array.from({ length: Math.max(1, maxDuration) }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{(n * slotMinutes) / 60} h ({n} slot{n > 1 ? "s" : ""})</option>
                ))}
              </select>
              <Clock className="h-4 w-4 text-ink-faint" />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-surface-border pt-3">
            <span className="text-sm text-ink-muted">Total</span>
            <span className="text-lg font-bold text-ink">{money(amount)}</span>
          </div>

          {!user ? (
            <Link to="/login" className="btn-primary btn-sm w-full justify-center"><LogIn className="h-4 w-4" /> Sign in to book</Link>
          ) : user.role !== "INDUSTRY_BUYER" ? (
            <p className="rounded-lg border border-surface-border bg-surface-subtle px-3 py-2 text-xs text-ink-muted">
              Online booking is available on buyer accounts.
            </p>
          ) : (
            <Button className="w-full justify-center" loading={pending} disabled={!effectiveStart} onClick={book}>
              <CreditCard className="h-4 w-4" /> {payStatus?.razorpay ? `Book & pay ${money(amount)}` : "Request booking"}
            </Button>
          )}
          <p className="text-[11px] text-ink-faint">
            {payStatus?.razorpay
              ? "Secure payment via Razorpay. The slot is held while you pay."
              : "No online payment configured — the facility will confirm your request."}
          </p>
        </div>
      )}
    </Card>
  );
}

function SideFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-2 text-ink-muted">{icon}{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}
