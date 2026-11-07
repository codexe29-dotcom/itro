import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Sparkles, MapPin, Search, ArrowRight, Building2 } from "lucide-react";
import { aiSearch } from "@/lib/queries";
import { CITIES, findCity, formatDistance } from "@/lib/locations";
import { money } from "@/lib/format";
import { Button, Card, Badge } from "@/components/ui";
import { RatingStars } from "@/components/RatingStars";

const EXAMPLES = [
  "Machine a titanium bracket, ±0.05 mm tolerance",
  "Identify crystalline phases in a ceramic powder",
  "Tensile strength test per ASTM E8 on steel coupons",
  "Fatigue life of an aluminium weld under cyclic load",
];

export default function AiSearch() {
  const [requirement, setRequirement] = useState("");
  const [city, setCity] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      const c = findCity(city);
      return aiSearch({ requirement, lat: c?.lat, lng: c?.lng });
    },
  });

  function run(text?: string) {
    const q = (text ?? requirement).trim();
    if (!q) return;
    if (text) setRequirement(text);
    mutation.mutate();
  }

  const res = mutation.data;

  return (
    <div className="mb-8">
      <Card className="relative overflow-hidden border-brand-200">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-brand-400 to-brand-600" />
        <div className="card-pad">
          <div className="flex items-center gap-2 text-brand-700">
            <div className="rounded-lg bg-brand-50 p-2"><Search className="h-5 w-5" /></div>
            <div>
              <h2 className="text-lg font-semibold text-ink">Facility finder</h2>
              <p className="text-sm text-ink-muted">Describe your requirement in plain language. We match facilities and rank them by fit, price and distance.</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Sparkles className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-brand-400" />
              <textarea
                value={requirement}
                onChange={(e) => setRequirement(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(); }}
                rows={2}
                placeholder="e.g. Machine a titanium bracket with ±0.05 mm tolerance, 20 units"
                className="input resize-none pl-9"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:w-auto">
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-ink-faint" />
                <select value={city} onChange={(e) => setCity(e.target.value)} className="input pl-9 sm:w-44">
                  <option value="">Anywhere</option>
                  {CITIES.map((c) => <option key={c.name} value={c.name}>Near {c.name}</option>)}
                </select>
              </div>
              <Button onClick={() => run()} loading={mutation.isPending} className="whitespace-nowrap">
                <Search className="h-4 w-4" /> Find facilities
              </Button>
            </div>
          </div>

          {!res && !mutation.isPending && (
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button key={ex} onClick={() => run(ex)} className="rounded-full border border-surface-border bg-surface-subtle px-3 py-1 text-xs text-ink-muted hover:border-brand-300 hover:text-brand-700 transition">
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {mutation.isError && (
        <p className="mt-3 text-sm text-danger">Couldn't run the search. Please try again.</p>
      )}

      {res && (
        <div className="mt-5">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-muted">Interpreted as:</span>
            {res.interpreted.categories.map((c) => <Badge key={c} tone="brand">{c}</Badge>)}
            {res.interpreted.keywords.slice(0, 6).map((k) => <span key={k} className="badge-gray">{k}</span>)}
          </div>

          {res.results.length === 0 ? (
            <Card className="card-pad text-center text-sm text-ink-muted">
              No matching facilities found. Try rephrasing or widening the location.
            </Card>
          ) : (
            <div className="space-y-3">
              {res.results.map((r) => (
                <Card key={r.id} className="card-pad hover:shadow-pop transition">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">
                          <Sparkles className="h-3 w-3" /> {r.matchScore}% match
                        </span>
                        <Badge tone="gray">{r.category}</Badge>
                        {r.accreditation && <span className="text-xs font-medium text-success">{r.accreditation}</span>}
                      </div>
                      <Link to={`/services/${r.id}`} className="mt-1.5 block text-lg font-semibold text-ink hover:text-brand-700">{r.name}</Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
                        <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {r.institution?.name}</span>
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {[r.institution?.city, r.institution?.state].filter(Boolean).join(", ")}</span>
                        {r.distanceKm != null && <span>{formatDistance(r.distanceKm)} away</span>}
                        {r.rating && r.rating.count > 0 && <RatingStars value={r.rating.avg} size={13} showValue count={r.rating.count} />}
                      </div>
                      {r.matchReasons?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {r.matchReasons.slice(0, 4).map((reason, i) => (
                            <span key={i} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">{reason}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
                      <div className="text-right">
                        <p className="text-lg font-bold text-ink">{money(r.priceIndustry, r.institution?.currency)}</p>
                        <p className="text-xs text-ink-muted">{r.turnaroundDays} days</p>
                      </div>
                      <Link to={`/services/${r.id}`} className="btn-primary btn-sm whitespace-nowrap">View <ArrowRight className="h-3.5 w-3.5" /></Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
