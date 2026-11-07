import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, Search, FileText, Workflow, Wallet, ShieldCheck, BadgeCheck, FlaskConical,
  Building2, Boxes, Microscope, Lock, FileSignature, Star, MapPin, CheckCircle2, CalendarCheck,
} from "lucide-react";
import { useConfig } from "@/lib/useConfig";
import { fetchExchangeCategories, fetchExchangeServices, fetchInstitutions, fetchCatalogHighlights, asList } from "@/lib/queries";
import { TECH_AREAS, INDUSTRIES } from "@/lib/taxonomy";
import { imageForCategory } from "@/lib/imagery";
import { money } from "@/lib/format";
import HeroSlideshow, { type HeroSlide } from "@/components/HeroSlideshow";
import GlobalSearch from "@/components/GlobalSearch";

// Industry-representative imagery of Indian advanced testing & research facilities.
// Drop 4-5 photos into web/public with these names (or edit the paths) and the
// rotating hero lights up automatically. Order is chosen so each slide enters from
// a different direction (top, right, bottom, left, cycling). Leave empty to show a
// clean text hero until the images are in place.
const HERO_SLIDES: HeroSlide[] = [
  { src: "/hero-1-tejas.jpg",         label: "Aerospace & Defence" },
  { src: "/hero-5-manufacturing.jpg", label: "Industrial & Manufacturing" },
  { src: "/hero-2-thermovac.jpg",     label: "Environmental Testing" },
  { src: "/hero-4-cleanroom.jpg",     label: "Satellite & Electronics" },
  { src: "/hero-3-gslv.jpg",          label: "Launch Vehicle Integration" },
];

const STEPS = [
  { icon: Search, title: "Describe your need", desc: "Search or describe what you need tested, characterized or machined." },
  { icon: FileText, title: "Get matched & quoted", desc: "Compare accredited facilities by price, distance, turnaround and rating." },
  { icon: Workflow, title: "Managed workflow", desc: "NDA e-sign, sample tracking, analysis and reporting in one timeline." },
  { icon: Wallet, title: "Pay & receive", desc: "Settle securely and download your certified report. Providers get paid automatically." },
];

const TRUST = [
  { icon: BadgeCheck, title: "Accredited facilities", desc: "ISO 17025 & NABL credentials verified during onboarding." },
  { icon: FileSignature, title: "NDA on every order", desc: "Your IP is protected before any sample changes hands." },
  { icon: Lock, title: "Secure managed payments", desc: "Escrowed settlement - providers paid only on delivery." },
];

export default function Landing() {
  const { config } = useConfig();

  const { data: categories } = useQuery({ queryKey: ["ex-categories"], queryFn: fetchExchangeCategories });
  const { data: featured } = useQuery({ queryKey: ["ex-featured"], queryFn: () => fetchExchangeServices({ pageSize: 6 }) });
  const { data: institutions } = useQuery({ queryKey: ["institutions-pub"], queryFn: fetchInstitutions });
  const { data: highlights } = useQuery({ queryKey: ["catalog-highlights"], queryFn: fetchCatalogHighlights });

  const services = asList(featured);

  return (
    <div>
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden border-b border-surface-border bg-white">
        {/* Rotating imagery of Indian advanced testing & research facilities, full-bleed
            off the right edge, masked so it melts into the page (no box). */}
        {HERO_SLIDES.length > 0 && (
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[56%] overflow-hidden lg:block"
            style={{ WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 28%)", maskImage: "linear-gradient(to right, transparent 0%, black 28%)" }}>
            <HeroSlideshow className="absolute inset-0" slides={HERO_SLIDES} />
          </div>
        )}

        <div className="relative mx-auto grid max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,640px)_1fr] lg:px-8">
          <div className="max-w-2xl">
            {/* brand identity kicker — full organisation name for trust */}
            <div className="flex items-center gap-3 font-mono text-[13px] font-semibold uppercase tracking-[0.16em] text-brand-700 sm:text-sm">
              <span className="h-px w-9 shrink-0 bg-gradient-to-r from-brand-500 to-accent-orange" />
              ITRO · Indian Testing &amp; Research Organisation
            </div>

            {/* editorial headline with a gradient measurement bar */}
            <div className="mt-6 flex gap-5">
              <span className="mt-2 hidden w-1 shrink-0 rounded-full bg-gradient-to-b from-brand-500 to-accent-orange sm:block" />
              <h1 className="text-4xl font-extrabold leading-[1.02] tracking-tight text-ink sm:text-[3.5rem]">
                One platform to<br />
                <span className="text-brand-600">test, validate &amp; certify.</span>
              </h1>
            </div>
            <p className="mt-6 max-w-xl text-base text-ink-muted sm:text-lg sm:pl-6">
              Order accredited tests or book lab machines &mdash; matched to India&rsquo;s research
              facilities, managed end-to-end. Research, testing, validation and equipment access, in one place.
            </p>
            <p className="mt-3 text-sm font-medium text-ink-soft sm:pl-6">
              For teams in Aerospace, Automotive, Electronics, Medical, Energy, Materials and more.
            </p>

            <div className="mt-8 max-w-xl sm:pl-6">
              <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">Search tests, packages, labs &amp; standards</label>
              <GlobalSearch variant="hero" placeholder="e.g. tensile test, MIL-STD-810, ISO 17025, EMI/EMC…" />

              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-brand-600" /> ISO 17025 &amp; NABL accredited</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-brand-600" /> Verified facilities</span>
                <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-brand-600" /> NDA-protected</span>
              </div>

              {/* Two clear lanes — pick your path: managed testing vs self-serve machine booking */}
              <div className="mt-7">
                <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">Or pick your path</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link to="/exchange"
                    className="group flex items-start gap-3 rounded-xl border border-surface-border bg-white p-4 shadow-card transition hover:border-brand-300 hover:shadow-lg">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <FlaskConical className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 font-semibold text-ink group-hover:text-brand-700">
                        Get a test done <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-muted">Order accredited testing &amp; analysis &mdash; matched to a lab, managed end-to-end.</span>
                    </span>
                  </Link>
                  <Link to="/equipment"
                    className="group flex items-start gap-3 rounded-xl border border-surface-border bg-white p-4 shadow-card transition hover:border-brand-300 hover:shadow-lg">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-orange/10 text-accent-orange">
                      <CalendarCheck className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 font-semibold text-ink group-hover:text-brand-700">
                        Book a machine <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-muted">Rent instruments &amp; equipment with live availability and schedules.</span>
                    </span>
                  </Link>
                </div>
              </div>
            </div>

            {/* stats rebuilt as an instrument readout strip */}
            <div className="mt-10 inline-grid grid-cols-3 divide-x divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-white shadow-card sm:ml-6">
              {[
                { label: "Industries served", value: INDUSTRIES.length },
                { label: "Capability areas", value: TECH_AREAS.length },
                { label: "Accredited labs", value: "100%" },
              ].map((s) => (
                <div key={s.label} className="px-6 py-4">
                  <p className="font-mono text-3xl font-bold tabular-nums text-ink">{s.value}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Trusted providers ---------------- */}
      {institutions && institutions.length > 0 && (
        <section className="border-b border-surface-border bg-white">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <p className="text-center text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Trusted by leading research institutions & national labs
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {institutions.map((i) => (
                <Link key={i.id} to={`/institutions/${i.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-subtle px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-700">
                  <Building2 className="h-4 w-4 text-ink-faint" strokeWidth={1.5} /> {i.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------- Most-requested tests + standards ---------------- */}
      {highlights && (highlights.tests.length > 0 || highlights.standards.length > 0) && (
        <section className="border-b border-surface-border bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">Get started fast</span>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Most-requested tests</h2>
                <p className="mt-2 text-ink-muted">Jump straight to a common test, or browse by the standard you need.</p>
              </div>
              <Link to="/exchange" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">View all tests <ArrowRight className="h-4 w-4" /></Link>
            </div>

            {highlights.standards.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Browse by standard</span>
                {highlights.standards.map((s) => (
                  <Link key={s} to={`/exchange?q=${encodeURIComponent(s)}`} className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-white px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-700">
                    <BadgeCheck className="h-3.5 w-3.5 text-brand-600" /> {s}
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {highlights.tests.map((t) => (
                <Link key={t.id} to={`/tests/${t.slug}`} className="group card p-5 transition hover:border-brand-300 hover:shadow-pop">
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100 transition group-hover:bg-brand-600 group-hover:text-white"><FlaskConical className="h-5 w-5" strokeWidth={1.5} /></span>
                    {t.providerCount > 0 && <span className="badge-gray">{t.providerCount} lab{t.providerCount === 1 ? "" : "s"}</span>}
                  </div>
                  <h3 className="mt-3 text-[15px] font-semibold text-ink group-hover:text-brand-700">{t.name}</h3>
                  <p className="mt-0.5 text-xs text-ink-muted">{t.industryTitle}</p>
                  {t.standardCodes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {t.standardCodes.slice(0, 2).map((c) => <span key={c} className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-ink-muted">{c}</span>)}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------- Technologies ---------------- */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">Technologies</span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">One catalog, every capability</h2>
            <p className="mt-2 text-ink-muted">From precision machining to electron microscopy - accredited providers, on demand.</p>
          </div>
          <Link to="/exchange" className="hidden items-center gap-1 text-sm font-semibold text-brand-700 hover:underline sm:inline-flex">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TECH_AREAS.map((t) => {
            const count = (categories ?? []).filter((c) => t.categories.includes(c.category)).reduce((n, c) => n + c.count, 0);
            return (
              <Link key={t.key} to={`/technologies/${t.slug}`}
                className="group relative card p-6 hover:border-brand-300 hover:shadow-pop transition">
                <div className="flex items-start justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100 transition group-hover:bg-brand-600 group-hover:text-white">
                    <t.icon className="h-6 w-6" strokeWidth={1.5} />
                  </span>
                  {count > 0 && <span className="badge-gray">{count} service{count === 1 ? "" : "s"}</span>}
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-ink group-hover:text-brand-700">{t.title}</h3>
                <p className="mt-1 text-sm text-ink-muted">{t.blurb}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.categories.map((c) => <span key={c} className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-ink-muted">{c}</span>)}
                </div>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 opacity-0 transition group-hover:opacity-100">
                  Explore <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ---------------- Industries ---------------- */}
      <section className="border-t border-surface-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">Industries</span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Trusted across industries</h2>
            <p className="mt-3 text-ink-muted">Testing, characterization and manufacturing support for demanding sectors.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {INDUSTRIES.map((ind) => (
              <Link key={ind.title} to={`/industries/${ind.slug}`} className="group card p-5 hover:border-brand-300 hover:shadow-pop transition">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100 group-hover:bg-brand-600 group-hover:text-white transition">
                  <ind.icon className="h-5 w-5" strokeWidth={1.5} />
                </span>
                <h3 className="mt-3 font-semibold text-ink text-[15px] group-hover:text-brand-700">{ind.title}</h3>
                <p className="mt-1 text-sm text-ink-muted">{ind.blurb}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section className="border-y border-surface-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">How it works</h2>
            <p className="mt-3 text-ink-muted">From discovery to delivery - one managed workflow for every request.</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative">
                <div className="card p-6 h-full">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-accent-cyan text-white shadow-sm"><s.icon className="h-5 w-5" /></span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Step {i + 1}</span>
                  </div>
                  <h3 className="mt-4 font-semibold text-ink">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-ink-muted">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Featured services ---------------- */}
      {services.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Popular services</h2>
            <Link to="/exchange" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
              Browse all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <Link key={s.id} to={`/services/${s.id}`} className="group card overflow-hidden hover:border-brand-300 hover:shadow-pop transition flex flex-col">
                <div className="relative h-40 overflow-hidden">
                  <img src={s.images?.[0] ?? s.instrument?.images?.[0] ?? imageForCategory(s.category, 700)} alt={s.category} loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/40 to-transparent" />
                  <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-ink">{s.category}</span>
                  {s.accreditation && <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-success/90 px-2.5 py-0.5 text-xs font-medium text-white"><ShieldCheck className="h-3 w-3" />{s.accreditation}</span>}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-semibold text-ink group-hover:text-brand-700">{s.name}</h3>
                  {s.institution && (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-muted">
                      <Building2 className="h-3.5 w-3.5" /> {s.institution.name}
                    </p>
                  )}
                  {s.institution && (s.institution.city || s.institution.state) && (
                    <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-ink-faint">
                      <MapPin className="h-3 w-3" /> {[s.institution.city, s.institution.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                  <div className="mt-4 flex items-end justify-between border-t border-surface-border pt-3">
                    <div>
                      <p className="text-lg font-bold text-ink">{money(s.priceIndustry, s.institution?.currency)}</p>
                      <p className="text-xs text-ink-muted">{s.turnaroundDays} days turnaround</p>
                    </div>
                    <span className="btn-secondary btn-sm">View</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------------- Trust ---------------- */}
      <section className="border-t border-surface-border bg-surface-subtle">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">Who we are</span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              ITRO, the <span className="text-brand-600">Indian Testing &amp; Research Organisation</span>
            </h2>
            <p className="mt-3 text-ink-muted">
              A single, accredited platform connecting industry to research expertise, testing,
              validation and certification. Every engagement is accredited, protected and accountable.
            </p>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {TRUST.map((t) => (
              <div key={t.title} className="card p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><t.icon className="h-5 w-5" /></span>
                <h3 className="mt-4 font-semibold text-ink">{t.title}</h3>
                <p className="mt-1 text-sm text-ink-muted">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="relative card overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 p-10">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle, rgba(6,182,212,0.55), transparent 70%)" }} />
            <div className="relative">
              <h2 className="text-2xl font-bold tracking-tight text-white">Need a test or a part?</h2>
              <p className="mt-2 max-w-md text-brand-200">Describe your requirement and get matched with accredited facilities in minutes.</p>
              <Link to="/exchange" className="mt-6 inline-flex btn-primary bg-white text-brand-700 hover:bg-brand-50">Explore the catalog <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
          <div className="card overflow-hidden bg-white p-10">
            <h2 className="text-2xl font-bold tracking-tight text-ink">Run a research facility?</h2>
            <p className="mt-2 max-w-md text-ink-muted">List your instruments and services, reach new industry customers, and maximize utilization - fully white-labelled.</p>
            <Link to="/register-provider" className="mt-6 inline-flex btn-secondary">List your facility <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
