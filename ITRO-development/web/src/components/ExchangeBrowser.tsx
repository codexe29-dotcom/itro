import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Search, SlidersHorizontal, Star, ShieldCheck, Clock, Zap, X } from "lucide-react";
import {
  fetchExchangeServices, fetchExchangeFacets, ExchangeFilters,
} from "@/lib/queries";
import ServiceCard from "@/components/ServiceCard";
import { Input, Select, LoadingBlock, EmptyState, ErrorState, Button } from "@/components/ui";

const TURNAROUND_PRESETS = [
  { label: "Any turnaround", value: "" },
  { label: "≤ 3 days", value: "3" },
  { label: "≤ 7 days", value: "7" },
  { label: "≤ 14 days", value: "14" },
  { label: "≤ 30 days", value: "30" },
];
const RATING_PRESETS = [
  { label: "Any rating", value: "" },
  { label: "3.0+ ★", value: "3" },
  { label: "4.0+ ★", value: "4" },
  { label: "4.5+ ★", value: "4.5" },
];
const SORTS = [
  { label: "Recommended", value: "recommended" },
  { label: "Price: low to high", value: "price_asc" },
  { label: "Price: high to low", value: "price_desc" },
  { label: "Fastest turnaround", value: "turnaround_asc" },
  { label: "Top rated", value: "rating_desc" },
];

export default function ExchangeBrowser({ linkTo }: { linkTo?: (serviceId: string) => string }) {
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [accreditation, setAccreditation] = useState(searchParams.get("accreditation") ?? "");
  const [maxPrice, setMaxPrice] = useState("");
  const [maxTurnaround, setMaxTurnaround] = useState("");
  const [minRating, setMinRating] = useState("");
  const [availableNow, setAvailableNow] = useState(false);
  const [sort, setSort] = useState("recommended");

  const facetsQ = useQuery({ queryKey: ["exchange-facets"], queryFn: fetchExchangeFacets });

  const filters: ExchangeFilters = {
    q: q || undefined,
    category: category || undefined,
    accreditation: accreditation || undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    maxTurnaround: maxTurnaround ? Number(maxTurnaround) : undefined,
    minRating: minRating ? Number(minRating) : undefined,
    availableNow: availableNow || undefined,
    sort,
    pageSize: 48,
  };

  const servicesQ = useQuery({
    queryKey: ["exchange-services", filters],
    queryFn: () => fetchExchangeServices(filters),
  });
  const services = servicesQ.data?.data ?? [];

  const reset = () => {
    setQ(""); setCategory(""); setAccreditation(""); setMaxPrice("");
    setMaxTurnaround(""); setMinRating(""); setAvailableNow(false); setSort("recommended");
  };
  const activeCount = [q, category, accreditation, maxPrice, maxTurnaround, minRating, availableNow ? "1" : ""].filter(Boolean).length;

  const chips = [
    category && { label: category, clear: () => setCategory("") },
    accreditation && { label: accreditation, clear: () => setAccreditation("") },
    maxTurnaround && { label: `≤ ${maxTurnaround} days`, clear: () => setMaxTurnaround("") },
    minRating && { label: `${minRating}+ ★`, clear: () => setMinRating("") },
    maxPrice && { label: `≤ ₹${maxPrice}`, clear: () => setMaxPrice("") },
    availableNow && { label: "Available now", clear: () => setAvailableNow(false) },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const topCats = (facetsQ.data?.categories ?? []).slice(0, 6);
  const topStds = (facetsQ.data?.accreditations ?? []).slice(0, 4);

  return (
    <div className="space-y-5">
      {/* Prominent search + popular quick-filters */}
      <div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint" />
          <Input placeholder="Search tests & services — e.g. tensile, salt spray, EMI/EMC, ISO 17025…"
            value={q} onChange={(e) => setQ(e.target.value)} className="py-3.5 pl-12 text-base" />
        </div>
        {(topCats.length > 0 || topStds.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Popular</span>
            {topCats.map((c) => (
              <button key={c.category} onClick={() => setCategory(category === c.category ? "" : c.category)}
                className={clsx("rounded-full border px-3 py-1 text-xs font-medium transition",
                  category === c.category ? "border-brand-300 bg-brand-50 text-brand-700" : "border-surface-border bg-white text-ink-soft hover:border-brand-300 hover:text-brand-700")}>
                {c.category}
              </button>
            ))}
            {topStds.map((a) => (
              <button key={a.accreditation} onClick={() => setAccreditation(accreditation === a.accreditation ? "" : a.accreditation)}
                className={clsx("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition",
                  accreditation === a.accreditation ? "border-brand-300 bg-brand-50 text-brand-700" : "border-surface-border bg-white text-ink-soft hover:border-brand-300 hover:text-brand-700")}>
                <ShieldCheck className="h-3 w-3" /> {a.accreditation}
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
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </div>
            {activeCount > 0 && <span className="badge-brand">{activeCount}</span>}
          </div>
          <div className="space-y-4">
            <div>
              <label className="label">Capability / service type</label>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All capabilities</option>
                {facetsQ.data?.categories.map((c) => (
                  <option key={c.category} value={c.category}>{c.category} ({c.count})</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="label flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-success" /> Standard / accreditation</label>
              <Select value={accreditation} onChange={(e) => setAccreditation(e.target.value)}>
                <option value="">Any standard</option>
                {facetsQ.data?.accreditations.map((a) => (
                  <option key={a.accreditation} value={a.accreditation}>{a.accreditation} ({a.count})</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="label flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Turnaround</label>
              <Select value={maxTurnaround} onChange={(e) => setMaxTurnaround(e.target.value)}>
                {TURNAROUND_PRESETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </div>

            <div>
              <label className="label flex items-center gap-1.5"><Star className="h-3.5 w-3.5 text-brand-500" /> Minimum rating</label>
              <Select value={minRating} onChange={(e) => setMinRating(e.target.value)}>
                {RATING_PRESETS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
            </div>

            <div>
              <label className="label">Max price (₹)</label>
              <Input type="number" min={0} placeholder="Any" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-surface-border px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm font-medium text-ink-soft"><Zap className="h-4 w-4 text-brand-600" /> Available now</span>
              <input type="checkbox" checked={availableNow} onChange={(e) => setAvailableNow(e.target.checked)}
                className="h-4 w-4 accent-brand-600" />
            </label>

            {activeCount > 0 && (
              <Button variant="ghost" className="w-full" onClick={reset}>Clear all filters</Button>
            )}
          </div>
        </div>
      </aside>

      {/* Results */}
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-muted">
            {servicesQ.data ? <><span className="font-semibold text-ink">{servicesQ.data.total}</span> service{servicesQ.data.total === 1 ? "" : "s"}</> : " "}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-muted">Sort</span>
            <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-52">
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {chips.map((c) => (
              <button key={c.label} onClick={c.clear} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100">
                {c.label} <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}

        {servicesQ.isLoading ? (
          <LoadingBlock />
        ) : servicesQ.isError ? (
          <ErrorState error={servicesQ.error} />
        ) : services.length === 0 ? (
          <div className="card">
            <EmptyState
              title="No services match your filters"
              description="Try widening your search or clearing filters to see more of the network."
              action={activeCount > 0 ? <Button variant="secondary" onClick={reset}>Clear filters</Button> : undefined}
            />
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {services.map((s) => (
              <ServiceCard key={s.id} service={s} to={linkTo ? linkTo(s.id) : undefined} />
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
