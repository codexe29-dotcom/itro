import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Building2, MapPin, ShieldCheck, ArrowRight, Microscope, Search, ExternalLink, AlertTriangle, BadgeCheck, Navigation, ChevronDown } from "lucide-react";
import { fetchInstitutions } from "@/lib/queries";
import type { AccreditationRecord, Institution } from "@/lib/types";
import { haversineKm, formatDistance } from "@/lib/locations";
import { RatingStars } from "@/components/RatingStars";
import { Card, Input, Select, LoadingBlock, ErrorState, EmptyState, useToast } from "@/components/ui";

const TYPE_LABEL: Record<string, string> = {
  UNIVERSITY: "University", ENGINEERING_COLLEGE: "Engineering College",
  MEDICAL_COLLEGE: "Medical College", NATIONAL_LAB: "National Laboratory",
  PRIVATE_RND: "Private R&D", INCUBATOR: "Incubator", INDUSTRY: "Industry",
};

function accredStyle(status: AccreditationRecord["status"]) {
  switch (status) {
    case "EXPIRED": return "bg-surface-muted text-ink-soft";
    case "EXPIRING": return "bg-orange-50 text-orange-700";
    default: return "bg-brand-50 text-brand-700";
  }
}

export default function Providers() {
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["providers"], queryFn: fetchInstitutions });

  const [q, setQ] = useState("");
  const [body, setBody] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [city, setCity] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const toast = useToast();

  const bodies = useMemo(() => {
    const s = new Set<string>();
    for (const i of data ?? []) {
      for (const r of i.accreditationRecords ?? []) s.add(r.body);
      for (const a of i.accreditations ?? []) s.add(a);
    }
    return [...s].sort();
  }, [data]);

  const cities = useMemo(
    () => [...new Set((data ?? []).map((i) => i.city).filter((c): c is string => !!c))].sort(),
    [data],
  );

  function useMyLocation() {
    if (!navigator.geolocation) { toast.push("error", "Location isn't available in this browser."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); },
      () => { toast.push("error", "Could not get your location. Allow location access and try again."); setLocating(false); },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  const labs = useMemo(() => {
    const t = q.trim().toLowerCase();
    const rows = (data ?? []).filter((i) => {
      if (t && !`${i.name} ${i.city ?? ""} ${i.state ?? ""}`.toLowerCase().includes(t)) return false;
      const recBodies = (i.accreditationRecords ?? []).map((r) => r.body);
      const allBodies = [...recBodies, ...(i.accreditations ?? [])];
      if (body && !allBodies.includes(body)) return false;
      if (verifiedOnly && (i.accreditationRecords ?? []).length === 0) return false;
      if (city && i.city !== city) return false;
      return true;
    }).map((i) => ({ i, distanceKm: coords ? haversineKm(coords.lat, coords.lng, i.latitude, i.longitude) : null }));
    if (coords) {
      rows.sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) return 0;
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    }
    return rows;
  }, [data, q, body, verifiedOnly, city, coords]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-6 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Accredited labs</h1>
        <p className="mt-2 text-ink-muted">
          Browse accredited testing &amp; research labs on the network. Every lab shows its accreditation
          scope, status and a link to verify with the issuing body.
        </p>
      </div>

      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search labs by name or location…" className="pl-9" />
        </div>
        <Select value={city} onChange={(e) => setCity(e.target.value)} className="w-40">
          <option value="">All cities</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={body} onChange={(e) => setBody(e.target.value)} className="w-48">
          <option value="">Any accreditation</option>
          {bodies.map((b) => <option key={b} value={b}>{b}</option>)}
        </Select>
        <button onClick={coords ? () => setCoords(null) : useMyLocation} disabled={locating}
          className={clsx("inline-flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition",
            coords ? "border-brand-300 bg-brand-50 text-brand-700" : "border-surface-border text-ink-soft hover:border-brand-300 hover:text-brand-700")}>
          <Navigation className={clsx("h-4 w-4", locating && "animate-pulse")} />
          {locating ? "Locating…" : coords ? "Nearest first ✕" : "Near me"}
        </button>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-surface-border px-3 py-2.5 text-sm font-medium text-ink-soft">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
          <BadgeCheck className="h-4 w-4 text-brand-600" /> Verified only
        </label>
      </div>

      {isLoading ? (
        <LoadingBlock />
      ) : isError ? (
        <ErrorState error={error} />
      ) : labs.length === 0 ? (
        <Card><EmptyState title="No labs match" description="Try clearing the filters." /></Card>
      ) : (
        <>
          <p className="mb-4 text-sm text-ink-muted"><span className="font-semibold text-ink">{labs.length}</span> lab{labs.length === 1 ? "" : "s"}</p>
          <div className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {labs.map(({ i: inst, distanceKm }) => <LabCard key={inst.id} inst={inst} distanceKm={distanceKm} />)}
          </div>
        </>
      )}
    </div>
  );
}

function LabCard({ inst, distanceKm }: { inst: Institution; distanceKm: number | null }) {
  const [expanded, setExpanded] = useState(false);
  const recs = inst.accreditationRecords ?? [];
  const facs = inst.facilities ?? [];
  const COLLAPSED = 2;
  const shown = expanded ? facs : facs.slice(0, COLLAPSED);
  const hidden = facs.length - COLLAPSED;

  const chip = (f: { id: string; name: string }) => (
    <Link key={f.id} to={`/facilities/${f.id}`}
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-surface-border bg-white px-2 py-0.5 text-[11px] font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-700">
      <Building2 className="h-3 w-3 shrink-0 text-ink-faint" /> <span className="truncate">{f.name}</span>
    </Link>
  );

  return (
    <div className="card flex flex-col p-6 transition hover:border-brand-300 hover:shadow-pop">
      <Link to={`/institutions/${inst.slug}`} className="group block">
        <div className="flex items-start justify-between">
          <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
            {inst.logoUrl ? <img src={inst.logoUrl} alt={inst.name} className="h-full w-full object-contain" /> : <Building2 className="h-6 w-6" strokeWidth={1.5} />}
          </span>
          <span className="badge-gray">{TYPE_LABEL[inst.type] ?? inst.type}</span>
        </div>
        <h3 className="mt-4 font-semibold text-ink group-hover:text-brand-700">{inst.name}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
          {(inst.city || inst.state) && (
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {[inst.city, inst.state].filter(Boolean).join(", ")}</span>
          )}
          {distanceKm != null && <span className="inline-flex items-center gap-1 font-medium text-brand-700"><Navigation className="h-3 w-3" /> {formatDistance(distanceKm)} away</span>}
          {inst.rating && inst.rating.count > 0 && <RatingStars value={inst.rating.avg} size={13} showValue count={inst.rating.count} />}
        </div>

        {recs.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {recs.slice(0, 4).map((r) => (
              <span key={r.id} className={clsx("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium", accredStyle(r.status))}>
                {r.status === "EXPIRED" || r.status === "EXPIRING" ? <AlertTriangle className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                {r.body}{r.verifyUrl && <ExternalLink className="h-2.5 w-2.5 opacity-70" />}
              </span>
            ))}
          </div>
        ) : inst.accreditations?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {inst.accreditations.map((a) => (
              <span key={a} className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                <ShieldCheck className="h-3 w-3 text-brand-600" /> {a}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-surface-border pt-3 text-sm">
          <span className="inline-flex items-center gap-1.5 text-ink-muted">
            <Microscope className="h-4 w-4" strokeWidth={1.5} />
            {inst._count?.services != null ? `${inst._count.services} services` : "View facilities"}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-brand-700">View <ArrowRight className="h-3.5 w-3.5" /></span>
        </div>
      </Link>

      {/* Facilities-as-labs — collapsed to keep the grid uniform; expands inline. */}
      {facs.length > 0 && (
        <div className="mt-3 border-t border-surface-border pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              {facs.length} lab{facs.length === 1 ? "" : "s"} here
            </span>
            {facs.length > COLLAPSED && (
              <button onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-brand-700 hover:underline">
                {expanded ? "Show less" : `Show all ${facs.length}`}
                <ChevronDown className={clsx("h-3 w-3 transition", expanded && "rotate-180")} />
              </button>
            )}
          </div>
          <div className={clsx("mt-2 flex flex-wrap gap-1.5", expanded && "max-h-40 overflow-y-auto pr-1")}>
            {shown.map(chip)}
            {!expanded && hidden > 0 && (
              <button onClick={() => setExpanded(true)}
                className="inline-flex items-center rounded-full border border-dashed border-surface-border px-2 py-0.5 text-[11px] font-medium text-ink-muted hover:border-brand-300 hover:text-brand-700">
                +{hidden} more
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
