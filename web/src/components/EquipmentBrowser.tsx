import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Cpu, Search, MapPin, Building2, ArrowRight, GraduationCap, SlidersHorizontal, Zap, Navigation } from "lucide-react";
import clsx from "clsx";
import { fetchBrowseInstruments, type BrowseInstrument } from "@/lib/queries";
import { money } from "@/lib/format";
import { haversineKm, formatDistance } from "@/lib/locations";
import { Input, Select, Button, LoadingBlock, StatusBadge, useToast } from "@/components/ui";

const STATUSES = [
  { label: "Any status", value: "" },
  { label: "Available", value: "AVAILABLE" },
  { label: "Booked", value: "BOOKED" },
  { label: "Under maintenance", value: "MAINTENANCE" },
];

function EquipmentCard({ m, distanceKm }: { m: BrowseInstrument; distanceKm?: number | null }) {
  const img = m.images?.[0] ?? m.imageUrl;
  return (
    <Link to={`/instruments/${m.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-surface-border bg-white transition hover:border-brand-300 hover:shadow-pop">
      <div className="aspect-[16/10] overflow-hidden bg-surface-muted">
        {img ? (
          <img src={img} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-brand-200"><Cpu className="h-12 w-12" /></div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{m.category}</span>
          <StatusBadge status={m.status} label={m.status} />
        </div>
        <p className="mt-2 font-semibold text-ink group-hover:text-brand-700">{m.name}</p>
        <p className="text-xs text-ink-muted">{[m.make, m.model].filter(Boolean).join(" · ")}</p>
        <div className="mt-1.5 space-y-0.5 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5"><Building2 className="h-3 w-3" /> {m.institution.name}</span>
          {(m.institution.city || m.institution.state) && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> {[m.institution.city, m.institution.state].filter(Boolean).join(", ")}
              {distanceKm != null && <span className="font-medium text-brand-700">· {formatDistance(distanceKm)} away</span>}
            </span>
          )}
          {m.trainingRequired && <span className="flex items-center gap-1.5"><GraduationCap className="h-3 w-3" /> Training required</span>}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-surface-border pt-3">
          <span className="text-sm font-bold text-ink">
            {m.hourlyRate > 0 ? <>{money(m.hourlyRate, m.institution.currency)}<span className="text-xs font-normal text-ink-muted">/hr</span></> : <span className="text-xs font-normal text-ink-muted">Rate on request</span>}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 group-hover:underline">View &amp; schedule <ArrowRight className="h-3 w-3" /></span>
        </div>
      </div>
    </Link>
  );
}

export default function EquipmentBrowser() {
  const [params, setParams] = useSearchParams();
  const category = params.get("category") ?? "";
  const [q, setQ] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState("");
  const [maxRate, setMaxRate] = useState("");
  const [noTraining, setNoTraining] = useState(false);
  const [city, setCity] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const toast = useToast();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["browse-instruments", q, category],
    queryFn: () => fetchBrowseInstruments({ q: q || undefined, category: category || undefined }),
    placeholderData: keepPreviousData,
  });

  function setCategory(c: string) {
    const next = new URLSearchParams(params);
    if (c) next.set("category", c); else next.delete("category");
    setParams(next, { replace: true });
  }
  function reset() { setQ(""); setCategory(""); setStatus(""); setMaxRate(""); setNoTraining(false); setCity(""); setCoords(null); }
  const activeCount = [category, status, maxRate, noTraining ? "1" : "", city, coords ? "1" : ""].filter(Boolean).length;

  function useMyLocation() {
    if (!navigator.geolocation) { toast.push("error", "Location isn't available in this browser."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); },
      () => { toast.push("error", "Could not get your location. Allow location access and try again."); setLocating(false); },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  const items = useMemo(() => {
    const rows = (data?.data ?? [])
      .filter((m) => {
        if (status && m.status !== status) return false;
        if (maxRate && !(m.hourlyRate > 0 && m.hourlyRate <= Number(maxRate))) return false;
        if (noTraining && m.trainingRequired) return false;
        if (city && m.institution.city !== city) return false;
        return true;
      })
      .map((m) => ({ m, distanceKm: coords ? haversineKm(coords.lat, coords.lng, m.institution.latitude, m.institution.longitude) : null }));
    if (coords) {
      rows.sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) return 0;
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    }
    return rows;
  }, [data, status, maxRate, noTraining, city, coords]);

  return (
    <div className="space-y-5">
      {/* Search + popular categories */}
      <div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search equipment — e.g. SEM, UTM, XRD, CNC…" className="py-3.5 pl-12 text-base" />
        </div>
        {data && data.categories.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Popular</span>
            {data.categories.slice(0, 8).map((c) => (
              <button key={c} onClick={() => setCategory(category === c ? "" : c)}
                className={clsx("rounded-full border px-3 py-1 text-xs font-medium transition",
                  category === c ? "border-brand-300 bg-brand-50 text-brand-700" : "border-surface-border bg-white text-ink-soft hover:border-brand-300 hover:text-brand-700")}>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[270px_1fr]">
        {/* Filters */}
        <aside className="space-y-4">
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink"><SlidersHorizontal className="h-4 w-4" /> Filters</div>
              {activeCount > 0 && <span className="badge-brand">{activeCount}</span>}
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Location</label>
                <Select value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="">All cities</option>
                  {(data?.cities ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
                <button onClick={useMyLocation} disabled={locating}
                  className={clsx("mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition",
                    coords ? "border-brand-300 bg-brand-50 text-brand-700" : "border-surface-border text-ink-soft hover:border-brand-300 hover:text-brand-700")}>
                  <Navigation className={clsx("h-4 w-4", locating && "animate-pulse")} />
                  {locating ? "Locating…" : coords ? "Sorted by distance" : "Near me"}
                </button>
                {coords && <button onClick={() => setCoords(null)} className="mt-1 block w-full text-center text-xs text-ink-faint hover:text-ink">Clear location sort</button>}
              </div>
              <div>
                <label className="label">Equipment type</label>
                <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">All types</option>
                  {(data?.categories ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <label className="label">Availability</label>
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </div>
              <div>
                <label className="label">Max hourly rate (₹)</label>
                <Input type="number" min={0} placeholder="Any" value={maxRate} onChange={(e) => setMaxRate(e.target.value)} />
              </div>
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-surface-border px-3 py-2.5">
                <span className="flex items-center gap-2 text-sm font-medium text-ink-soft"><Zap className="h-4 w-4 text-brand-600" /> No training required</span>
                <input type="checkbox" checked={noTraining} onChange={(e) => setNoTraining(e.target.checked)} className="h-4 w-4 accent-brand-600" />
              </label>
              {activeCount > 0 && <Button variant="ghost" className="w-full" onClick={reset}>Clear all filters</Button>}
            </div>
          </div>
        </aside>

        {/* Results */}
        <div>
          <p className="mb-4 text-sm text-ink-muted">
            {data ? <><span className="font-semibold text-ink">{items.length}</span> machine{items.length === 1 ? "" : "s"} available for rent</> : " "}
          </p>
          {isLoading ? (
            <LoadingBlock />
          ) : items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-surface-border px-4 py-16 text-center text-sm text-ink-muted">No equipment matches your filters. Try clearing them.</p>
          ) : (
            <div className={clsx("grid gap-5 sm:grid-cols-2 xl:grid-cols-3", isFetching && "opacity-60")}>
              {items.map(({ m, distanceKm }) => <EquipmentCard key={m.id} m={m} distanceKm={distanceKm} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
