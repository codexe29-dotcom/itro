import { useState } from "react";
import { useParams, Navigate, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ShieldCheck, CalendarClock, Layers, Zap, Users, TrendingDown, ArrowRight,
  CheckCircle2, ShoppingCart, Clock,
} from "lucide-react";
import { fetchPackageDetail, addPackageToCart, type Strategy } from "@/lib/catalog";
import { useSeo } from "@/lib/useSeo";
import { money } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { LoadingBlock, ErrorState, Button, useToast } from "@/components/ui";

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

export default function PackageDetail() {
  const { slug = "" } = useParams();
  const [strategy, setStrategy] = useState<Strategy>("BALANCED");
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["package", slug, strategy],
    queryFn: () => fetchPackageDetail(slug, strategy),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const pkg = q.data;

  const add = useMutation({
    mutationFn: () => addPackageToCart({ packageSlug: slug, strategy }),
    onSuccess: () => { toast.push("success", "Package added to your cart."); qc.invalidateQueries({ queryKey: ["cart"] }); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not add package."),
  });

  useSeo({
    title: pkg ? `${pkg.name} | ITRO` : "Package | ITRO",
    description: pkg?.summary ?? undefined,
    canonicalPath: `/packages/${slug}`,
  });

  if (q.isLoading && !pkg) return <div className="mx-auto max-w-7xl px-4 py-16"><LoadingBlock /></div>;
  if (q.isError) {
    const status = (q.error as { response?: { status?: number } })?.response?.status;
    if (status === 404) return <Navigate to="/exchange" replace />;
    return <div className="mx-auto max-w-7xl px-4 py-16"><ErrorState error={q.error} /></div>;
  }
  if (!pkg) return <Navigate to="/exchange" replace />;

  const quote = pkg.quote;

  function onAdd() {
    if (!user) { navigate("/login", { state: { from: `/packages/${slug}` } }); return; }
    if (user.role !== "INDUSTRY_BUYER") { toast.push("info", "Sign in as a buyer to add packages."); return; }
    add.mutate();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
        <Link to="/" className="hover:text-brand-600">Home</Link><span>/</span>
        <Link to={`/industries/${pkg.industry.slug}`} className="hover:text-brand-600">{pkg.industry.title}</Link><span>/</span>
        <span className="font-medium text-ink">{pkg.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Main */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700"><Layers className="h-3 w-3" /> {pkg.items.length}-test package</span>
            {pkg.accreditation && <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700"><ShieldCheck className="h-3 w-3" /> {pkg.accreditation}</span>}
            {pkg.discountPct > 0 && <span className="badge-brand">Save {pkg.discountPct}%</span>}
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink">{pkg.name}</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">{pkg.description ?? pkg.summary}</p>

          {/* Strategy toggle */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-ink">Included tests <span className="text-ink-faint">({pkg.items.length})</span></h2>
            <div className="inline-flex rounded-xl border border-surface-border bg-white p-1">
              {STRATEGIES.map((s) => (
                <button key={s.key} onClick={() => setStrategy(s.key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${strategy === s.key ? "bg-brand-600 text-white" : "text-ink-soft hover:text-brand-700"}`}>
                  <s.icon className="h-3.5 w-3.5" /> {s.label}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1 text-xs text-ink-faint">Each test is routed to its {strategy.toLowerCase()} provider - price &amp; timeline update live. {q.isFetching && "Updating…"}</p>

          {/* Routed items */}
          <div className="mt-4 space-y-3">
            {pkg.items.map((it) => {
              const route = quote?.items.find((r) => r.testSlug === it.test.slug);
              const rec = route?.recommended;
              return (
                <div key={it.test.slug} className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/tests/${it.test.slug}`} className="font-semibold text-ink hover:text-brand-700">{it.test.name}</Link>
                      <p className="mt-0.5 text-xs text-ink-muted">{it.test.summary}</p>
                      {rec && (
                        <p className="mt-1.5 inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                          <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-brand-600" /> {rec.institutionName}</span>
                          <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {etaLabel(rec.estimatedCompletion)}</span>
                          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {route?.providerCount} providers</span>
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {rec ? <p className="font-bold text-ink">{money(rec.price, rec.currency)}</p> : <p className="text-xs text-ink-faint">No provider</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar - bundle quote */}
        <aside>
          <div className="card sticky top-20 p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Bundle price ({strategy.toLowerCase()})</p>
            {quote ? (
              <>
                <div className="mt-2 flex items-end gap-2">
                  <p className="text-3xl font-extrabold text-ink">{money(quote.bundlePrice, quote.currency)}</p>
                  {quote.savings > 0 && <p className="mb-1 text-sm text-ink-faint line-through">{money(quote.gross, quote.currency)}</p>}
                </div>
                {quote.savings > 0 && (
                  <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
                    <TrendingDown className="h-4 w-4" /> Save {money(quote.savings, quote.currency)} ({quote.discountPct}%)
                  </p>
                )}
                <div className="mt-4 space-y-2 border-t border-surface-border pt-4 text-sm text-ink-muted">
                  <p className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> Earliest start</span><span className="font-medium text-ink">{etaLabel(quote.earliestStart)}</span></p>
                  <p className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5"><CalendarClock className="h-4 w-4" /> Est. completion</span><span className="font-medium text-ink">{etaLabel(quote.estimatedCompletion)}</span></p>
                  <p className="text-xs text-ink-faint">Completion is the critical path across all tests (run in parallel).</p>
                </div>
                <Button className="mt-5 w-full justify-center" loading={add.isPending} onClick={onAdd}>
                  <ShoppingCart className="h-4 w-4" /> Add package to cart
                </Button>
                <p className="mt-2 text-center text-xs text-ink-faint">Adds {quote.items.filter((i) => i.recommended).length} routed lines. Adjust providers per line in your cart.</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">Quote unavailable - no providers are currently routable for this package.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
