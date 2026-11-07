import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import clsx from "clsx";
import { Menu, X, ChevronDown, Mail, Building2, LifeBuoy, Boxes, UserCog, ShoppingBag, ShoppingCart, Package, Cpu } from "lucide-react";
import { useConfig } from "@/lib/useConfig";
import { useAuth, isBuyer, isPlatform, isOperator, isAdmin } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { INDUSTRIES } from "@/lib/taxonomy";
import { fetchTechnologies } from "@/lib/catalog";
import { iconFor } from "@/lib/industryIcons";
import { fetchCart } from "@/lib/queries";
import { Logo } from "@/components/Logo";
import GlobalSearch from "@/components/GlobalSearch";

export default function PublicLayout() {
  const { config } = useConfig();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menu, setMenu] = useState<"catalog" | "tech" | "ind" | "signup" | null>(null);
  const [mobileSection, setMobileSection] = useState<"tech" | "ind" | null>(null);
  const isHome = useLocation().pathname === "/";
  const navTrigger = (active: boolean) => clsx(
    "flex items-center gap-1 rounded-lg px-3 py-2 text-[15px] font-semibold transition",
    active ? "text-brand-600" : "text-ink hover:text-brand-600"
  );

  const dashHome = user
    ? isPlatform(user) ? "/platform"
      : isOperator(user) ? "/operator"
        : isBuyer(user) ? "/app"
          : isAdmin(user) ? "/admin" : "/app"
    : null;

  const techs = useQuery({ queryKey: ["technologies-menu"], queryFn: fetchTechnologies }).data ?? [];
  const isBuyerUser = !!user && isBuyer(user);
  const cartCount = useQuery({ queryKey: ["cart"], queryFn: fetchCart, enabled: isBuyerUser }).data?.lines?.length ?? 0;
  const techHref = (slug: string) => `/technologies/${slug}`;
  const indHref = (slug: string) => `/industries/${slug}`;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-surface-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          {/* Brand */}
          <Link to="/" className="flex shrink-0 items-center">
            <Logo height={42} />
          </Link>

          {/* Prominent search — shown on every page except home (the hero has its own) */}
          <div className="hidden flex-1 lg:block">
            {!isHome && <div className="max-w-md"><GlobalSearch variant="header" /></div>}
          </div>

          {/* Desktop nav */}
          <nav className="ml-auto hidden items-center gap-1 md:flex" onMouseLeave={() => setMenu(null)}>
            {/* Catalog (its own menu with a sub-menu) */}
            <div className="relative" onMouseEnter={() => setMenu("catalog")}>
              <button className={navTrigger(menu === "catalog")}>
                Catalog <ChevronDown className={clsx("h-4 w-4 transition", menu === "catalog" && "rotate-180")} />
              </button>
              {menu === "catalog" && (
                <div className="absolute left-0 top-full w-[340px] pt-2">
                  <div className="card p-3 shadow-pop animate-fade-in">
                    <BrowseLink to="/exchange" icon={<Boxes className="h-5 w-5" />} title="Tests & Services" sub="Instruments, testing & analysis" onClick={() => setMenu(null)} />
                    <BrowseLink to="/exchange?tab=bundles" icon={<ShoppingBag className="h-5 w-5" />} title="Bundles" sub="Lab bundles at a combined discount" onClick={() => setMenu(null)} />
                    <BrowseLink to="/equipment" icon={<Cpu className="h-5 w-5" />} title="Equipment & Machines" sub="Instruments available for rent" onClick={() => setMenu(null)} />
                    <BrowseLink to="/packages" icon={<Package className="h-5 w-5" />} title="Certification Packages" sub="Bundled test programs, priced live" onClick={() => setMenu(null)} />
                    <BrowseLink to="/experts" icon={<UserCog className="h-5 w-5" />} title="Experts & Resources" sub="Specialist manpower" onClick={() => setMenu(null)} />
                  </div>
                </div>
              )}
            </div>

            {/* Technology (its own menu) */}
            <div className="relative" onMouseEnter={() => setMenu("tech")}>
              <button className={navTrigger(menu === "tech")}>
                Technology <ChevronDown className={clsx("h-4 w-4 transition", menu === "tech" && "rotate-180")} />
              </button>
              {menu === "tech" && (
                <div className="absolute left-0 top-full w-[560px] pt-2">
                  <div className="card p-3 shadow-pop animate-fade-in">
                    {techs.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-ink-muted">No technologies listed yet.</p>
                    ) : (
                      <div className="grid max-h-80 grid-cols-2 gap-1 overflow-auto">
                        {techs.map((t) => {
                          const TechIcon = iconFor(t.icon);
                          return (
                            <Link key={t.slug} to={techHref(t.slug)} onClick={() => setMenu(null)}
                              className="flex items-start gap-3 rounded-lg p-3 hover:bg-surface-muted transition">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><TechIcon className="h-5 w-5" /></span>
                              <span>
                                <span className="block text-sm font-semibold text-ink">{t.title}</span>
                                {t.blurb && <span className="block text-xs text-ink-muted line-clamp-1">{t.blurb}</span>}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Industries */}
            <div className="relative" onMouseEnter={() => setMenu("ind")}>
              <button className={navTrigger(menu === "ind")}>
                Industries <ChevronDown className={clsx("h-4 w-4 transition", menu === "ind" && "rotate-180")} />
              </button>
              {menu === "ind" && (
                <div className="absolute left-0 top-full w-[560px] pt-2">
                  <div className="card p-3 shadow-pop animate-fade-in">
                    <div className="grid grid-cols-2 gap-1">
                      {INDUSTRIES.map((ind) => (
                        <Link key={ind.title} to={indHref(ind.slug)} onClick={() => setMenu(null)}
                          className="flex items-start gap-3 rounded-lg p-3 hover:bg-surface-muted transition">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><ind.icon className="h-5 w-5" /></span>
                          <span>
                            <span className="block text-sm font-semibold text-ink">{ind.title}</span>
                            <span className="block text-xs text-ink-muted">{ind.blurb}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <NavLink to="/providers" onMouseEnter={() => setMenu(null)} className={({ isActive }) =>
              clsx("rounded-lg px-3 py-2 text-[15px] font-semibold transition", isActive ? "text-brand-600" : "text-ink hover:text-brand-600")}>
              Labs
            </NavLink>

            <NavLink to="/events" onMouseEnter={() => setMenu(null)} className={({ isActive }) =>
              clsx("rounded-lg px-3 py-2 text-[15px] font-semibold transition", isActive ? "text-brand-600" : "text-ink hover:text-brand-600")}>
              Events
            </NavLink>

            <div className="mx-2 h-5 w-px bg-surface-border" />
            {user ? (
              <div className="flex items-center gap-2">
                {isBuyerUser && (
                  <Link to="/cart" onMouseEnter={() => setMenu(null)} aria-label="Cart"
                    className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition hover:bg-surface-muted hover:text-brand-600">
                    <ShoppingCart className="h-5 w-5" />
                    {cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">{cartCount}</span>}
                  </Link>
                )}
                <Link to={dashHome!} className="btn-primary btn-sm" onMouseEnter={() => setMenu(null)}>Dashboard</Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <NavLink to="/login" onMouseEnter={() => setMenu(null)} className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink">Login</NavLink>
                <div className="relative" onMouseEnter={() => setMenu("signup")}>
                  <button className="btn-primary btn-sm">
                    Sign up <ChevronDown className={clsx("h-4 w-4 transition", menu === "signup" && "rotate-180")} />
                  </button>
                  {menu === "signup" && (
                    <div className="absolute right-0 top-full w-72 pt-2">
                      <div className="card p-2 shadow-pop animate-fade-in">
                        <Link to="/register" onClick={() => setMenu(null)} className="flex items-start gap-3 rounded-lg p-3 hover:bg-surface-muted transition">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><ShoppingBag className="h-5 w-5" /></span>
                          <span><span className="block text-sm font-semibold text-ink">As a buyer</span><span className="block text-xs text-ink-muted">Procure testing, analysis &amp; experts</span></span>
                        </Link>
                        <Link to="/register-provider" onClick={() => setMenu(null)} className="flex items-start gap-3 rounded-lg p-3 hover:bg-surface-muted transition">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Building2 className="h-5 w-5" /></span>
                          <span><span className="block text-sm font-semibold text-ink">As a provider</span><span className="block text-xs text-ink-muted">List your facility on the network</span></span>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </nav>

          <button onClick={() => setMobileOpen((o) => !o)} className="md:hidden text-ink-soft">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-surface-border bg-white px-4 py-3 md:hidden">
            <div className="mb-3"><GlobalSearch variant="header" /></div>
            <MobileSection title="Technologies" open={mobileSection === "tech"} onToggle={() => setMobileSection((s) => s === "tech" ? null : "tech")}>
              {techs.map((t) => (
                <Link key={t.slug} to={techHref(t.slug)} onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-surface-muted">{t.title}</Link>
              ))}
            </MobileSection>
            <MobileSection title="Industries" open={mobileSection === "ind"} onToggle={() => setMobileSection((s) => s === "ind" ? null : "ind")}>
              {INDUSTRIES.map((ind) => (
                <Link key={ind.title} to={indHref(ind.slug)} onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-surface-muted">{ind.title}</Link>
              ))}
            </MobileSection>
            <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Catalog</p>
            <Link to="/exchange" onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-surface-muted">Services &amp; Testing</Link>
            <Link to="/exchange?tab=bundles" onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-surface-muted">Bundles</Link>
            <Link to="/equipment" onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-surface-muted">Equipment &amp; Machines</Link>
            <Link to="/packages" onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-surface-muted">Certification Packages</Link>
            <Link to="/experts" onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-surface-muted">Skilled Resources</Link>
            <Link to="/providers" onClick={() => setMobileOpen(false)} className="mt-1 block px-3 py-2.5 text-sm font-medium text-ink">Labs</Link>
            <Link to="/events" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-ink">Events</Link>
            <div className="mt-2 flex flex-col gap-2 border-t border-surface-border pt-3">
              {user ? (
                <>
                  {isBuyerUser && <Link to="/cart" onClick={() => setMobileOpen(false)} className="btn-secondary btn-sm inline-flex items-center justify-center gap-2"><ShoppingCart className="h-4 w-4" /> Cart{cartCount > 0 ? ` (${cartCount})` : ""}</Link>}
                  <Link to={dashHome!} className="btn-primary btn-sm" onClick={() => setMobileOpen(false)}>Dashboard</Link>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMobileOpen(false)} className="btn-secondary btn-sm">Login</Link>
                  <Link to="/register" onClick={() => setMobileOpen(false)} className="btn-primary btn-sm">Sign up as buyer</Link>
                  <Link to="/register-provider" onClick={() => setMobileOpen(false)} className="btn-secondary btn-sm">List your facility (provider)</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1"><Outlet /></main>

      <footer className="border-t border-surface-border bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div className="lg:col-span-1">
            <Logo height={32} />
            <p className="mt-3 text-sm text-ink-muted">{config.tagline}</p>
            <div className="mt-4 space-y-2 text-sm">
              <a href="mailto:info@adart.in" className="flex items-center gap-2 text-ink-muted hover:text-ink"><Mail className="h-4 w-4 text-ink-faint" /> info@adart.in</a>
              <Link to="/register-provider" className="flex items-center gap-2 text-ink-muted hover:text-ink"><Building2 className="h-4 w-4 text-ink-faint" /> List your facility</Link>
              <Link to="/exchange" className="flex items-center gap-2 text-ink-muted hover:text-ink"><LifeBuoy className="h-4 w-4 text-ink-faint" /> Talk to an expert</Link>
            </div>
          </div>
          <FooterCol title="Technologies" items={techs.map((t) => ({ label: t.title, to: techHref(t.slug) }))} />
          <FooterCol title="Industries" items={INDUSTRIES.slice(0, 6).map((i) => ({ label: i.title, to: indHref(i.slug) }))} />
          <FooterCol title="Platform" items={[{ label: "Exchange", to: "/exchange" }, { label: "Sign up (buyer)", to: "/register" }, { label: "List a facility", to: "/register-provider" }, { label: "Sign in", to: "/login" }]} />
        </div>
        <div className="border-t border-surface-border">
          <div className="mx-auto max-w-7xl px-4 py-5 text-xs text-ink-faint sm:px-6 lg:px-8">
            <p>© {new Date().getFullYear()} {config.platformName}. {config.tagline}</p>
            <p className="mt-1">
              Facility imagery: ISRO / Department of Space (GODL-India); HAL Tejas by Rahuldevnath (CC BY 3.0).
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function MobileSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-b border-surface-border last:border-0">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium text-ink">
        {title} <ChevronDown className={clsx("h-4 w-4 transition", open && "rotate-180")} />
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

function BrowseLink({ to, icon, title, sub, onClick }: { to: string; icon: React.ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <Link to={to} onClick={onClick} className="flex items-start gap-3 rounded-lg p-3 transition hover:bg-surface-muted">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{icon}</span>
      <span><span className="block text-sm font-semibold text-ink">{title}</span><span className="block text-xs text-ink-muted">{sub}</span></span>
    </Link>
  );
}

function FooterCol({ title, items }: { title: string; items: { label: string; to: string }[] }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{title}</h4>
      <ul className="mt-3 space-y-2">
        {items.map((it) => (
          <li key={it.label}><Link to={it.to} className="text-sm text-ink-muted hover:text-ink">{it.label}</Link></li>
        ))}
      </ul>
    </div>
  );
}
