import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { UserCog, Building2, ArrowRight, Search, Award } from "lucide-react";
import { fetchExchangeExperts } from "@/lib/queries";
import { money } from "@/lib/format";
import { Card, LoadingBlock, ErrorState, EmptyState, Input } from "@/components/ui";
import type { RatePeriod } from "@/lib/types";
import { useSeo } from "@/lib/useSeo";

const RATE_LABEL: Record<RatePeriod, string> = { HOURLY: "/ hr", DAILY: "/ day", PROJECT: "/ project" };

export default function Experts() {
  const [q, setQ] = useState("");
  const [expertise, setExpertise] = useState("");

  useSeo({
    title: "Research Experts & Technical Specialists | ITRO",
    description: "Find researchers, technicians and consultants from institutions on the ITRO testing and research network.",
    canonicalPath: "/experts",
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["exchange-experts", { q, expertise }],
    queryFn: () => fetchExchangeExperts({ q: q || undefined, expertise: expertise || undefined }),
  });
  const experts = data?.data ?? [];

  // Build the expertise facet from the current result set.
  const expertiseOptions = Array.from(
    new Set((data?.data ?? []).flatMap((e) => e.expertise ?? []))
  ).sort();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Skilled Resources</h1>
        <p className="mt-2 text-ink-muted">
          Engage vetted researchers, technicians and consultants from institutions on the network -
          alongside their instruments and services.
        </p>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search experts by name or role…"
          />
        </div>
        <div className="w-56">
          <select
            className="input"
            value={expertise}
            onChange={(e) => setExpertise(e.target.value)}
          >
            <option value="">All expertise</option>
            {expertiseOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <LoadingBlock />
      ) : isError ? (
        <ErrorState error={error} />
      ) : experts.length === 0 ? (
        <Card><EmptyState icon={<UserCog className="h-6 w-6" />} title="No experts found" description="Try adjusting your search or filters." /></Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {experts.map((x) => (
            <Link key={x.id} to={`/experts/${x.id}`}
              className="group card p-6 transition hover:border-brand-300 hover:shadow-pop">
              <div className="flex items-start gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
                  {x.photoUrl ? <img src={x.photoUrl} alt={x.name} className="h-full w-full object-cover" /> : <UserCog className="h-6 w-6" strokeWidth={1.5} />}
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-ink group-hover:text-brand-700">{x.name}</h3>
                  <p className="text-sm text-ink-muted">{x.title}</p>
                  {x.institution && (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-ink-muted">
                      <Building2 className="h-3.5 w-3.5" /> {x.institution.name}
                    </p>
                  )}
                </div>
              </div>

              {x.expertise && x.expertise.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {x.expertise.slice(0, 4).map((e) => (
                    <span key={e} className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-ink-soft">{e}</span>
                  ))}
                  {x.expertise.length > 4 && <span className="text-[11px] text-ink-muted">+{x.expertise.length - 4}</span>}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-surface-border pt-3 text-sm">
                <span className="inline-flex items-center gap-1.5 text-ink-muted">
                  {x.experienceYears != null ? <><Award className="h-4 w-4" strokeWidth={1.5} /> {x.experienceYears} yrs</> : "View profile"}
                </span>
                {x.rate ? (
                  <span className="font-semibold text-ink">{money(x.rate)} <span className="text-xs font-normal text-ink-muted">{RATE_LABEL[x.ratePeriod]}</span></span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-brand-700">View <ArrowRight className="h-3.5 w-3.5" /></span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
