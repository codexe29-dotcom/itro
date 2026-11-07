import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, Search, Users, Video, Building2, ArrowRight } from "lucide-react";
import clsx from "clsx";
import { fetchEvents } from "@/lib/queries";
import type { EventItem } from "@/lib/types";
import { dateTime } from "@/lib/format";
import { imageForCategory } from "@/lib/imagery";
import { Input, LoadingBlock, ErrorState, EmptyState, Card } from "@/components/ui";
import { useSeo } from "@/lib/useSeo";

export const EVENT_TYPE_LABEL: Record<string, string> = {
  WORKSHOP: "Workshop", WEBINAR: "Webinar", TRAINING: "Training", OPEN_DAY: "Open day", CONFERENCE: "Conference",
};
const TYPES = ["", "WORKSHOP", "WEBINAR", "TRAINING", "OPEN_DAY", "CONFERENCE"];

function EventCard({ e }: { e: EventItem }) {
  const img = e.imageUrl || imageForCategory(e.type, 600);
  return (
    <Link to={`/events/${e.slug}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-pop">
      <div className="relative h-36 overflow-hidden">
        <img src={img} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-ink">{EVENT_TYPE_LABEL[e.type] ?? e.type}</span>
        {e.price === 0 && <span className="absolute right-3 top-3 rounded-full bg-brand-600/95 px-2.5 py-0.5 text-xs font-medium text-white">Free</span>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700"><CalendarDays className="h-3.5 w-3.5" /> {dateTime(e.startAt)}</p>
        <h3 className="mt-1.5 font-semibold text-ink group-hover:text-brand-700 line-clamp-2">{e.title}</h3>
        <div className="mt-1.5 space-y-1 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            {e.mode === "ONLINE" ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
            {e.mode === "ONLINE" ? "Online" : (e.location || [e.institution?.city, e.institution?.state].filter(Boolean).join(", ") || "In person")}
          </span>
          {e.institution && <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> {e.institution.name}</span>}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-surface-border pt-3 text-xs">
          {e.spotsLeft != null ? (
            <span className={clsx("inline-flex items-center gap-1", e.spotsLeft === 0 ? "text-danger" : "text-ink-muted")}>
              <Users className="h-3.5 w-3.5" /> {e.spotsLeft === 0 ? "Full" : `${e.spotsLeft} spots left`}
            </span>
          ) : <span className="inline-flex items-center gap-1 text-ink-muted"><Users className="h-3.5 w-3.5" /> Open</span>}
          <span className="inline-flex items-center gap-1 font-semibold text-brand-700">Details <ArrowRight className="h-3 w-3" /></span>
        </div>
      </div>
    </Link>
  );
}

export default function Events() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["events", type], queryFn: () => fetchEvents({ type: type || undefined }) });

  useSeo({
    title: "Research Events, Workshops & Training | ITRO",
    description: "Discover workshops, webinars, training and open days hosted by testing and research laboratories on the ITRO network.",
    canonicalPath: "/events",
  });

  const events = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data ?? []).filter((e) => !t || `${e.title} ${e.institution?.name ?? ""}`.toLowerCase().includes(t));
  }, [data, q]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-6 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Events &amp; workshops</h1>
        <p className="mt-2 text-ink-muted">Hands-on workshops, webinars, training and open days hosted by labs on the network.</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events…" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button key={t || "all"} onClick={() => setType(t)}
              className={clsx("rounded-full border px-3 py-1.5 text-xs font-medium transition",
                type === t ? "border-brand-300 bg-brand-50 text-brand-700" : "border-surface-border bg-white text-ink-soft hover:border-brand-300")}>
              {t ? EVENT_TYPE_LABEL[t] : "All"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? <LoadingBlock /> : isError ? <ErrorState error={error} /> : events.length === 0 ? (
        <Card><EmptyState icon={<CalendarDays className="h-6 w-6" />} title="No upcoming events" description="Check back soon — labs post workshops and webinars here." /></Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => <EventCard key={e.id} e={e} />)}
        </div>
      )}
    </div>
  );
}
