import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Search, FlaskConical, Package, Building2, UserCog, BadgeCheck, ArrowRight, Loader2 } from "lucide-react";
import { searchAll } from "@/lib/queries";

/**
 * Unified instant search. One box that searches Tests, Packages, Labs, Experts
 * and Standards, shows grouped results in a dropdown as you type, and opens the
 * full /search results page on Enter or "See all". Two visual variants:
 *  - "hero"   : large box with a Search button (homepage banner)
 *  - "header" : compact box for the sticky header on every page
 */
export default function GlobalSearch({ variant = "header", placeholder }: { variant?: "hero" | "header"; placeholder?: string }) {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 180); return () => clearTimeout(t); }, [q]);
  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced], queryFn: () => searchAll(debounced), enabled: debounced.length >= 2,
  });

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const go = (to: string) => { setOpen(false); setQ(""); nav(to); };
  const submit = (e?: React.FormEvent) => { e?.preventDefault(); if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`); };

  const r = data;
  const hasAny = !!r && (r.tests.length || r.packages.length || r.labs.length || r.experts.length || r.standards.length);
  const ph = placeholder ?? "Search tests, packages, labs or standards…";

  return (
    <div ref={box} className={clsx("relative", variant === "hero" ? "w-full" : "w-full")}>
      <form onSubmit={submit}>
        {variant === "hero" ? (
          <div className="flex items-center gap-1.5 rounded-xl border border-surface-border bg-white p-1.5 shadow-pop sm:gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint sm:left-4" />
              <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
                placeholder={ph} className="w-full min-w-0 rounded-lg border-0 bg-transparent py-3.5 pl-10 pr-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none sm:pl-12 sm:pr-3 sm:text-base" />
            </div>
            <button type="submit" className="btn-primary shrink-0 whitespace-nowrap rounded-lg px-3 py-3 text-sm sm:px-6 sm:py-3.5 sm:text-base">Search <ArrowRight className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
              placeholder="Search…" className="input w-full pl-9" />
          </div>
        )}
      </form>

      {open && debounced.length >= 2 && (
        <div className={clsx("absolute z-50 mt-2 max-h-[70vh] overflow-auto rounded-xl border border-surface-border bg-white p-2 shadow-pop",
          variant === "hero" ? "w-full" : "right-0 w-[360px]")}>
          {isFetching && !hasAny && (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" /> Searching…</div>
          )}
          {!isFetching && !hasAny && (
            <button onClick={() => submit()} className="block w-full rounded-lg px-3 py-4 text-left text-sm text-ink-muted hover:bg-surface-muted">
              No quick matches. Press Enter to search everything for “{debounced}”.
            </button>
          )}

          {r && r.tests.length > 0 && (
            <Group label="Tests" count={r.tests.length}>
              {r.tests.map((t) => (
                <Item key={t.id} icon={<FlaskConical className="h-4 w-4" />} onClick={() => go(`/tests/${t.slug}`)}
                  title={t.name} sub={[t.category, ...(t.standardCodes ?? [])].filter(Boolean).slice(0, 2).join(" · ")} />
              ))}
            </Group>
          )}
          {r && r.packages.length > 0 && (
            <Group label="Packages" count={r.packages.length}>
              {r.packages.map((p) => (
                <Item key={p.id} icon={<Package className="h-4 w-4" />} onClick={() => go(`/packages/${p.slug}`)} title={p.name} sub={p.summary ?? undefined} />
              ))}
            </Group>
          )}
          {r && r.labs.length > 0 && (
            <Group label="Labs" count={r.labs.length}>
              {r.labs.map((l) => (
                <Item key={l.id} icon={<Building2 className="h-4 w-4" />} onClick={() => go(`/institutions/${l.slug}`)}
                  title={l.name} sub={[l.city, l.state].filter(Boolean).join(", ") || (l.accreditations ?? []).slice(0, 2).join(", ")} />
              ))}
            </Group>
          )}
          {r && r.experts.length > 0 && (
            <Group label="Experts" count={r.experts.length}>
              {r.experts.map((e) => (
                <Item key={e.id} icon={<UserCog className="h-4 w-4" />} onClick={() => go(`/experts/${e.id}`)} title={e.name} sub={`${e.title} · ${e.provider}`} />
              ))}
            </Group>
          )}
          {r && r.standards.length > 0 && (
            <Group label="Standards" count={r.standards.length}>
              {r.standards.map((s) => (
                <Item key={s} icon={<BadgeCheck className="h-4 w-4" />} onClick={() => go(`/exchange?q=${encodeURIComponent(s)}`)} title={s} sub="Browse tests under this standard" />
              ))}
            </Group>
          )}

          {hasAny && (
            <button onClick={() => submit()} className="mt-1 block w-full rounded-lg bg-surface-subtle px-3 py-2.5 text-center text-sm font-semibold text-brand-700 hover:bg-brand-50">
              See all results for “{debounced}” →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{label} <span className="text-ink-faint/70">({count})</span></p>
      {children}
    </div>
  );
}

function Item({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface-muted">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{title}</span>
        {sub && <span className="block truncate text-xs text-ink-muted">{sub}</span>}
      </span>
    </button>
  );
}
