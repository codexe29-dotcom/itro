import { useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { MapPin, ShieldCheck, Building2, Package, UserCog, ArrowRight, Navigation, Search, ExternalLink, AlertTriangle, Boxes, TrendingDown, ShoppingCart, CalendarDays, Users, Video } from "lucide-react";
import { fetchInstitution } from "@/lib/queries";
import { fetchLabBundles } from "@/lib/bundles";
import { money, dateTime } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import type { Facility, Service, Expert, EventItem } from "@/lib/types";
import ServiceCard from "@/components/ServiceCard";
import ShareButton from "@/components/ShareButton";
import { BundleCard } from "@/components/BundleCard";
import { RatingStars } from "@/components/RatingStars";
import { Card, Badge, Input, Button, LoadingBlock, ErrorState, EmptyState, useToast } from "@/components/ui";
import { Star } from "lucide-react";

interface ProviderReview {
  id: string; rating: number; comment?: string | null;
  author: string; service: string; date: string; orderCode: string;
}
interface AccreditationRecord {
  id: string; body: string; certNumber?: string | null; scope: string[];
  issuedAt?: string | null; expiresAt?: string | null; verifyUrl?: string | null;
  status: "ACTIVE" | "EXPIRING" | "EXPIRED" | "UNKNOWN";
}
interface InstitutionDetail {
  id: string; name: string; slug: string; type: string;
  addressLine1?: string; addressLine2?: string; postalCode?: string;
  city?: string; state?: string; country: string; about?: string;
  latitude?: number; longitude?: number;
  logoUrl?: string; accreditations: string[]; currency: string;
  facilities?: Facility[]; services?: Service[]; experts?: Expert[]; events?: EventItem[];
  rating?: { avg: number; count: number };
  reviews?: { avg: number; count: number; distribution: Record<string, number>; items: ProviderReview[] };
  accreditationRecords?: AccreditationRecord[];
}

const RATE_LABEL: Record<string, string> = { HOURLY: "/ hr", DAILY: "/ day", PROJECT: "/ project" };
type TabKey = "services" | "experts" | "facilities" | "events" | "reviews";

export default function InstitutionProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [tab, setTab] = useState<TabKey>("services");
  const [svcQ, setSvcQ] = useState("");
  const [expQ, setExpQ] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["institution", slug],
    queryFn: () => fetchInstitution(slug!) as Promise<InstitutionDetail>,
    enabled: !!slug,
  });

  const services = data?.services ?? [];
  const facilities = data?.facilities ?? [];
  const events = data?.events ?? [];
  const experts = useMemo(() => (data?.experts ?? []).filter((e) => e.isActive), [data]);

  const filteredServices = useMemo(() => {
    const q = svcQ.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => `${s.name} ${s.category} ${s.description ?? ""}`.toLowerCase().includes(q));
  }, [services, svcQ]);

  const filteredExperts = useMemo(() => {
    const q = expQ.trim().toLowerCase();
    if (!q) return experts;
    return experts.filter((x) =>
      `${x.name} ${x.title} ${(x.expertise ?? []).join(" ")} ${(x.skills ?? []).join(" ")}`.toLowerCase().includes(q));
  }, [experts, expQ]);

  if (isLoading) return <div className="mx-auto max-w-6xl px-4 py-10"><LoadingBlock /></div>;
  if (isError || !data)
    return <div className="mx-auto max-w-6xl px-4 py-10"><ErrorState error={error} /></div>;

  const hasCoords = typeof data.latitude === "number" && typeof data.longitude === "number";
  const addressLines = [
    data.addressLine1, data.addressLine2,
    [data.city, data.state, data.postalCode].filter(Boolean).join(", "), data.country,
  ].filter(Boolean);
  const directionsHref = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${data.latitude},${data.longitude}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([data.name, ...addressLines].filter(Boolean).join(", "))}`;

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "services", label: "Testing services", count: services.length },
    { key: "experts", label: "Experts & team", count: experts.length },
    { key: "facilities", label: "Facilities", count: facilities.length },
    { key: "events", label: "Events", count: events.length },
    { key: "reviews", label: "Reviews", count: data.reviews?.count ?? 0 },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <Card className="p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-50 text-brand-600">
            {data.logoUrl ? <img src={data.logoUrl} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-7 w-7" />}
          </span>
          <div className="min-w-0 flex-1">
            <Badge tone="gray">{data.type}</Badge>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">{data.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {[data.city, data.state, data.country].filter(Boolean).join(", ")}
              </span>
              {data.rating && data.rating.count > 0 && (
                <button onClick={() => setTab("reviews")} className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-2 py-0.5 hover:bg-surface-muted" title="See reviews">
                  <RatingStars value={data.rating.avg} size={14} showValue count={data.rating.count} />
                </button>
              )}
              {(hasCoords || addressLines.length > 0) && (
                <a href={directionsHref} target="_blank" rel="noreferrer" title="Open in maps / get directions"
                  className="inline-flex items-center gap-1 rounded-md border border-surface-border px-2 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-50">
                  <Navigation className="h-3.5 w-3.5" /> Map
                </a>
              )}
            </div>
            {(data.accreditationRecords && data.accreditationRecords.length > 0) ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.accreditationRecords.map((a) => <AccredChip key={a.id} a={a} />)}
              </div>
            ) : data.accreditations?.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.accreditations.map((a) => (
                  <span key={a} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                    <ShieldCheck className="h-3.5 w-3.5" /> {a}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="shrink-0"><ShareButton title={data.name} /></div>
        </div>
        {data.about && <p className="mt-5 whitespace-pre-line text-ink-soft">{data.about}</p>}
      </Card>

      {/* Accreditations & verification — accreditation as the product */}
      {data.accreditationRecords && data.accreditationRecords.length > 0 && (
        <Card className="mt-6 p-6 sm:p-8">
          <h2 className="section-title mb-4 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand-600" /> Accreditations &amp; verification</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.accreditationRecords.map((a) => (
              <div key={a.id} className="rounded-lg border border-surface-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink">{a.body}</span>
                  <AccredStatusBadge status={a.status} />
                </div>
                {a.certNumber && <p className="mt-0.5 text-xs text-ink-muted">Cert no. {a.certNumber}</p>}
                {a.scope.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {a.scope.slice(0, 6).map((s) => <span key={s} className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] text-ink-muted">{s}</span>)}
                  </div>
                )}
                <div className="mt-2.5 flex items-center justify-between text-xs text-ink-faint">
                  <span>{a.expiresAt ? `Valid till ${new Date(a.expiresAt).toLocaleDateString()}` : "Validity on file with issuer"}</span>
                  {a.verifyUrl && (
                    <a href={a.verifyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
                      Verify <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-faint">Accreditation status is derived from each certificate's validity. Use “Verify” to confirm with the issuing body.</p>
        </Card>
      )}

      {/* Tabs */}
      <div className="mt-8 border-b border-surface-border">
        <div className="-mb-px flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={clsx("border-b-2 px-4 py-2.5 text-sm font-semibold transition",
                tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-ink-muted hover:text-ink")}>
              {t.label} <span className="ml-1 text-xs text-ink-faint">({t.count})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {/* Services */}
        {tab === "services" && (
          <>
            <LabBundles slug={slug!} currency={data.currency} />
            {services.length > 0 && (
              <div className="relative mb-5 max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <Input value={svcQ} onChange={(e) => setSvcQ(e.target.value)} placeholder="Search services…" className="pl-9" />
              </div>
            )}
            {filteredServices.length === 0 ? (
              <Card><EmptyState icon={<Package className="h-6 w-6" />} title={services.length ? "No matching services" : "No published services"} description={services.length ? "Try a different search." : "This provider hasn't listed services yet."} /></Card>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredServices.map((s) => (
                  <ServiceCard key={s.id} service={{ ...s, institution: { ...(s.institution || {}), currency: data.currency } as any }} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Experts */}
        {tab === "experts" && (
          <>
            {experts.length > 0 && (
              <div className="relative mb-5 max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <Input value={expQ} onChange={(e) => setExpQ(e.target.value)} placeholder="Search by name, title or skill…" className="pl-9" />
              </div>
            )}
            {filteredExperts.length === 0 ? (
              <Card><EmptyState icon={<UserCog className="h-6 w-6" />} title={experts.length ? "No matching experts" : "No experts listed"} description={experts.length ? "Try a different search." : "This provider hasn't added experts yet."} /></Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredExperts.map((x) => (
                  <Link key={x.id} to={`/experts/${x.id}`} className="group card p-5 transition hover:border-brand-300 hover:shadow-pop">
                    <div className="flex items-start gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
                        {x.photoUrl ? <img src={x.photoUrl} alt={x.name} className="h-full w-full object-cover" /> : <UserCog className="h-5 w-5" strokeWidth={1.5} />}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-ink group-hover:text-brand-700">{x.name}</p>
                        <p className="text-sm text-ink-muted">{x.title}</p>
                      </div>
                    </div>
                    {x.expertise && x.expertise.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {x.expertise.slice(0, 3).map((e) => (
                          <span key={e} className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-ink-soft">{e}</span>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between border-t border-surface-border pt-3 text-sm">
                      {x.rate ? (
                        <span className="font-semibold text-ink">{money(x.rate, data.currency)} <span className="text-xs font-normal text-ink-muted">{RATE_LABEL[x.ratePeriod]}</span></span>
                      ) : <span className="text-ink-muted">View profile</span>}
                      <span className="inline-flex items-center gap-1 font-semibold text-brand-700">View <ArrowRight className="h-3.5 w-3.5" /></span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* Facilities — each is an independently-run lab (team, equipment & tests) */}
        {tab === "facilities" && (
          facilities.length === 0 ? (
            <Card><EmptyState icon={<Building2 className="h-6 w-6" />} title="No facilities listed" description="This provider hasn't added facilities yet." /></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {facilities.map((f) => {
                const svcCount = services.filter((s) => s.facilityId === f.id).length;
                const instCount = f.instruments?.length ?? 0;
                return (
                  <Link key={f.id} to={`/facilities/${f.id}`} className="group card p-5 transition hover:border-brand-300 hover:shadow-pop">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-ink group-hover:text-brand-700">{f.name}</p>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
                    </div>
                    {f.department && <p className="text-sm text-ink-muted">{f.department}</p>}
                    {f.inchargeName && (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-soft">
                        <UserCog className="h-3.5 w-3.5 text-brand-600" /> {f.inchargeName}
                      </p>
                    )}
                    {f.description && <p className="mt-2 text-sm text-ink-soft line-clamp-2">{f.description}</p>}
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-surface-border pt-3 text-xs text-ink-muted">
                      <span className="inline-flex items-center gap-1"><Boxes className="h-3.5 w-3.5" /> {instCount} equipment</span>
                      <span className="inline-flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {svcCount} service{svcCount === 1 ? "" : "s"}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )
        )}

        {/* Events */}
        {tab === "events" && (
          events.length === 0 ? (
            <Card><EmptyState icon={<CalendarDays className="h-6 w-6" />} title="No upcoming events" description="This lab hasn't posted any workshops or webinars yet." /></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((e) => (
                <Link key={e.id} to={`/events/${e.slug}`} className="group card p-5 transition hover:border-brand-300 hover:shadow-pop">
                  <p className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700"><CalendarDays className="h-3.5 w-3.5" /> {dateTime(e.startAt)}</p>
                  <h3 className="mt-1.5 font-semibold text-ink group-hover:text-brand-700 line-clamp-2">{e.title}</h3>
                  <div className="mt-1.5 space-y-1 text-xs text-ink-muted">
                    <span className="flex items-center gap-1.5">{e.mode === "ONLINE" ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />} {e.mode === "ONLINE" ? "Online" : (e.location || "In person")}</span>
                    {e.spotsLeft != null && <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {e.spotsLeft === 0 ? "Full" : `${e.spotsLeft} spots left`}</span>}
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {/* Reviews */}
        {tab === "reviews" && (
          !data.reviews || data.reviews.count === 0 ? (
            <Card><EmptyState icon={<Star className="h-6 w-6" />} title="No reviews yet" description="Buyers can review this provider after an order is completed." /></Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
              <Card className="h-fit p-6 text-center">
                <p className="text-4xl font-bold text-ink">{data.reviews.avg.toFixed(1)}</p>
                <div className="mt-1 flex justify-center"><RatingStars value={data.reviews.avg} /></div>
                <p className="mt-1 text-xs text-ink-muted">{data.reviews.count} verified {data.reviews.count === 1 ? "review" : "reviews"}</p>
                <div className="mt-4 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((n) => {
                    const c = data.reviews!.distribution[String(n)] ?? 0;
                    const pct = data.reviews!.count ? (c / data.reviews!.count) * 100 : 0;
                    return (
                      <div key={n} className="flex items-center gap-2 text-xs">
                        <span className="w-3 text-ink-muted">{n}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                          <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-6 text-right text-ink-faint">{c}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
              <div className="space-y-4">
                {data.reviews.items.map((r) => (
                  <Card key={r.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{r.author}</p>
                        <p className="text-xs text-ink-muted">{r.service}</p>
                      </div>
                      <RatingStars value={r.rating} size={14} />
                    </div>
                    {r.comment && <p className="mt-2 text-sm text-ink-soft">“{r.comment}”</p>}
                    <p className="mt-2 text-xs text-ink-faint">{new Date(r.date).toLocaleDateString()} · {r.orderCode}</p>
                  </Card>
                ))}
              </div>
            </div>
          )
        )}
      </div>

      <div className="mt-8">
        <Link to="/exchange" className="text-sm font-medium text-brand-700 hover:underline">← Back to exchange</Link>
      </div>
    </div>
  );
}

function LabBundles({ slug, currency }: { slug: string; currency: string }) {
  const { data: bundles } = useQuery({ queryKey: ["lab-bundles", slug], queryFn: () => fetchLabBundles(slug) });
  if (!bundles || bundles.length === 0) return null;
  return (
    <div className="mb-6">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><Boxes className="h-4 w-4 text-brand-600" /> Bundles &amp; packages</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bundles.map((b) => <BundleCard key={b.id} b={b} currency={currency} showInstitution={false} />)}
      </div>
    </div>
  );
}

function accredStyle(status: AccreditationRecord["status"]) {
  switch (status) {
    case "EXPIRED": return "border-surface-border bg-surface-muted text-ink-soft";
    case "EXPIRING": return "border-orange-200 bg-orange-50 text-orange-700";
    default: return "border-brand-100 bg-brand-50 text-brand-700"; // ACTIVE / UNKNOWN
  }
}

function AccredChip({ a }: { a: AccreditationRecord }) {
  const inner = (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", accredStyle(a.status))}>
      {a.status === "EXPIRED" || a.status === "EXPIRING" ? <AlertTriangle className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
      {a.body}{a.certNumber ? ` · ${a.certNumber}` : ""}
      {a.status === "EXPIRING" && <span className="font-semibold">· expiring</span>}
      {a.status === "EXPIRED" && <span className="font-semibold">· expired</span>}
      {a.verifyUrl && <ExternalLink className="h-3 w-3 opacity-70" />}
    </span>
  );
  return a.verifyUrl
    ? <a href={a.verifyUrl} target="_blank" rel="noreferrer" title="Verify certificate with the issuing body">{inner}</a>
    : inner;
}

function AccredStatusBadge({ status }: { status: AccreditationRecord["status"] }) {
  const label = { ACTIVE: "Active", EXPIRING: "Expiring soon", EXPIRED: "Expired", UNKNOWN: "On file" }[status];
  return <span className={clsx("rounded-full border px-2 py-0.5 text-[11px] font-semibold", accredStyle(status))}>{label}</span>;
}
