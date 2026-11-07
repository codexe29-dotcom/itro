import { useParams, Navigate, Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Boxes, Building2, MapPin, Layers, TrendingDown, ShoppingCart, ArrowLeft, CheckCircle2,
  ShieldCheck, Clock, FileText,
} from "lucide-react";
import { fetchPublicBundle, addBundleToCart } from "@/lib/bundles";
import { useSeo } from "@/lib/useSeo";
import { money } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { RatingStars } from "@/components/RatingStars";
import { LoadingBlock, ErrorState, Button, Badge, useToast } from "@/components/ui";

export default function BundleDetail() {
  const { slug = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = () => (location.key !== "default" ? navigate(-1) : navigate("/exchange?tab=bundles"));
  const toast = useToast();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["public-bundle", slug], queryFn: () => fetchPublicBundle(slug), retry: false });
  const b = q.data;

  const add = useMutation({
    mutationFn: () => addBundleToCart(slug),
    onSuccess: () => { toast.push("success", "Bundle added to your cart."); qc.invalidateQueries({ queryKey: ["cart"] }); navigate("/cart"); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not add bundle."),
  });

  useSeo({ title: b ? `${b.name} | ITRO` : "Bundle | ITRO", description: b?.description ?? undefined, canonicalPath: `/bundles/${slug}` });

  if (q.isLoading && !b) return <div className="mx-auto max-w-7xl px-4 py-16"><LoadingBlock /></div>;
  if (q.isError) {
    const status = (q.error as { response?: { status?: number } })?.response?.status;
    if (status === 404) return <Navigate to="/exchange" replace />;
    return <div className="mx-auto max-w-7xl px-4 py-16"><ErrorState error={q.error} /></div>;
  }
  if (!b) return <Navigate to="/exchange" replace />;

  const cur = b.institution?.currency;
  const img = b.images?.[0];

  function onAdd() {
    if (!user) { navigate("/login", { state: { from: `/bundles/${slug}` } }); return; }
    add.mutate();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <button onClick={goBack} className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to catalog
      </button>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Main */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700"><Layers className="h-3 w-3" /> {b.quote.items.length}-test bundle</span>
            {b.industry && <Badge tone="gray">{b.industry.title}</Badge>}
            {b.discountPct > 0 && <span className="badge-brand"><TrendingDown className="mr-1 inline h-3 w-3" /> {b.discountPct}% off</span>}
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink">{b.name}</h1>
          {b.institution && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
              <Link to={`/institutions/${b.institution.slug}`} className="inline-flex items-center gap-1.5 font-medium text-ink hover:text-brand-700">
                <Building2 className="h-4 w-4" /> {b.institution.name}
              </Link>
              {(b.institution.city || b.institution.state) && (
                <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {[b.institution.city, b.institution.state].filter(Boolean).join(", ")}</span>
              )}
            </div>
          )}
          {b.description && <p className="mt-3 max-w-2xl text-ink-muted">{b.description}</p>}

          {img && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-surface-border">
              <img src={img} alt={b.name} className="h-64 w-full object-cover" loading="eager" />
            </div>
          )}

          <h2 className="mt-8 text-lg font-bold text-ink">Included tests <span className="text-ink-faint">({b.quote.items.length})</span></h2>
          <div className="mt-4 space-y-3">
            {b.quote.items.map((it) => {
              const img = it.images?.[0];
              return (
                <div key={it.serviceId} className="card flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="flex min-w-0 gap-3">
                    {img && (
                      <div className="hidden h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-surface-border bg-surface-muted sm:block">
                        <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <Link to={`/services/${it.serviceId}`} className="font-semibold text-ink hover:text-brand-700">{it.name}</Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone="gray">{it.category}</Badge>
                        {it.accreditation && <Badge tone="success"><ShieldCheck className="mr-1 inline h-3 w-3" />{it.accreditation}</Badge>}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                        {b.institution && (
                          <Link to={`/institutions/${b.institution.slug}`} className="inline-flex items-center gap-1 hover:text-brand-700"><Building2 className="h-3.5 w-3.5" /> {b.institution.name}</Link>
                        )}
                        {it.rating && it.rating.count > 0 && (
                          <span className="inline-flex items-center gap-1"><RatingStars value={it.rating.avg} size={12} /> {it.rating.avg.toFixed(1)} ({it.rating.count})</span>
                        )}
                        {it.turnaroundDays != null && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {it.turnaroundDays} days</span>}
                        {it.deliverable && <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {it.deliverable}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-ink">{money(it.price, cur)}</p>
                    {it.listPrice > it.price && <p className="text-xs text-ink-faint line-through">{money(it.listPrice, cur)}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar — bundle quote */}
        <aside>
          <div className="card sticky top-20 p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Bundle price</p>
            <div className="mt-2 flex items-end gap-2">
              <p className="text-3xl font-extrabold text-ink">{money(b.quote.bundlePrice, cur)}</p>
              {b.quote.savings > 0 && <p className="mb-1 text-sm text-ink-faint line-through">{money(b.quote.gross, cur)}</p>}
            </div>
            {b.quote.savings > 0 && (
              <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
                <TrendingDown className="h-4 w-4" /> Save {money(b.quote.savings, cur)} ({b.discountPct}%)
              </p>
            )}
            <div className="mt-4 space-y-2 border-t border-surface-border pt-4 text-sm text-ink-muted">
              {b.quote.items.map((it) => (
                <p key={it.serviceId} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand-600" /> <span className="truncate">{it.name}</span>
                </p>
              ))}
            </div>
            <Button className="mt-5 w-full justify-center" loading={add.isPending} onClick={onAdd}>
              <ShoppingCart className="h-4 w-4" /> Add bundle to cart
            </Button>
            <p className="mt-2 text-center text-xs text-ink-faint">Adds all {b.quote.items.length} tests as separate lines. Adjust anytime in your cart.</p>
            {!user && <p className="mt-1 text-center text-xs text-ink-muted">You'll be asked to sign in first.</p>}
          </div>
        </aside>
      </div>

      <p className="mt-8 flex items-center gap-1.5 text-xs text-ink-faint"><Boxes className="h-3.5 w-3.5" /> Bundle discounts are provider-funded — the platform fee is recomputed on the discounted price.</p>
    </div>
  );
}
