import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Building2, MapPin, ShieldCheck, UserCog, Mail, Phone,
  Microscope, ArrowRight, FlaskConical, Wrench, CalendarDays, Video, Users,
} from "lucide-react";
import { fetchPublicFacility } from "@/lib/queries";
import { money, dateTime } from "@/lib/format";
import { imageForCategory } from "@/lib/imagery";
import ServiceCard from "@/components/ServiceCard";
import ShareButton from "@/components/ShareButton";
import { Card, Badge, LoadingBlock, ErrorState, StatusBadge } from "@/components/ui";
import { useSeo } from "@/lib/useSeo";

export default function FacilityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: f, isLoading, isError, error } = useQuery({
    queryKey: ["public-facility", id],
    queryFn: () => fetchPublicFacility(id!),
    enabled: !!id,
  });

  useSeo({
    title: f ? `${f.name} | ${f.institution.name} | ITRO` : "Research Facility | ITRO",
    description: f?.description ?? (f ? `${f.name} at ${f.institution.name}. View facility information, instruments and services.` : "Explore research and testing facilities on ITRO."),
    canonicalPath: `/facilities/${id ?? ""}`,
  });

  const goBack = () =>
    location.key !== "default"
      ? navigate(-1)
      : navigate(f ? `/institutions/${f.institution.slug}` : "/providers");

  if (isLoading) return <div className="mx-auto max-w-6xl px-4 py-10"><LoadingBlock /></div>;
  if (isError || !f) return <div className="mx-auto max-w-6xl px-4 py-10"><ErrorState error={error} /></div>;

  const banner = f.imageUrl || imageForCategory(f.instruments[0]?.category ?? "lab", 1400);
  const loc = [f.location, f.institution.city, f.institution.state].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-5 flex items-center justify-between">
        <button onClick={goBack} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <ShareButton title={f.name} />
      </div>

      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl">
        <img src={banner} alt={f.name} className="h-52 w-full object-cover sm:h-60" loading="eager" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/92 via-ink/55 to-ink/20" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            {f.department && <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-ink">{f.department}</span>}
            <Link to={`/institutions/${f.institution.slug}`} className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-ink hover:bg-white">
              <Building2 className="h-3 w-3" /> {f.institution.name}
            </Link>
          </div>
          <h1 className="mt-2.5 text-3xl font-bold tracking-tight text-white drop-shadow-sm">{f.name}</h1>
          {loc && (
            <div className="mt-2 flex items-center gap-1.5 text-sm text-white/90">
              <MapPin className="h-4 w-4" /> {loc}
            </div>
          )}
        </div>
      </div>

      <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_320px]">
        {/* MAIN */}
        <div className="min-w-0 space-y-6">
          {f.description && (
            <Card className="card-pad">
              <h2 className="section-title mb-3">About this lab</h2>
              <p className="whitespace-pre-line text-ink-soft">{f.description}</p>
            </Card>
          )}

          {/* Equipment / machines */}
          <Card className="card-pad">
            <div className="mb-3 flex items-center gap-2">
              <Microscope className="h-4 w-4 text-brand-600" />
              <h2 className="section-title">Equipment &amp; machines ({f.instruments.length})</h2>
            </div>
            {f.instruments.length === 0 ? (
              <p className="text-sm text-ink-muted">No instruments listed for this lab yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {f.instruments.map((i) => (
                  <Link key={i.id} to={`/instruments/${i.id}`} className="group rounded-lg border border-surface-border p-4 transition hover:border-brand-300 hover:shadow-card">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="gray">{i.category}</Badge>
                      <StatusBadge status={i.status} />
                    </div>
                    <p className="mt-2 font-medium text-ink group-hover:text-brand-700">{i.name}</p>
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <span className="text-ink-muted">{[i.make, i.model].filter(Boolean).join(" · ") || " "}</span>
                      {i.hourlyRate > 0 && <span className="font-semibold text-ink">{money(i.hourlyRate)}<span className="text-xs font-normal text-ink-muted">/hr</span></span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Services / tests */}
          <Card className="card-pad">
            <div className="mb-3 flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-brand-600" />
              <h2 className="section-title">Testing services ({f.services.length})</h2>
            </div>
            {f.services.length === 0 ? (
              <p className="text-sm text-ink-muted">No services offered by this lab yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {f.services.map((s) => (
                  <ServiceCard key={s.id} service={{ ...s, institution: { ...(s.institution || {}), currency: f.institution.currency ?? "INR" } as any }} />
                ))}
              </div>
            )}
          </Card>

          {/* Events hosted by this lab */}
          {f.events && f.events.length > 0 && (
            <Card className="card-pad">
              <div className="mb-3 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-brand-600" />
                <h2 className="section-title">Upcoming events ({f.events.length})</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {f.events.map((e) => (
                  <Link key={e.id} to={`/events/${e.slug}`} className="group rounded-lg border border-surface-border p-4 transition hover:border-brand-300 hover:shadow-card">
                    <p className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700"><CalendarDays className="h-3.5 w-3.5" /> {dateTime(e.startAt)}</p>
                    <p className="mt-1.5 font-medium text-ink group-hover:text-brand-700 line-clamp-2">{e.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-muted">
                      <span className="inline-flex items-center gap-1">{e.mode === "ONLINE" ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />} {e.mode === "ONLINE" ? "Online" : (e.location || "In person")}</span>
                      {e.spotsLeft != null && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {e.spotsLeft === 0 ? "Full" : `${e.spotsLeft} left`}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* SIDEBAR — the team that runs this lab */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="card-pad">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
              <UserCog className="h-4 w-4 text-brand-600" /> Lab team &amp; contact
            </div>
            <div className="space-y-2.5 text-sm">
              {f.inchargeName ? (
                <Row icon={<UserCog className="h-4 w-4" />} label="In-charge" value={f.inchargeName} />
              ) : (
                <p className="text-ink-muted">This lab is operated by {f.institution.name}.</p>
              )}
              {f.contactEmail && <Row icon={<Mail className="h-4 w-4" />} label="Email" value={<a href={`mailto:${f.contactEmail}`} className="text-brand-700 hover:underline">{f.contactEmail}</a>} />}
              {f.contactPhone && <Row icon={<Phone className="h-4 w-4" />} label="Phone" value={f.contactPhone} />}
              <Row icon={<Building2 className="h-4 w-4" />} label="Institution" value={<Link to={`/institutions/${f.institution.slug}`} className="text-brand-700 hover:underline">{f.institution.name}</Link>} />
            </div>
          </Card>

          {f.accreditations && f.accreditations.length > 0 && (
            <Card className="card-pad">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-muted">
                <ShieldCheck className="h-4 w-4 text-brand-600" /> Accreditations
              </div>
              <div className="flex flex-wrap gap-2">
                {f.accreditations.map((a) => (
                  <span key={a} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                    <ShieldCheck className="h-3.5 w-3.5" /> {a}
                  </span>
                ))}
              </div>
            </Card>
          )}

          <Card className="card-pad">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-muted">
              <Wrench className="h-4 w-4" /> At a glance
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-ink-muted">Equipment</span><span className="font-medium text-ink">{f.instruments.length}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Services</span><span className="font-medium text-ink">{f.services.length}</span></div>
            </div>
            <Link to={`/institutions/${f.institution.slug}`} className="btn-secondary btn-sm mt-4 inline-flex w-full justify-center">
              All labs at {f.institution.name} <ArrowRight className="h-4 w-4" />
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 text-ink-muted">{icon}{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}
