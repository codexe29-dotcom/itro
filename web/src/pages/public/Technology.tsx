import { useParams, Navigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, ShieldCheck, Clock, FlaskConical, Microscope, Building2, MapPin, Boxes,
} from "lucide-react";
import { fetchTechnology } from "@/lib/catalog";
import { iconFor } from "@/lib/industryIcons";
import { imageForCategory } from "@/lib/imagery";
import { useSeo } from "@/lib/useSeo";
import { LoadingBlock, ErrorState } from "@/components/ui";
import HeroArt from "@/components/HeroArt";

export default function Technology() {
  const { slug = "" } = useParams();
  const q = useQuery({ queryKey: ["technology", slug], queryFn: () => fetchTechnology(slug), retry: false });
  const t = q.data;

  useSeo({
    title: t ? `${t.title} - Instruments, Tests & Labs | ITRO` : "Technology | ITRO",
    description: t?.blurb ?? undefined,
    canonicalPath: `/technologies/${slug}`,
  });

  if (q.isLoading) return <div className="mx-auto max-w-7xl px-4 py-16"><LoadingBlock /></div>;
  if (q.isError) {
    const status = (q.error as { response?: { status?: number } })?.response?.status;
    if (status === 404) return <Navigate to="/exchange" replace />;
    return <div className="mx-auto max-w-7xl px-4 py-16"><ErrorState error={q.error} /></div>;
  }
  if (!t) return <Navigate to="/exchange" replace />;

  const Icon = iconFor(t.icon);
  const firstCat = t.categories[0];
  const stats = [
    { label: "Tests", value: t.tests.length },
    { label: "Instruments", value: t.instruments.length },
    { label: "Facilities", value: t.facilities.length },
    { label: "Services", value: t.serviceCount },
  ];

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
          <HeroArt slug={t.slug} tone="dark" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
          <nav className="mb-6 flex items-center gap-1.5 text-xs text-white/50">
            <Link to="/" className="hover:text-white">Home</Link><span>/</span><span>Technologies</span><span>/</span>
            <span className="font-medium text-white/90">{t.title}</span>
          </nav>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
            <Icon className="h-3.5 w-3.5" /> Technology capability
          </span>
          <h1 className="mt-5 max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
            <span className="bg-gradient-to-r from-white via-brand-100 to-accent-cyan bg-clip-text text-transparent">{t.title}</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-brand-100/90">{t.blurb}</p>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {t.categories.map((c) => <span key={c} className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-xs font-medium text-white/80 backdrop-blur">{c}</span>)}
          </div>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
            {stats.map((s) => (
              <div key={s.label}><p className="text-2xl font-bold text-white">{s.value}</p><p className="text-xs text-white/60">{s.label}</p></div>
            ))}
          </div>
          <div className="mt-8">
            <Link to={firstCat ? `/exchange?category=${encodeURIComponent(firstCat)}` : "/exchange"} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand-800 shadow-lg transition hover:bg-brand-50">
              Browse {t.title} services <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Tests */}
      {t.tests.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">Tests</span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{t.title} tests</h2>
            <p className="mt-2 text-ink-muted">Configurable tests using {t.title.toLowerCase()} - with live provider pricing and turnaround.</p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.tests.map((test) => (
              <Link key={test.slug} to={`/tests/${test.slug}`} className="group card p-5 hover:border-brand-300 hover:shadow-pop transition flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-semibold text-ink group-hover:text-brand-700">{test.name}</h3>
                  <span className="badge-gray shrink-0">{test.category}</span>
                </div>
                <p className="mt-1 text-sm text-ink-muted line-clamp-2">{test.summary}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                  {test.industry && <span>{test.industry.title}</span>}
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> ~{test.turnaroundDays}d</span>
                  <span className="inline-flex items-center gap-1"><FlaskConical className="h-3.5 w-3.5" /> {test.providerCount} prov.</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Instruments */}
      {t.instruments.length > 0 && (
        <section className="border-y border-surface-border bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">Instruments</span>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Available {t.title.toLowerCase()} instruments</h2>
            </div>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {t.instruments.map((i) => (
                <Link key={i.id} to={`/instruments/${i.id}`} className="group card overflow-hidden hover:border-brand-300 hover:shadow-pop transition flex flex-col">
                  <div className="relative h-36 overflow-hidden">
                    <img src={i.image ?? imageForCategory(i.category, 600)} alt={i.category} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-ink">{i.category}</span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-semibold text-ink group-hover:text-brand-700">{i.name}</h3>
                    {(i.make || i.model) && <p className="text-xs text-ink-faint">{[i.make, i.model].filter(Boolean).join(" · ")}</p>}
                    {i.institution && (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-ink-muted"><Building2 className="h-3.5 w-3.5" /> {i.institution.name}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Facilities */}
      {t.facilities.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">Facilities</span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Labs offering {t.title.toLowerCase()}</h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.facilities.map((f) => (
              <Link key={f.id} to={`/institutions/${f.institution.slug}`} className="group card p-5 hover:border-brand-300 hover:shadow-pop transition">
                <div className="flex items-start justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100"><Microscope className="h-5 w-5" strokeWidth={1.5} /></span>
                  <span className="badge-gray"><Boxes className="mr-1 inline h-3 w-3" />{f.instrumentCount}</span>
                </div>
                <h3 className="mt-3 font-semibold text-ink group-hover:text-brand-700">{f.name}</h3>
                <p className="mt-0.5 text-sm text-ink-muted">{f.institution.name}</p>
                {(f.institution.city || f.institution.state) && (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-faint"><MapPin className="h-3 w-3" /> {[f.institution.city, f.institution.state].filter(Boolean).join(", ")}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
