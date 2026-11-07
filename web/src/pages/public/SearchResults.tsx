import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, Package, Building2, UserCog, BadgeCheck, ArrowRight, SearchX } from "lucide-react";
import { searchAll } from "@/lib/queries";
import { RatingStars } from "@/components/RatingStars";
import GlobalSearch from "@/components/GlobalSearch";
import { LoadingBlock } from "@/components/ui";
import { useSeo } from "@/lib/useSeo";

export default function SearchResults() {
  const [params] = useSearchParams();
  const q = (params.get("q") ?? "").trim();

  useSeo({
    title: q ? `Search results for ${q} | ITRO` : "Search ITRO",
    description: "Search testing services, certification packages, accredited labs, experts and standards on ITRO.",
    canonicalPath: "/search",
    robots: "noindex, follow",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["search-page", q],
    queryFn: () => searchAll(q),
    enabled: q.length >= 2,
  });

  const total = data ? data.tests.length + data.packages.length + data.labs.length + data.experts.length + data.standards.length : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        {q ? <>Results for “<span className="text-brand-600">{q}</span>”</> : "Search"}
      </h1>
      <p className="mt-1 text-sm text-ink-muted">Tests, certification packages, accredited labs, experts and standards.</p>

      <div className="mt-5 max-w-xl"><GlobalSearch variant="hero" placeholder="Search tests, packages, labs or standards…" /></div>

      {q.length < 2 ? (
        <p className="mt-10 text-ink-muted">Type at least two characters to search.</p>
      ) : isLoading ? (
        <div className="mt-8"><LoadingBlock /></div>
      ) : total === 0 ? (
        <div className="mt-12 flex flex-col items-center text-center">
          <SearchX className="h-10 w-10 text-ink-faint" />
          <p className="mt-3 font-semibold text-ink">No results for “{q}”</p>
          <p className="mt-1 text-sm text-ink-muted">Try a test name, a standard (ISO 17025, MIL-STD-810), or an industry.</p>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {data!.standards.length > 0 && (
            <section>
              <SectionHead icon={<BadgeCheck className="h-4 w-4" />} label="Standards" count={data!.standards.length} />
              <div className="flex flex-wrap gap-2">
                {data!.standards.map((s) => (
                  <Link key={s} to={`/exchange?q=${encodeURIComponent(s)}`} className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-white px-3 py-1.5 text-sm font-medium text-ink-soft hover:border-brand-300 hover:text-brand-700">
                    <BadgeCheck className="h-3.5 w-3.5 text-brand-600" /> {s}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data!.tests.length > 0 && (
            <section>
              <SectionHead icon={<FlaskConical className="h-4 w-4" />} label="Tests" count={data!.tests.length} seeAllTo="/exchange" />
              <div className="grid gap-3 sm:grid-cols-2">
                {data!.tests.map((t) => (
                  <Link key={t.id} to={`/tests/${t.slug}`} className="group card p-4 transition hover:border-brand-300 hover:shadow-pop">
                    <p className="font-semibold text-ink group-hover:text-brand-700">{t.name}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">{[t.category, ...(t.standardCodes ?? [])].filter(Boolean).slice(0, 3).join(" · ")}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data!.packages.length > 0 && (
            <section>
              <SectionHead icon={<Package className="h-4 w-4" />} label="Certification packages" count={data!.packages.length} seeAllTo="/packages" />
              <div className="grid gap-3 sm:grid-cols-2">
                {data!.packages.map((p) => (
                  <Link key={p.id} to={`/packages/${p.slug}`} className="group card p-4 transition hover:border-brand-300 hover:shadow-pop">
                    <p className="font-semibold text-ink group-hover:text-brand-700">{p.name}</p>
                    {p.summary && <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{p.summary}</p>}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data!.labs.length > 0 && (
            <section>
              <SectionHead icon={<Building2 className="h-4 w-4" />} label="Accredited labs" count={data!.labs.length} seeAllTo="/providers" />
              <div className="grid gap-3 sm:grid-cols-2">
                {data!.labs.map((l) => (
                  <Link key={l.id} to={`/institutions/${l.slug}`} className="group card p-4 transition hover:border-brand-300 hover:shadow-pop">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-ink group-hover:text-brand-700">{l.name}</p>
                      {l.rating.count > 0 && <RatingStars value={l.rating.avg} size={13} showValue count={l.rating.count} />}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted">{[l.city, l.state].filter(Boolean).join(", ") || (l.accreditations ?? []).slice(0, 3).join(" · ")}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data!.experts.length > 0 && (
            <section>
              <SectionHead icon={<UserCog className="h-4 w-4" />} label="Experts" count={data!.experts.length} seeAllTo="/experts" />
              <div className="grid gap-3 sm:grid-cols-2">
                {data!.experts.map((e) => (
                  <Link key={e.id} to={`/experts/${e.id}`} className="group card p-4 transition hover:border-brand-300 hover:shadow-pop">
                    <p className="font-semibold text-ink group-hover:text-brand-700">{e.name}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">{e.title} · {e.provider}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHead({ icon, label, count, seeAllTo }: { icon: React.ReactNode; label: string; count: number; seeAllTo?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
        <span className="text-brand-600">{icon}</span> {label} <span className="text-ink-faint">({count})</span>
      </h2>
      {seeAllTo && <Link to={seeAllTo} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">See all <ArrowRight className="h-3.5 w-3.5" /></Link>}
    </div>
  );
}
