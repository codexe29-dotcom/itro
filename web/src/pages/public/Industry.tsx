import { useMemo } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, ShieldCheck, HelpCircle, Search, FlaskConical, Package, Clock, Layers, Boxes,
} from "lucide-react";
import { fetchIndustryDetail } from "@/lib/catalog";
import { fetchBrowseBundles } from "@/lib/bundles";
import { BundleCard } from "@/components/BundleCard";
import { iconFor } from "@/lib/industryIcons";
import { SEO_SITE_URL, useSeo } from "@/lib/useSeo";
import { LoadingBlock, ErrorState } from "@/components/ui";
import HeroArt from "@/components/HeroArt";

function IndustryBundles({ slug }: { slug: string }) {
  const { data: bundles } = useQuery({ queryKey: ["industry-bundles", slug], queryFn: () => fetchBrowseBundles(slug) });
  if (!bundles || bundles.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">Lab bundles</span>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Bundled offers from labs</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bundles.slice(0, 6).map((b) => <BundleCard key={b.id} b={b} />)}
      </div>
    </section>
  );
}

export default function Industry() {
  const { slug = "" } = useParams();
  const q = useQuery({ queryKey: ["industry", slug], queryFn: () => fetchIndustryDetail(slug), retry: false });
  const ind = q.data;

  const jsonLd = useMemo(() => {
    if (!ind) return [];
    const blocks: object[] = [{
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SEO_SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Industries", item: `${SEO_SITE_URL}/exchange` },
        { "@type": "ListItem", position: 3, name: ind.title },
      ],
    }];
    if (ind.faq?.length) {
      blocks.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: (ind.faq ?? []).map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      });
    }
    return blocks;
  }, [ind]);

  useSeo({
    title: ind ? `${ind.seoTitle ?? ind.title} | ITRO` : "Industry | ITRO",
    description: ind?.seoDescription ?? undefined,
    canonicalPath: `/industries/${slug}`,
    jsonLd,
  });

  if (q.isLoading) return <div className="mx-auto max-w-7xl px-4 py-16"><LoadingBlock /></div>;
  if (q.isError) {
    const status = (q.error as { response?: { status?: number } })?.response?.status;
    if (status === 404) return <Navigate to="/exchange" replace />;
    return <div className="mx-auto max-w-7xl px-4 py-16"><ErrorState error={q.error} /></div>;
  }
  if (!ind) return <Navigate to="/exchange" replace />;

  const Icon = iconFor(ind.icon);
  const firstCat = ind.relatedCategories[0];

  return (
    <div>
      {/* Hero - immersive, full-bleed */}
      <section className="relative isolate overflow-hidden bg-brand-950 text-white">
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800" />
        <div aria-hidden className="pointer-events-none absolute -top-40 right-[-8%] h-[42rem] w-[42rem] rounded-full bg-brand-500/25 blur-[130px]" />
        <div aria-hidden className="pointer-events-none absolute top-1/3 left-[-15%] h-[32rem] w-[32rem] rounded-full bg-accent-cyan/15 blur-[130px]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{ backgroundImage: "radial-gradient(rgba(131,133,255,0.5) 1px, transparent 0)", backgroundSize: "26px 26px", maskImage: "radial-gradient(ellipse at 78% 35%, black 20%, transparent 68%)", WebkitMaskImage: "radial-gradient(ellipse at 78% 35%, black 20%, transparent 68%)" }} />
        <div aria-hidden className="pointer-events-none absolute right-[-8%] top-1/2 hidden w-[58%] -translate-y-1/2 lg:block"
          style={{ maskImage: "radial-gradient(ellipse at center, black 56%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse at center, black 56%, transparent 100%)" }}>
          <HeroArt slug={ind.slug} tone="dark" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
          <nav className="mb-6 flex items-center gap-1.5 text-xs text-white/50">
            <Link to="/" className="hover:text-white">Home</Link><span>/</span><span>Industries</span><span>/</span>
            <span className="font-medium text-white/90">{ind.title}</span>
          </nav>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
            <Icon className="h-3.5 w-3.5" /> Engineering Testing &amp; Certification
          </span>
          <h1 className="mt-5 max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
            {ind.title}{" "}
            <span className="bg-gradient-to-r from-white via-brand-100 to-accent-cyan bg-clip-text text-transparent">Testing &amp; Certification</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-brand-100/90">{ind.heroTagline}</p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/60">{ind.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#tests" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand-800 shadow-lg transition hover:bg-brand-50">Browse {ind.tests.length} tests <ArrowRight className="h-4 w-4" /></a>
            {ind.packages.length > 0 && <a href="#packages" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">View packages</a>}
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/70">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-accent-cyan" /> {ind.standards.length} standards</span>
            <span className="inline-flex items-center gap-1.5"><FlaskConical className="h-3.5 w-3.5 text-accent-cyan" /> {ind.tests.length} tests</span>
            {ind.packages.length > 0 && <span className="inline-flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-accent-cyan" /> {ind.packages.length} packages</span>}
          </div>
        </div>
      </section>

      {/* Packages */}
      {ind.packages.length > 0 && (
        <section id="packages" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">Certification Packages</span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Bundled {ind.title.toLowerCase()} programs</h2>
            <p className="mt-2 text-ink-muted">Pre-composed test bundles - pick fastest or cheapest routing and get one price across providers.</p>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ind.packages.map((p) => (
              <Link key={p.slug} to={`/packages/${p.slug}`} className="group card p-6 hover:border-brand-300 hover:shadow-pop transition">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100 group-hover:bg-brand-600 group-hover:text-white transition">
                    <Package className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                  {p.discountPct > 0 && <span className="badge-brand">Save {p.discountPct}%</span>}
                </div>
                <h3 className="mt-4 font-semibold text-ink group-hover:text-brand-700">{p.name}</h3>
                <p className="mt-1 text-sm text-ink-muted">{p.summary}</p>
                <div className="mt-3 flex items-center gap-3 text-xs text-ink-faint">
                  <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> {p.itemCount} tests</span>
                  {p.accreditation && <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> {p.accreditation}</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Lab bundles for this industry */}
      <IndustryBundles slug={ind.slug} />

      {/* Standards */}
      <section className="border-y border-surface-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">Standards &amp; Certifications</span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Standards {ind.title.toLowerCase()} testing is measured against</h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ind.standards.map((s) => (
              <div key={s.code} className="card p-5">
                <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand-600" /><h3 className="font-semibold text-ink">{s.code}</h3></div>
                <p className="mt-1.5 text-sm text-ink-muted">{s.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tests */}
      <section id="tests" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">Tests &amp; Research Services</span>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Configurable {ind.title.toLowerCase()} tests</h2>
          <p className="mt-2 text-ink-muted">Click any test for procedures, forms, associated tests and providers - with live pricing and turnaround.</p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ind.tests.map((t) => (
            <Link key={t.slug} to={`/tests/${t.slug}`} className="group card p-5 hover:border-brand-300 hover:shadow-pop transition flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[15px] font-semibold text-ink group-hover:text-brand-700">{t.name}</h3>
                <span className="badge-gray shrink-0">{t.category}</span>
              </div>
              <p className="mt-1 text-sm text-ink-muted line-clamp-2">{t.summary}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> ~{t.turnaroundDays}d</span>
                <span className="inline-flex items-center gap-1"><FlaskConical className="h-3.5 w-3.5" /> {t.providerCount} provider{t.providerCount === 1 ? "" : "s"}</span>
                {t.accreditation && <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> {t.accreditation}</span>}
              </div>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 opacity-0 transition group-hover:opacity-100">
                View test <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Popular requests */}
      {ind.seoKeywords.length > 0 && (
        <section className="border-t border-surface-border bg-surface-subtle">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-ink-faint" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-faint">Popular {ind.title} requests</h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {ind.seoKeywords.map((k) => (
                <Link key={k} to={`/exchange?q=${encodeURIComponent(k)}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-white px-3 py-1.5 text-sm text-ink-soft transition hover:border-brand-300 hover:text-brand-700">
                  <FlaskConical className="h-3.5 w-3.5 text-ink-faint" /> {k}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {ind.faq.length > 0 && (
        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">FAQ</span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{ind.title} testing - frequently asked</h2>
          </div>
          <div className="space-y-3">
            {ind.faq.map((f) => (
              <details key={f.q} className="group card p-5">
                <summary className="flex cursor-pointer items-start justify-between gap-4 list-none">
                  <span className="flex items-start gap-2.5 font-semibold text-ink">
                    <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" strokeWidth={1.5} />{f.q}
                  </span>
                  <span className="mt-1 text-ink-faint transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 pl-7 text-ink-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="card overflow-hidden bg-brand-950 p-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white">Need {ind.title} testing or certification?</h2>
          <p className="mx-auto mt-2 max-w-lg text-brand-200">Pick a test or a certification package and get matched with accredited providers in minutes.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a href="#tests" className="btn-primary bg-white text-brand-700 hover:bg-brand-50">Browse tests <ArrowRight className="h-4 w-4" /></a>
            <Link to={firstCat ? `/exchange?category=${encodeURIComponent(firstCat)}` : "/exchange"} className="btn-secondary border-white/20 bg-white/10 text-white hover:bg-white/20">Explore the catalog</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
