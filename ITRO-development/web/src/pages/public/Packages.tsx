import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Package, Layers, ShieldCheck, TrendingDown, ArrowRight } from "lucide-react";
import { fetchPackages, type PackageListItem } from "@/lib/catalog";
import { useSeo } from "@/lib/useSeo";
import { LoadingBlock, ErrorState, EmptyState } from "@/components/ui";

export default function Packages() {
  const q = useQuery({ queryKey: ["packages-index"], queryFn: fetchPackages });

  useSeo({
    title: "Certification Packages | ITRO",
    description: "Browse bundled testing & certification packages - related tests grouped, routed to accredited providers and priced live (Cheapest / Fastest).",
    canonicalPath: "/packages",
  });

  const byIndustry = useMemo(() => {
    const map = new Map<string, { title: string; slug: string | null; items: PackageListItem[] }>();
    for (const p of q.data ?? []) {
      const key = p.industry?.slug ?? "other";
      if (!map.has(key)) map.set(key, { title: p.industry?.title ?? "Other", slug: p.industry?.slug ?? null, items: [] });
      map.get(key)!.items.push(p);
    }
    return [...map.values()];
  }, [q.data]);

  return (
    <div>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-brand-950 text-white">
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800" />
        <div aria-hidden className="pointer-events-none absolute -top-40 right-[-8%] h-[40rem] w-[40rem] rounded-full bg-brand-500/25 blur-[130px]" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
            <Package className="h-3.5 w-3.5" /> Certification packages
          </span>
          <h1 className="mt-5 max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
            Bundled <span className="bg-gradient-to-r from-white via-brand-100 to-accent-cyan bg-clip-text text-transparent">test programs</span>, one price
          </h1>
          <p className="mt-4 max-w-xl text-lg text-brand-100/90">Related tests grouped into a package, routed to accredited providers and priced live. Pick Cheapest or Fastest and add the whole bundle to your cart.</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        {q.isLoading ? <LoadingBlock /> : q.isError ? <ErrorState error={q.error} /> : (q.data?.length ?? 0) === 0 ? (
          <EmptyState title="No packages yet" description="Certification packages will appear here once configured." />
        ) : (
          <div className="space-y-12">
            {byIndustry.map((grp) => (
              <div key={grp.title}>
                <div className="mb-5 flex items-end justify-between">
                  <h2 className="text-xl font-bold tracking-tight text-ink">{grp.title}</h2>
                  {grp.slug && <Link to={`/industries/${grp.slug}`} className="text-sm font-semibold text-brand-700 hover:underline">View industry →</Link>}
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {grp.items.map((p) => (
                    <Link key={p.slug} to={`/packages/${p.slug}`} className="group card p-6 hover:border-brand-300 hover:shadow-pop transition flex flex-col">
                      <div className="flex items-center justify-between">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100 group-hover:bg-brand-600 group-hover:text-white transition">
                          <Package className="h-5 w-5" strokeWidth={1.5} />
                        </span>
                        {p.pricingMode !== "FIXED" && p.discountPct > 0 && <span className="badge-brand">Save {p.discountPct}%</span>}
                      </div>
                      <h3 className="mt-4 font-semibold text-ink group-hover:text-brand-700">{p.name}</h3>
                      <p className="mt-1 flex-1 text-sm text-ink-muted">{p.summary}</p>
                      <div className="mt-3 flex items-center gap-3 text-xs text-ink-faint">
                        <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> {p.itemCount} tests</span>
                        <span className="inline-flex items-center gap-1">{p.pricingMode === "FIXED" ? <><ShieldCheck className="h-3.5 w-3.5" /> Fixed price</> : <><TrendingDown className="h-3.5 w-3.5" /> Dynamic pricing</>}</span>
                      </div>
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 opacity-0 transition group-hover:opacity-100">
                        View &amp; add to cart <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
