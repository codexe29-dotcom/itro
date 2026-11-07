import { useMemo, useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowRight, ShieldCheck, Clock, CalendarClock, Users, Star, CheckCircle2,
  FileText, ListChecks, Beaker, Zap, IndianRupee, TrendingDown, Layers, Wrench, Package,
} from "lucide-react";
import { fetchTestDetail, type Strategy, type RankedProvider } from "@/lib/catalog";
import { SEO_SITE_URL, useSeo } from "@/lib/useSeo";
import { money } from "@/lib/format";
import { LoadingBlock, ErrorState } from "@/components/ui";
import AddToOrderButton from "@/components/AddToOrderButton";

const STRATEGIES: { key: Strategy; label: string; icon: typeof Zap }[] = [
  { key: "BALANCED", label: "Balanced", icon: Layers },
  { key: "CHEAPEST", label: "Cheapest", icon: TrendingDown },
  { key: "FASTEST", label: "Fastest", icon: Zap },
  { key: "NEAREST", label: "Nearest", icon: Users },
];

function etaLabel(iso: string | null): string {
  if (!iso) return "On request";
  try { return format(new Date(iso), "d MMM yyyy"); } catch { return "On request"; }
}

function ProviderCard({ p, standardCat }: { p: RankedProvider; standardCat: string }) {
  return (
    <div className={`card p-5 ${p.recommended ? "ring-2 ring-brand-600" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-ink">{p.institutionName}</h3>
            {p.recommended && <span className="badge-brand">Recommended</span>}
          </div>
          <p className="mt-0.5 text-xs text-ink-faint">
            {[p.city, p.state].filter(Boolean).join(", ") || standardCat}
            {p.distanceKm != null && ` · ${p.distanceKm} km`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-ink">{money(p.price, p.currency)}</p>
          <p className="text-xs text-ink-faint">{p.pricingMode === "FIXED" ? "fixed price" : "indicative"}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink-muted sm:grid-cols-4">
        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> ~{p.turnaroundDays}d work</span>
        <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {etaLabel(p.estimatedCompletion)}</span>
        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {p.queueDepth} in queue</span>
        {p.rating != null
          ? <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 text-brand-500" /> {p.rating.toFixed(1)} ({p.reviewCount})</span>
          : <span className="inline-flex items-center gap-1 text-ink-faint"><Star className="h-3.5 w-3.5" /> new</span>}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-surface-border pt-3">
        {p.accredited
          ? <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700"><ShieldCheck className="h-3.5 w-3.5" /> {p.accreditation ?? p.accreditations[0] ?? "Accredited"}</span>
          : <span className="text-xs text-ink-faint">Accreditation on request</span>}
        <AddToOrderButton service={{ id: p.serviceId, pricingMode: p.pricingMode as "FIXED" | "QUOTE" }} variant={p.recommended ? "primary" : "secondary"} className="btn-sm" />
      </div>
    </div>
  );
}

export default function TestDetail() {
  const { slug = "" } = useParams();
  const [strategy, setStrategy] = useState<Strategy>("BALANCED");
  const q = useQuery({
    queryKey: ["test", slug, strategy],
    queryFn: () => fetchTestDetail(slug, strategy),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const t = q.data;

  const testJsonLd = useMemo(() => t ? [{
    "@context": "https://schema.org",
    "@type": "Service",
    name: t.name,
    description: t.description ?? t.summary ?? undefined,
    serviceType: t.category,
    provider: t.providers.length
      ? [...new Set(t.providers.map((provider) => provider.institutionName))]
          .map((name) => ({ "@type": "Organization", name }))
      : undefined,
    areaServed: { "@type": "Country", name: "India" },
  }] : [], [t]);

  useSeo({
    title: t ? `${t.name} - Testing & Providers | ITRO` : "Test | ITRO",
    description: t?.summary ?? t?.description ?? undefined,
    canonicalPath: `/tests/${slug}`,
    jsonLd: testJsonLd,
  });

  if (q.isLoading && !t) return <div className="mx-auto max-w-7xl px-4 py-16"><LoadingBlock /></div>;
  if (q.isError) {
    const status = (q.error as { response?: { status?: number } })?.response?.status;
    if (status === 404) return <Navigate to="/exchange" replace />;
    return <div className="mx-auto max-w-7xl px-4 py-16"><ErrorState error={q.error} /></div>;
  }
  if (!t) return <Navigate to="/exchange" replace />;

  const recommended = t.providers.find((p) => p.recommended) ?? t.providers[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Breadcrumb + header */}
      <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
        <Link to="/" className="hover:text-brand-600">Home</Link><span>/</span>
        <Link to={`/industries/${t.industry.slug}`} className="hover:text-brand-600">{t.industry.title}</Link><span>/</span>
        <span className="font-medium text-ink">{t.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Main */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge-gray">{t.category}</span>
            {t.accreditation && <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700"><ShieldCheck className="h-3 w-3" /> {t.accreditation}</span>}
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink">{t.name}</h1>
          {t.purpose && <p className="mt-2 max-w-2xl font-medium text-ink-soft">{t.purpose}</p>}
          <p className="mt-2 max-w-2xl text-ink-muted">{t.description ?? t.summary}</p>
          {t.standardCodes.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {t.standardCodes.map((c) => <span key={c} className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-soft">{c}</span>)}
            </div>
          )}

          {/* Providers */}
          <div className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-ink">Providers <span className="text-ink-faint">({t.providers.length})</span></h2>
              {/* Strategy toggle */}
              <div className="inline-flex rounded-xl border border-surface-border bg-white p-1">
                {STRATEGIES.map((s) => (
                  <button key={s.key} onClick={() => setStrategy(s.key)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${strategy === s.key ? "bg-brand-600 text-white" : "text-ink-soft hover:text-brand-700"}`}>
                    <s.icon className="h-3.5 w-3.5" /> {s.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1 text-xs text-ink-faint">Ranked by your choice - providers and price update live. {q.isFetching && "Updating…"}</p>

            <div className="mt-4 space-y-4">
              {t.providers.length === 0
                ? <div className="card p-6 text-sm text-ink-muted">No providers are currently listed for this test. Request a quote via the catalog.</div>
                : t.providers.map((p) => <ProviderCard key={p.providerLinkId} p={p} standardCat={t.category} />)}
            </div>
          </div>

          {/* Procedure */}
          {t.procedures.length > 0 && (
            <div className="mt-10">
              <h2 className="flex items-center gap-2 text-lg font-bold text-ink"><ListChecks className="h-5 w-5 text-brand-600" /> Test procedure</h2>
              <ol className="mt-4 space-y-3">
                {t.procedures.map((s) => (
                  <li key={s.stepNo} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{s.stepNo}</span>
                    <div><p className="font-semibold text-ink">{s.title}</p>{s.detail && <p className="text-sm text-ink-muted">{s.detail}</p>}</div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Conformance & fixtures */}
          {(t.conformanceRows?.length > 0 || t.fixturesRequired?.length > 0 || t.severityNotes) && (
            <div className="mt-10">
              <h2 className="flex items-center gap-2 text-lg font-bold text-ink"><ShieldCheck className="h-5 w-5 text-brand-600" /> Conformance &amp; severities</h2>
              {t.conformanceRows?.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded-xl border border-surface-border">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wide text-ink-faint">
                      <tr><th className="px-3 py-2">Standard</th><th className="px-3 py-2">Clause</th><th className="px-3 py-2">Test no.</th><th className="px-3 py-2">Condition</th><th className="px-3 py-2">Severity</th></tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                      {t.conformanceRows.map((r, i) => (
                        <tr key={i}><td className="px-3 py-2 font-medium text-ink">{r.standard || "—"}</td><td className="px-3 py-2 text-ink-soft">{r.clause || "—"}</td><td className="px-3 py-2 text-ink-soft">{r.testNo || "—"}</td><td className="px-3 py-2 text-ink-soft">{r.condition || "—"}</td><td className="px-3 py-2 text-ink-soft">{r.severity || "—"}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {t.severityNotes && <p className="mt-3 text-sm text-ink-muted">{t.severityNotes}</p>}
              {t.fixturesRequired?.length > 0 && (
                <div className="mt-4">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink"><Wrench className="h-4 w-4 text-brand-600" /> Fixtures &amp; prerequisites</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {t.fixturesRequired.map((fx) => <span key={fx} className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-soft">{fx}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Associated tests */}
          {t.associated.length > 0 && (
            <div className="mt-10">
              <h2 className="text-lg font-bold text-ink">Associated tests</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {t.associated.map((a) => (
                  <Link key={a.slug} to={`/tests/${a.slug}`} className="group card p-4 hover:border-brand-300 transition">
                    <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-ink group-hover:text-brand-700">{a.name}</h3><span className="badge-gray">{a.category}</span></div>
                    {a.summary && <p className="mt-1 text-xs text-ink-muted line-clamp-1">{a.summary}</p>}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-5">
          {recommended && (
            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Recommended ({strategy.toLowerCase()})</p>
              <p className="mt-2 text-2xl font-bold text-ink">{money(recommended.price, recommended.currency)}</p>
              <p className="text-sm text-ink-muted">{recommended.institutionName}</p>
              <div className="mt-3 space-y-1.5 text-xs text-ink-muted">
                <p className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Est. completion {etaLabel(recommended.estimatedCompletion)}</p>
                <p className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> ~{recommended.turnaroundDays} working days</p>
                <p className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {recommended.queueDepth} jobs in queue</p>
              </div>
              <div className="mt-4">
                <AddToOrderButton service={{ id: recommended.serviceId, pricingMode: recommended.pricingMode as "FIXED" | "QUOTE" }} className="w-full justify-center" />
              </div>
            </div>
          )}

          <div className="card p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><Beaker className="h-4 w-4 text-brand-600" /> Sample requirements</h3>
            <p className="mt-2 text-sm text-ink-muted">{t.sampleRequirements ?? "Confirmed on order."}</p>
            <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-md bg-surface-muted px-2 py-0.5 font-medium text-ink-soft">{t.samplesRequired ?? 1} specimen{(t.samplesRequired ?? 1) === 1 ? "" : "s"}</span>
              {t.sampleDestructive && <span className="rounded-md bg-surface-muted px-2 py-0.5 font-medium text-ink-soft">Destructive</span>}
              {t.sampleReturned && <span className="rounded-md bg-surface-muted px-2 py-0.5 font-medium text-ink-soft">Returned</span>}
            </div>
          </div>

          {t.deliverables?.length > 0 && (
            <div className="card p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><Package className="h-4 w-4 text-brand-600" /> You receive</h3>
              <ul className="mt-3 space-y-1.5">
                {t.deliverables.map((d) => (
                  <li key={d} className="flex items-start gap-2 text-sm text-ink-soft"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {d}</li>
                ))}
              </ul>
            </div>
          )}

          {t.forms.length > 0 && (
            <div className="card p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><FileText className="h-4 w-4 text-brand-600" /> Forms</h3>
              <ul className="mt-3 space-y-2">
                {t.forms.map((f) => (
                  <li key={f.name} className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-ink">{f.name}{f.required && <span className="ml-1 text-xs text-brand-600">*</span>}</p>
                      {f.description && <p className="text-xs text-ink-faint">{f.description}</p>}
                    </div>
                    {f.fileUrl
                      ? <a href={f.fileUrl} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold text-brand-700 hover:underline">Download</a>
                      : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-ink-faint">* required at order.</p>
            </div>
          )}

          <div className="card bg-surface-subtle p-5 text-center">
            <IndianRupee className="mx-auto h-5 w-5 text-brand-600" />
            <p className="mt-2 text-sm text-ink-soft">Need the full program?</p>
            <Link to={`/industries/${t.industry.slug}#packages`} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
              See {t.industry.title} packages <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
