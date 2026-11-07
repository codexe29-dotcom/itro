import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, TrendingDown } from "lucide-react";
import clsx from "clsx";
import { fetchBrowseBundles } from "@/lib/bundles";
import { BundleCard } from "@/components/BundleCard";
import { Input, Select, Button, LoadingBlock } from "@/components/ui";

const DISCOUNTS = [
  { label: "Any discount", value: "" },
  { label: "5%+ off", value: "5" },
  { label: "10%+ off", value: "10" },
  { label: "15%+ off", value: "15" },
  { label: "20%+ off", value: "20" },
];

export default function BundleBrowser() {
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minDiscount, setMinDiscount] = useState("");

  const { data: bundles, isLoading } = useQuery({ queryKey: ["browse-bundles"], queryFn: () => fetchBrowseBundles() });

  // Popular industries — derived from the bundles that actually exist.
  const industries = useMemo(() => {
    const map = new Map<string, { slug: string; title: string; count: number }>();
    for (const b of bundles ?? []) {
      if (!b.industry) continue;
      const cur = map.get(b.industry.slug) ?? { slug: b.industry.slug, title: b.industry.title, count: 0 };
      cur.count += 1; map.set(b.industry.slug, cur);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [bundles]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (bundles ?? []).filter((b) => {
      if (industry && b.industry?.slug !== industry) return false;
      if (maxPrice && b.quote.bundlePrice > Number(maxPrice)) return false;
      if (minDiscount && b.discountPct < Number(minDiscount)) return false;
      if (!needle) return true;
      return (
        b.name.toLowerCase().includes(needle) ||
        (b.institution?.name ?? "").toLowerCase().includes(needle) ||
        b.quote.items.some((it) => it.name.toLowerCase().includes(needle))
      );
    });
  }, [bundles, q, industry, maxPrice, minDiscount]);

  function reset() { setQ(""); setIndustry(""); setMaxPrice(""); setMinDiscount(""); }
  const activeCount = [industry, maxPrice, minDiscount].filter(Boolean).length;

  return (
    <div className="space-y-5">
      {/* Search + popular industries */}
      <div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bundles — by name, lab or included test…" className="py-3.5 pl-12 text-base" />
        </div>
        {industries.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Popular</span>
            {industries.slice(0, 8).map((i) => (
              <button key={i.slug} onClick={() => setIndustry(industry === i.slug ? "" : i.slug)}
                className={clsx("rounded-full border px-3 py-1 text-xs font-medium transition",
                  industry === i.slug ? "border-brand-300 bg-brand-50 text-brand-700" : "border-surface-border bg-white text-ink-soft hover:border-brand-300 hover:text-brand-700")}>
                {i.title}
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
                <label className="label">Industry / domain</label>
                <Select value={industry} onChange={(e) => setIndustry(e.target.value)}>
                  <option value="">All industries</option>
                  {industries.map((i) => <option key={i.slug} value={i.slug}>{i.title} ({i.count})</option>)}
                </Select>
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5 text-brand-500" /> Minimum discount</label>
                <Select value={minDiscount} onChange={(e) => setMinDiscount(e.target.value)}>
                  {DISCOUNTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </Select>
              </div>
              <div>
                <label className="label">Max bundle price (₹)</label>
                <Input type="number" min={0} placeholder="Any" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
              </div>
              {activeCount > 0 && <Button variant="ghost" className="w-full" onClick={reset}>Clear all filters</Button>}
            </div>
          </div>
        </aside>

        {/* Results */}
        <div>
          <p className="mb-4 text-sm text-ink-muted">
            {bundles ? <><span className="font-semibold text-ink">{filtered.length}</span> bundle{filtered.length === 1 ? "" : "s"}</> : " "}
          </p>
          {isLoading ? (
            <LoadingBlock />
          ) : filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-surface-border px-4 py-16 text-center text-sm text-ink-muted">
              {(bundles ?? []).length === 0 ? "No bundles are live on the catalog yet. Check back soon." : "No bundles match your filters."}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((b) => <BundleCard key={b.id} b={b} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
