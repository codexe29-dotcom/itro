import { Link, useSearchParams } from "react-router-dom";
import { UserCog, ArrowRight, Boxes, FlaskConical, Cpu } from "lucide-react";
import clsx from "clsx";
import ExchangeBrowser from "@/components/ExchangeBrowser";
import BundleBrowser from "@/components/BundleBrowser";
import EquipmentBrowser from "@/components/EquipmentBrowser";
import { useSeo } from "@/lib/useSeo";

type Tab = "services" | "bundles" | "equipment";
const TABS: { key: Tab; label: string; icon: typeof FlaskConical }[] = [
  { key: "services", label: "Test services", icon: FlaskConical },
  { key: "bundles", label: "Bundles & packages", icon: Boxes },
  { key: "equipment", label: "Equipment & machines", icon: Cpu },
];

export default function Catalog({ defaultTab = "services" }: { defaultTab?: Tab }) {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: Tab = (TABS.some((t) => t.key === raw) ? raw : defaultTab) as Tab;

  useSeo({ title: "Catalog | ITRO", description: "Search accredited Indian labs for tests, bundles and equipment for rent.", canonicalPath: "/exchange" });

  function setTab(next: Tab) {
    const p = new URLSearchParams(params);
    p.set("tab", next);
    // Dropping listing-specific filters when switching tabs keeps results sane.
    p.delete("category");
    setParams(p, { replace: true });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Catalog</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Search accredited Indian labs — individual tests &amp; services, discounted bundles, or instruments
          available for rent. Compare price, turnaround and rating, then add to your order.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/packages" className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-white px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-700">
            <Boxes className="h-4 w-4 text-brand-600" /> Certification packages <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link to="/experts" className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-white px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-700">
            <UserCog className="h-4 w-4 text-brand-600" /> Experts &amp; skilled resources <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 inline-flex flex-wrap rounded-xl border border-surface-border bg-white p-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={clsx("inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition",
              tab === t.key ? "bg-brand-600 text-white" : "text-ink-soft hover:text-brand-700")}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "services" && <ExchangeBrowser />}
      {tab === "bundles" && <BundleBrowser />}
      {tab === "equipment" && <EquipmentBrowser />}
    </div>
  );
}
