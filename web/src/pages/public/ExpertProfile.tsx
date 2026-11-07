import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  UserCog, Building2, MapPin, Award, ShieldCheck, CalendarClock, ArrowLeft, Send,
} from "lucide-react";
import { fetchPublicExpert } from "@/lib/queries";
import { useAuth, isBuyer } from "@/lib/auth";
import { money } from "@/lib/format";
import { Card, CardBody, Badge, LoadingBlock, ErrorState } from "@/components/ui";
import type { RatePeriod } from "@/lib/types";
import { useSeo } from "@/lib/useSeo";

const RATE_LABEL: Record<RatePeriod, string> = { HOURLY: "per hour", DAILY: "per day", PROJECT: "per project" };

export default function ExpertProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["public-expert", id],
    queryFn: () => fetchPublicExpert(id!),
    enabled: !!id,
  });

  useSeo({
    title: data ? `${data.name} - Research Expert | ITRO` : "Research Expert | ITRO",
    description: data?.bio || (data ? `${data.title} at ${data.institution?.name ?? "an ITRO network institution"}. View expertise and availability.` : "View researcher and technical expert profiles on ITRO."),
    canonicalPath: `/experts/${id ?? ""}`,
    robots: "noindex, nofollow",
  });

  if (isLoading) return <div className="mx-auto max-w-5xl px-4 py-10"><LoadingBlock /></div>;
  if (isError || !data) return <div className="mx-auto max-w-5xl px-4 py-10"><ErrorState error={error} /></div>;

  const inst = data.institution;

  // Engage: not logged in → login; buyers → their workspace to raise a request; else provider profile.
  function engage() {
    if (!user) { navigate("/login"); return; }
    if (isBuyer(user)) { navigate("/app"); return; }
    if (inst) { navigate(`/institutions/${inst.slug}`); return; }
    navigate("/login");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link to="/experts" className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to skilled resources
      </Link>

      <Card className="p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
            {data.photoUrl ? <img src={data.photoUrl} alt={data.name} className="h-full w-full object-cover" /> : <UserCog className="h-8 w-8" strokeWidth={1.5} />}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-ink">{data.name}</h1>
            <p className="mt-0.5 text-ink-muted">{data.title}</p>
            {inst && (
              <Link to={`/institutions/${inst.slug}`} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
                <Building2 className="h-4 w-4" /> {inst.name}
              </Link>
            )}
            {inst && (inst.city || inst.state) && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-muted">
                <MapPin className="h-4 w-4" /> {[inst.city, inst.state, inst.country].filter(Boolean).join(", ")}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {data.rate ? (
                <span className="text-lg font-bold text-ink">{money(data.rate)} <span className="text-sm font-normal text-ink-muted">{RATE_LABEL[data.ratePeriod]}</span></span>
              ) : null}
              {data.availability && (
                <Badge tone="gray"><span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {data.availability}</span></Badge>
              )}
              {data.experienceYears != null && (
                <Badge tone="brand"><span className="inline-flex items-center gap-1"><Award className="h-3.5 w-3.5" /> {data.experienceYears} yrs experience</span></Badge>
              )}
            </div>
          </div>
          <button onClick={engage} className="btn-primary shrink-0">
            <Send className="h-4 w-4" /> Engage / Request
          </button>
        </div>

        {data.bio && <p className="mt-6 whitespace-pre-line text-ink-soft">{data.bio}</p>}
      </Card>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {data.expertise && data.expertise.length > 0 && (
          <Card>
            <CardBody>
              <h2 className="section-title mb-3">Expertise</h2>
              <div className="flex flex-wrap gap-2">
                {data.expertise.map((e) => (
                  <span key={e} className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">{e}</span>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {data.skills && data.skills.length > 0 && (
          <Card>
            <CardBody>
              <h2 className="section-title mb-3">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {data.skills.map((s) => (
                  <span key={s} className="inline-flex items-center rounded-full bg-surface-muted px-3 py-1 text-sm font-medium text-ink-soft">{s}</span>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {data.certifications && data.certifications.length > 0 && (
          <Card>
            <CardBody>
              <h2 className="section-title mb-3">Certifications</h2>
              <ul className="space-y-2">
                {data.certifications.map((c) => (
                  <li key={c} className="inline-flex items-center gap-2 text-sm text-ink-soft">
                    <ShieldCheck className="h-4 w-4 text-brand-600" /> {c}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
