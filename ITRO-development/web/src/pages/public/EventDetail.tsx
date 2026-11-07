import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, CalendarDays, MapPin, Video, Building2, Users, CheckCircle2, LogIn, ExternalLink, Clock,
} from "lucide-react";
import { fetchEvent, registerEvent, cancelEventRegistration } from "@/lib/queries";
import { dateTime, money } from "@/lib/format";
import { imageForCategory } from "@/lib/imagery";
import { useAuth } from "@/lib/auth";
import { Card, LoadingBlock, ErrorState, Button, Badge, useToast } from "@/components/ui";
import ShareButton from "@/components/ShareButton";
import { EVENT_TYPE_LABEL } from "./Events";

export default function EventDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const { data: e, isLoading, isError, error } = useQuery({
    queryKey: ["event", slug],
    queryFn: () => fetchEvent(slug!),
    enabled: !!slug,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["event", slug] });
  const register = useMutation({
    mutationFn: () => registerEvent(e!.id),
    onSuccess: () => { toast.push("success", "You're registered!"); invalidate(); },
    onError: (err: any) => toast.push("error", err?.response?.data?.message || "Could not register."),
  });
  const cancel = useMutation({
    mutationFn: () => cancelEventRegistration(e!.id),
    onSuccess: () => { toast.push("success", "Registration cancelled."); invalidate(); },
    onError: (err: any) => toast.push("error", err?.response?.data?.message || "Could not cancel."),
  });

  const goBack = () => (location.key !== "default" ? navigate(-1) : navigate("/events"));

  if (isLoading) return <div className="mx-auto max-w-5xl px-4 py-10"><LoadingBlock /></div>;
  if (isError || !e) return <div className="mx-auto max-w-5xl px-4 py-10"><ErrorState error={error} /></div>;

  const banner = e.imageUrl || imageForCategory(e.type, 1400);
  const isFull = e.spotsLeft === 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <button onClick={goBack} className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to events
      </button>

      <div className="relative overflow-hidden rounded-2xl">
        <img src={banner} alt={e.title} className="h-52 w-full object-cover sm:h-64" loading="eager" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/92 via-ink/50 to-ink/15" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-ink">{EVENT_TYPE_LABEL[e.type] ?? e.type}</span>
            <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-ink">{e.mode === "ONLINE" ? "Online" : e.mode === "HYBRID" ? "Hybrid" : "In person"}</span>
            {e.price === 0 && <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white">Free</span>}
          </div>
          <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-white drop-shadow-sm sm:text-3xl">{e.title}</h1>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-white/90"><CalendarDays className="h-4 w-4" /> {dateTime(e.startAt)}{e.endAt ? ` – ${dateTime(e.endAt)}` : ""}</p>
        </div>
      </div>

      <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {e.description && (
            <Card className="card-pad">
              <h2 className="section-title mb-3">About this event</h2>
              <p className="whitespace-pre-line text-ink-soft">{e.description}</p>
            </Card>
          )}
          <Card className="card-pad">
            <h2 className="section-title mb-3">Details</h2>
            <div className="space-y-2.5 text-sm">
              <Row icon={<CalendarDays className="h-4 w-4" />} label="When" value={`${dateTime(e.startAt)}${e.endAt ? ` – ${dateTime(e.endAt)}` : ""}`} />
              {e.mode !== "ONLINE" && <Row icon={<MapPin className="h-4 w-4" />} label="Where" value={e.location || [e.institution?.city, e.institution?.state].filter(Boolean).join(", ") || "In person"} />}
              {(e.mode === "ONLINE" || e.mode === "HYBRID") && e.onlineUrl && <Row icon={<Video className="h-4 w-4" />} label="Online" value={<a href={e.onlineUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">Join link <ExternalLink className="h-3 w-3" /></a>} />}
              {e.institution && <Row icon={<Building2 className="h-4 w-4" />} label="Host" value={<Link to={`/institutions/${e.institution.slug}`} className="text-brand-700 hover:underline">{e.institution.name}</Link>} />}
              {e.facility && <Row icon={<Building2 className="h-4 w-4" />} label="Lab" value={<Link to={`/facilities/${e.facility.id}`} className="text-brand-700 hover:underline">{e.facility.name}</Link>} />}
              {e.capacity != null && <Row icon={<Users className="h-4 w-4" />} label="Capacity" value={`${e.registeredCount ?? 0} / ${e.capacity} registered`} />}
            </div>
          </Card>
        </div>

        {/* Register / share */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="card-pad">
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-bold text-ink">{e.price > 0 ? money(e.price) : "Free"}</p>
              {e.spotsLeft != null && <Badge tone={e.spotsLeft === 0 ? "danger" : "success"}>{e.spotsLeft === 0 ? "Full" : `${e.spotsLeft} left`}</Badge>}
            </div>

            <div className="mt-4">
              {e.registered ? (
                <>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">
                    <CheckCircle2 className="h-4 w-4" /> You're registered
                  </div>
                  <Button variant="secondary" className="w-full justify-center" loading={cancel.isPending} onClick={() => cancel.mutate()}>Cancel registration</Button>
                </>
              ) : !user ? (
                <Link to="/login" className="btn-primary w-full justify-center"><LogIn className="h-4 w-4" /> Sign in to register</Link>
              ) : (
                <Button className="w-full justify-center" loading={register.isPending} disabled={isFull} onClick={() => register.mutate()}>
                  {isFull ? "Event is full" : "Register"}
                </Button>
              )}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-faint"><Clock className="h-3.5 w-3.5" /> {dateTime(e.startAt)}</p>
          </Card>

          <Card className="card-pad">
            <p className="mb-2 text-sm font-medium text-ink-muted">Share this event</p>
            <ShareButton title={e.title} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="inline-flex items-center gap-2 text-ink-muted">{icon}{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}
