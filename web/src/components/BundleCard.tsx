import { Link } from "react-router-dom";
import { Boxes, Building2, TrendingDown, ArrowRight } from "lucide-react";
import type { PublicBundle } from "@/lib/bundles";
import { money } from "@/lib/format";
import { Badge } from "@/components/ui";

/**
 * Shared bundle card used on the Exchange, Industry and Lab-profile pages.
 * Always links to the shared bundle detail page (/bundles/:slug) so every
 * entry point behaves identically.
 */
export function BundleCard({ b, currency, showInstitution = true }:
  { b: PublicBundle; currency?: string; showInstitution?: boolean }) {
  const cur = currency ?? b.institution?.currency;
  const img = b.images?.[0];
  return (
    <Link to={`/bundles/${b.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-brand-200 bg-brand-50/40 transition hover:shadow-pop">
      <div className="aspect-[16/9] overflow-hidden bg-surface-muted">
        {img ? (
          <img src={img} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-brand-300"><Boxes className="h-10 w-10" /></div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {b.industry && <Badge tone="gray">{b.industry.title}</Badge>}
          <Badge tone="brand"><TrendingDown className="mr-1 inline h-3 w-3" />{b.discountPct}% off</Badge>
        </div>
        <p className="mt-2 font-semibold text-ink group-hover:text-brand-700">{b.name}</p>
        {showInstitution && b.institution && (
          <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-muted">
            <Building2 className="h-3 w-3" /> {b.institution.name}
          </span>
        )}
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-bold text-ink">{money(b.quote.bundlePrice, cur)}</span>
          {b.quote.savings > 0 && <span className="text-xs text-ink-faint line-through">{money(b.quote.gross, cur)}</span>}
          <span className="text-xs text-ink-faint">· {b.quote.items.length} tests</span>
        </div>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
          View bundle <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
