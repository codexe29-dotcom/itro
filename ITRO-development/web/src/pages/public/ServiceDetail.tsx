import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft, ShieldCheck, Clock, Building2, MapPin, FileText, Wrench,
  Activity, CalendarCheck, GaugeCircle, CheckCircle2, AlertTriangle, Cpu,
  BadgeCheck, TrendingUp, Sparkles, ArrowRight, ListChecks, ExternalLink, Zap,
} from "lucide-react";
import clsx from "clsx";
import {
  fetchService, fetchServiceAvailability, fetchSimilarServices,
  fetchRecommendedServices, fetchServiceReviews,
} from "@/lib/queries";
import { money, dateShort } from "@/lib/format";
import { formatDistance } from "@/lib/locations";
import { imageForCategory } from "@/lib/imagery";
import { useAuth } from "@/lib/auth";
import { Card, Badge, LoadingBlock, ErrorState, Button, StatusBadge } from "@/components/ui";
import { RatingStars } from "@/components/RatingStars";
import AddToOrderButton from "@/components/AddToOrderButton";
import type { EquipmentCondition } from "@/lib/types";

export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: service, isLoading, isError, error } = useQuery({
    queryKey: ["service", id],
    queryFn: () => fetchService(id!),
    enabled: !!id,
  });
  // Must be declared before any early return — hooks can't run conditionally.
  const [expedited, setExpedited] = useState(false);

  if (isLoading) return <div className="mx-auto max-w-6xl px-4 py-10"><LoadingBlock /></div>;
  if (isError || !service)
    return <div className="mx-auto max-w-6xl px-4 py-10"><ErrorState error={error} /></div>;

  const org = service.institution;
  const inst = service.instrument;
  const rating = service.rating;
  const certs = service.certifications ?? (service.accreditation ? [service.accreditation] : []);
  // Photo gallery: prefer the service's own images, fall back to the linked instrument's images.
  const gallery = (service.images && service.images.length > 0)
    ? service.images
    : (inst?.images ?? []);
  const applications = inst?.applications ?? [];
  // Banner prefers an uploaded service/instrument image; falls back to the category stock photo.
  const banner = gallery[0] ?? imageForCategory(service.category, 1400);
  const pricingLabel: Record<string, string> = {
    FLAT: "Flat", PER_HOUR: "Per hour", PER_SAMPLE: "Per sample", PER_TEST: "Per test",
    PER_DAY: "Per day", PER_UNIT: "Per unit", TIERED: "Tiered",
  };
  const method = service.pricingMethod ?? "FLAT";
  const unit = service.unitLabel ?? "";
  const isFixed = service.pricingMode === "FIXED";
  const sidebarPrice = service.buyerPrice ?? service.priceIndustry;
  const hasRush = isFixed && service.rushDays != null && service.expeditedPrice != null;

  function onRequestQuote() {
    if (!user) navigate("/login", { state: { from: `/app/request/${service!.id}` } });
    else navigate(`/app/request/${service!.id}`);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/exchange" className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to catalog
      </Link>

      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl">
        <img src={banner} alt={service.category} className="h-56 w-full object-cover sm:h-64" loading="eager" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/92 via-ink/55 to-ink/25" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-ink">{service.category}</span>
            {certs.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 rounded-full bg-success/90 px-2.5 py-0.5 text-xs font-semibold text-white">
                <ShieldCheck className="h-3 w-3" /> {c}
              </span>
            ))}
          </div>
          <h1 className="mt-2.5 text-3xl font-bold tracking-tight text-white drop-shadow-sm">{service.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-white/90">
            {org && (
              <Link to={`/institutions/${org.slug}`} className="inline-flex items-center gap-1.5 font-medium text-white hover:underline">
                <Building2 className="h-4 w-4" /> {org.name}
              </Link>
            )}
            {org && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> {[org.city, org.state].filter(Boolean).join(", ")}
              </span>
            )}
            {rating && rating.count > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <RatingStars value={rating.avg} /> <span className="text-white/90">{rating.avg.toFixed(1)} ({rating.count})</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_360px]">
        {/* MAIN */}
        <div className="space-y-6 min-w-0">
          {/* Overview */}
          <Card className="card-pad">
            <h2 className="section-title mb-3">Overview</h2>
            {service.description && <p className="text-ink-soft">{service.description}</p>}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MiniStat icon={<Clock className="h-4 w-4" />} label="Turnaround" value={`${service.turnaroundDays} days`} />
              <MiniStat icon={<FileText className="h-4 w-4" />} label="Deliverable" value={service.deliverable ?? "Report"} />
              <MiniStat icon={<BadgeCheck className="h-4 w-4" />} label="Accreditation" value={certs[0] ?? "-"} />
            </div>
          </Card>

          {/* Photo gallery */}
          {gallery.length > 0 && (
            <Card className="card-pad">
              <h2 className="section-title mb-3">Photo gallery</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {gallery.map((url, idx) => (
                  <div key={url + idx} className="aspect-square overflow-hidden rounded-lg border border-surface-border bg-surface-muted">
                    <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Applications (from the linked instrument) */}
          {applications.length > 0 && (
            <Card className="card-pad">
              <div className="mb-3 flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-brand-600" />
                <h2 className="section-title">Applications</h2>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {applications.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-soft">
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /> {a}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Equipment & condition */}
          {inst && (
            <Card className="card-pad">
              <div className="flex items-center justify-between">
                <h2 className="section-title">Equipment & condition</h2>
                <StatusBadge status={inst.status} label={inst.status} />
              </div>
              <div className="mt-4 flex items-start gap-3">
                <div className="rounded-lg bg-brand-50 p-2.5 text-brand-600"><Cpu className="h-5 w-5" /></div>
                <div>
                  {inst.id ? (
                    <Link to={`/instruments/${inst.id}`} className="inline-flex items-center gap-1.5 font-semibold text-ink hover:text-brand-700">
                      {inst.name} <ExternalLink className="h-3.5 w-3.5 text-brand-500" />
                    </Link>
                  ) : (
                    <p className="font-semibold text-ink">{inst.name}</p>
                  )}
                  <p className="text-sm text-ink-muted">{[inst.make, inst.model].filter(Boolean).join(" · ") || inst.category}</p>
                  {inst.facility && (
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {[inst.facility.name, inst.facility.department, inst.facility.location].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {inst.id && (
                    <Link to={`/instruments/${inst.id}`} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                      View full instrument profile <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>

              <ConditionPanel condition={service.condition} inst={inst} />

              {inst.specs && Object.keys(inst.specs).length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-sm font-semibold text-ink-soft">Technical specifications</p>
                  <div className="overflow-hidden rounded-lg border border-surface-border">
                    <table className="w-full text-sm">
                      <tbody>
                        {Object.entries(inst.specs).map(([k, v], i) => (
                          <tr key={k} className={i % 2 ? "bg-surface-subtle" : ""}>
                            <td className="px-4 py-2 font-medium text-ink-soft capitalize w-1/3">{humanize(k)}</td>
                            <td className="px-4 py-2 text-ink">{renderSpec(v)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Certifications & compliance */}
          <Card className="card-pad">
            <h2 className="section-title mb-3">Certifications & compliance</h2>
            {certs.length ? (
              <div className="flex flex-wrap gap-2">
                {certs.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5 rounded-lg border border-success/30 bg-success-soft px-3 py-1.5 text-sm font-medium text-success">
                    <ShieldCheck className="h-4 w-4" /> {c}
                  </span>
                ))}
              </div>
            ) : <p className="text-sm text-ink-muted">No accreditation listed for this service.</p>}
            <p className="mt-3 text-xs text-ink-faint">
              Certifications are declared by the facility and verified by RIX during onboarding. Scope documents are shared under NDA on quote acceptance.
            </p>
          </Card>

          {/* Reviews */}
          <ReviewsSection serviceId={service.id} />

          {/* Compare similar facilities */}
          <SimilarSection serviceId={service.id} currency={org?.currency}
            coords={org?.latitude != null ? { lat: org.latitude, lng: org.longitude } : undefined} />

          {/* Recommended */}
          <RecommendedSection serviceId={service.id} currency={org?.currency} />
        </div>

        {/* SIDEBAR */}
        <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
          <Card className="card-pad">
            <div className="flex items-center justify-between">
              <p className="text-sm text-ink-muted">{isFixed ? "Price" : "Industry price"}</p>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                {isFixed ? "Fixed price" : (pricingLabel[method] ?? method)}
              </span>
            </div>
            <p className="mt-0.5 text-3xl font-bold text-ink">
              {money(isFixed ? (expedited && service.expeditedPrice != null ? service.expeditedPrice : sidebarPrice) : service.priceIndustry, org?.currency)}
              {unit && <span className="ml-1 text-sm font-normal text-ink-muted">{unit}</span>}
            </p>
            {isFixed && (service as any).listPrice != null && (service as any).listPrice > sidebarPrice && (
              <p className="mt-0.5 text-sm">
                <span className="text-ink-faint line-through">{money((service as any).listPrice, org?.currency)}</span>
                <span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-xs font-semibold text-orange-700">{(service as any).discountLabel || `${Math.round((service as any).discountPct)}% off`}</span>
              </p>
            )}
            <div className="mt-4 space-y-2 border-t border-surface-border pt-4 text-sm">
              {[
                { label: "Industry", value: service.priceIndustry },
                { label: "Academic", value: service.priceAcademic },
                { label: "Internal", value: service.priceInternal },
              ].map((r) => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-ink-muted">{r.label}{unit ? ` (${unit})` : ""}</span>
                  <span className="font-medium text-ink">{money(r.value, org?.currency)}</span>
                </div>
              ))}
              {(service.setupFee ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-ink-muted">Setup fee</span>
                  <span className="font-medium text-ink">{money(service.setupFee ?? 0, org?.currency)}</span>
                </div>
              )}
              {(service.minCharge ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-ink-muted">Minimum charge</span>
                  <span className="font-medium text-ink">{money(service.minCharge ?? 0, org?.currency)}</span>
                </div>
              )}
            </div>
            {hasRush && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Turnaround</p>
                <div className="space-y-2">
                  <button onClick={() => setExpedited(false)}
                    className={clsx("flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition",
                      !expedited ? "border-brand-400 bg-brand-50" : "border-surface-border hover:border-brand-300")}>
                    <span className="inline-flex items-center gap-2 font-medium text-ink"><Clock className="h-4 w-4 text-ink-muted" /> Standard · {service.turnaroundDays} days</span>
                    <span className="font-semibold text-ink">{money(sidebarPrice, org?.currency)}</span>
                  </button>
                  <button onClick={() => setExpedited(true)}
                    className={clsx("flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition",
                      expedited ? "border-orange-400 bg-orange-50" : "border-surface-border hover:border-orange-300")}>
                    <span className="inline-flex items-center gap-2 font-medium text-ink"><Zap className="h-4 w-4 text-orange-500" /> Expedited · {service.rushDays} days</span>
                    <span className="font-semibold text-ink">{money(service.expeditedPrice, org?.currency)}</span>
                  </button>
                </div>
              </div>
            )}
            {isFixed ? (
              <div className="mt-5 space-y-2">
                <AddToOrderButton service={service} className="w-full" expedited={expedited} label={expedited ? "Add expedited to order" : undefined} />
                <Button variant="secondary" className="w-full" onClick={onRequestQuote}>Request a quote</Button>
              </div>
            ) : (
              <div className="mt-5 space-y-2">
                <Button className="w-full" onClick={onRequestQuote}>Request a quote</Button>
                <AddToOrderButton service={service} variant="secondary" className="w-full" />
              </div>
            )}
            {!user && <p className="mt-2 text-center text-xs text-ink-muted">You'll be asked to sign in first.</p>}

            <div className="mt-5 space-y-2.5 border-t border-surface-border pt-4 text-sm">
              <SideFact icon={<Clock className="h-4 w-4" />} label="Turnaround" value={`${service.turnaroundDays} days`} />
              <SideFact icon={<BadgeCheck className="h-4 w-4" />} label="Certified" value={certs[0] ?? "-"} />
              {rating && rating.count > 0 && (
                <SideFact icon={<TrendingUp className="h-4 w-4" />} label="Rating" value={`${rating.avg.toFixed(1)} (${rating.count})`} />
              )}
              {org && (
                <SideFact icon={<MapPin className="h-4 w-4" />} label="Location" value={[org.city, org.state].filter(Boolean).join(", ") || "-"} />
              )}
            </div>
          </Card>
          <NextAvailableCard serviceId={service.id} schedule={service.schedule} />
        </div>
      </div>
    </div>
  );
}

/* ---------------- sub-components ---------------- */

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface-subtle px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">{icon} {label}</div>
      <p className="mt-1 text-sm font-semibold text-ink line-clamp-2">{value}</p>
    </div>
  );
}

function SideFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-2 text-ink-muted">{icon}{label}</span>
      <span className="font-medium text-ink text-right">{value}</span>
    </div>
  );
}

function ConditionPanel({ condition, inst }: { condition?: EquipmentCondition | null; inst: any }) {
  const util = Math.round((condition?.utilizationPct ?? 0) * 100);
  const uptime = Math.round((condition?.uptimePct ?? inst.uptimePct ?? 0) * 100);
  const health = condition?.healthLabel ?? (inst.status === "MAINTENANCE" ? "Under maintenance" : "Good");
  const dueSoon = condition?.calibrationDueSoon;
  const nextCal = condition?.nextCalibrationAt ?? condition?.nextCalibratedAt ?? inst.nextCalibrationAt;
  const lastCal = condition?.lastCalibratedAt ?? inst.lastCalibratedAt;

  const healthTone = health === "Excellent" ? "text-success" : health === "Under maintenance" ? "text-danger"
    : dueSoon ? "text-warning" : "text-success";

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-surface-border p-3.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted"><Activity className="h-4 w-4" /> Health</div>
        <p className={clsx("mt-1 font-semibold flex items-center gap-1.5", healthTone)}>
          {health === "Under maintenance" ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} {health}
        </p>
      </div>
      <div className="rounded-lg border border-surface-border p-3.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted"><Wrench className="h-4 w-4" /> Calibration</div>
        <p className="mt-1 text-sm text-ink">
          {lastCal ? `Last ${dateShort(lastCal)}` : "-"}
          {nextCal && <span className={clsx("block text-xs", dueSoon ? "text-warning font-medium" : "text-ink-faint")}>Next {dateShort(nextCal)}{dueSoon ? " · due soon" : ""}</span>}
        </p>
      </div>
      <Meter icon={<GaugeCircle className="h-4 w-4" />} label="Utilization (30d)" pct={util} tone="brand" />
      <Meter icon={<TrendingUp className="h-4 w-4" />} label="Uptime" pct={uptime} tone="success" />
    </div>
  );
}

function Meter({ icon, label, pct, tone }: { icon: React.ReactNode; label: string; pct: number; tone: "brand" | "success" }) {
  const bar = tone === "success" ? "bg-success" : "bg-brand-500";
  return (
    <div className="rounded-lg border border-surface-border p-3.5">
      <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
        <span className="inline-flex items-center gap-1.5">{icon} {label}</span>
        <span className="text-ink font-semibold">{pct}%</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
        <div className={clsx("h-full rounded-full", bar)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

function NextAvailableCard({ serviceId, schedule }: { serviceId: string; schedule?: import("@/lib/types").ServiceSchedule }) {
  const { data } = useQuery({ queryKey: ["availability", serviceId], queryFn: () => fetchServiceAvailability(serviceId, 8) });
  if (!data || !data.instrumentId) return null;
  const start = schedule?.nextAvailableStart ?? data.nextAvailable;
  return (
    <Card className="card-pad">
      <div className="flex items-center gap-2 text-sm font-medium text-ink-muted"><CalendarCheck className="h-4 w-4" /> Available from</div>
      <p className="mt-1 text-lg font-semibold text-ink">{start ? dateShort(start) : "On request"}</p>
      {schedule?.estimatedCompletion && (
        <p className="mt-1 text-sm text-ink-muted">Est. completion <span className="font-medium text-ink">{dateShort(schedule.estimatedCompletion)}</span></p>
      )}
      {schedule && schedule.queueDepth > 0 && (
        <p className="mt-1 text-xs text-ink-faint">{schedule.queueDepth} job{schedule.queueDepth === 1 ? "" : "s"} ahead in queue</p>
      )}
    </Card>
  );
}

function ReviewsSection({ serviceId }: { serviceId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["reviews", serviceId], queryFn: () => fetchServiceReviews(serviceId) });
  if (isLoading) return <Card className="card-pad"><h2 className="section-title mb-3">Reviews</h2><div className="skeleton h-20 w-full" /></Card>;
  if (!data || data.count === 0) return null;

  const dist = data.distribution ?? {};
  return (
    <Card className="card-pad">
      <h2 className="section-title mb-4">Reviews & ratings</h2>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="text-center sm:w-40 shrink-0">
          <p className="text-4xl font-bold text-ink">{data.avg.toFixed(1)}</p>
          <RatingStars value={data.avg} />
          <p className="mt-1 text-xs text-ink-muted">{data.count} verified {data.count === 1 ? "review" : "reviews"}</p>
        </div>
        <div className="flex-1 space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const n = dist[String(star)] ?? 0;
            const pct = data.count ? (n / data.count) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-ink-muted">{star}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-6 text-right text-ink-faint">{n}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-5 space-y-3 border-t border-surface-border pt-4">
        {data.items.slice(0, 4).map((r) => (
          <div key={r.id} className="rounded-lg border border-surface-border p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RatingStars value={r.rating} size={13} />
                <span className="text-sm font-medium text-ink">{r.author}</span>
                <span className="badge-success text-[10px]"><CheckCircle2 className="h-3 w-3" /> Verified</span>
              </div>
              <span className="text-xs text-ink-faint">{dateShort(r.date)}</span>
            </div>
            {r.comment && <p className="mt-1.5 text-sm text-ink-soft">{r.comment}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}

function SimilarSection({ serviceId, currency, coords }:
  { serviceId: string; currency?: string; coords?: { lat: number; lng?: number } }) {
  const { data, isLoading } = useQuery({
    queryKey: ["similar", serviceId, coords?.lat],
    queryFn: () => fetchSimilarServices(serviceId, coords ? { lat: coords.lat, lng: coords.lng } : undefined),
  });
  if (isLoading) return <Card className="card-pad"><h2 className="section-title mb-3">Compare similar facilities</h2><div className="skeleton h-24 w-full" /></Card>;
  if (!data || data.length <= 1) return null;

  return (
    <Card>
      <div className="card-pad pb-3">
        <h2 className="section-title">Compare similar facilities</h2>
        <p className="mt-1 text-sm text-ink-muted">Same service offered across the catalog - price, distance, turnaround and trust, side by side.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {["Facility", "Location", "Distance", "Industry price", "Turnaround", "Accreditation", "Rating", ""].map((h) => (
                <th key={h} className="th whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.id} className={clsx(s.isCurrent && "bg-brand-50/60")}>
                <td className="td font-medium text-ink">
                  <div className="flex items-center gap-2">
                    {s.institution.name}
                    {s.isCurrent && <span className="badge-brand text-[10px]">This one</span>}
                  </div>
                </td>
                <td className="td whitespace-nowrap text-ink-muted">{[s.institution.city, s.institution.state].filter(Boolean).join(", ")}</td>
                <td className="td whitespace-nowrap">{formatDistance(s.distanceKm)}</td>
                <td className="td whitespace-nowrap font-semibold text-ink">{money(s.priceIndustry, currency)}</td>
                <td className="td whitespace-nowrap">{s.turnaroundDays} days</td>
                <td className="td whitespace-nowrap">{s.accreditation ? <span className="badge-success">{s.accreditation}</span> : "-"}</td>
                <td className="td whitespace-nowrap">{s.rating.count ? <RatingStars value={s.rating.avg} size={13} showValue count={s.rating.count} /> : <span className="text-ink-faint">New</span>}</td>
                <td className="td">
                  {s.isCurrent
                    ? <span className="text-xs text-ink-faint">Viewing</span>
                    : <Link to={`/services/${s.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">View <ArrowRight className="h-3 w-3" /></Link>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RecommendedSection({ serviceId, currency }: { serviceId: string; currency?: string }) {
  const { data } = useQuery({ queryKey: ["recommended", serviceId], queryFn: () => fetchRecommendedServices(serviceId) });
  if (!data || data.length === 0) return null;
  return (
    <Card className="card-pad">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-brand-600" />
        <h2 className="section-title">Often needed together</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.map((s) => (
          <Link key={s.id} to={`/services/${s.id}`} className="group rounded-lg border border-surface-border p-4 hover:border-brand-300 hover:shadow-card transition">
            <div className="flex items-center justify-between">
              <Badge tone="gray">{s.category}</Badge>
              {s.accreditation && <span className="text-xs text-success font-medium">{s.accreditation}</span>}
            </div>
            <p className="mt-2 font-medium text-ink group-hover:text-brand-700">{s.name}</p>
            <p className="mt-1 text-sm text-ink-muted">{money(s.priceIndustry, currency)} · {s.turnaroundDays} days</p>
          </Link>
        ))}
      </div>
    </Card>
  );
}

/* ---------------- helpers ---------------- */
function humanize(k: string): string {
  return k.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").replace(/^\w/, (c) => c.toUpperCase()).trim();
}
function renderSpec(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (v && typeof v === "object") return Object.entries(v).map(([k, val]) => `${k}: ${val}`).join(", ");
  return String(v);
}
