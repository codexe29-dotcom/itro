import { Link } from "react-router-dom";
import { ShieldCheck, Clock, Building2, MapPin } from "lucide-react";
import type { Service } from "@/lib/types";
import { money } from "@/lib/format";
import { imageForCategory } from "@/lib/imagery";
import { RatingStars } from "@/components/RatingStars";
import AddToOrderButton from "@/components/AddToOrderButton";

export default function ServiceCard({ service, to }: { service: Service; to?: string }) {
  const inst = service.institution;
  const href = to ?? `/services/${service.id}`;
  const isFixed = service.pricingMode === "FIXED";
  const displayPrice = isFixed ? (service.buyerPrice ?? service.priceIndustry) : service.priceIndustry;
  // Prefer the service's own uploaded photo, then the linked instrument's, then a category stock image.
  const img = service.images?.[0] ?? service.instrument?.images?.[0] ?? imageForCategory(service.category, 600);
  return (
    <Link
      to={href}
      className="card group flex flex-col overflow-hidden transition hover:shadow-pop hover:-translate-y-0.5"
    >
      <div className="relative h-36 overflow-hidden">
        <img src={img} alt={service.category} loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/40 to-transparent" />
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-ink">{service.category}</span>
        {service.accreditation && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-brand-600/95 px-2.5 py-0.5 text-xs font-medium text-white">
            <ShieldCheck className="h-3 w-3" /> {service.accreditation}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-ink group-hover:text-brand-700 line-clamp-2">{service.name}</h3>
          {service.rating && service.rating.count > 0 && (
            <span className="mt-0.5 shrink-0"><RatingStars value={service.rating.avg} size={13} showValue count={service.rating.count} /></span>
          )}
        </div>
        {service.description && (
          <p className="mt-1 text-sm text-ink-muted line-clamp-2">{service.description}</p>
        )}

        {inst && (
          <div className="mt-3 space-y-0.5">
            <div className="flex items-center gap-1.5 text-sm text-ink-soft">
              <Building2 className="h-4 w-4 text-ink-faint" /> <span className="truncate">{inst.name}</span>
            </div>
            {(inst.city || inst.state) && (
              <div className="flex items-center gap-1.5 text-xs text-ink-faint">
                <MapPin className="h-3 w-3" /> {[inst.city, inst.state].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex items-end justify-between border-t border-surface-border pt-3">
          <div>
            <p className="text-xs text-ink-muted">{isFixed ? "Price" : "From"}</p>
            <p className="text-lg font-bold text-ink">{money(displayPrice, inst?.currency)}</p>
          </div>
          <span className="inline-flex items-center gap-1 text-sm text-ink-muted">
            <Clock className="h-4 w-4" /> {service.turnaroundDays}d
          </span>
        </div>
        <div className="mt-3">
          <AddToOrderButton service={service} className="w-full btn-sm" />
        </div>
      </div>
    </Link>
  );
}
