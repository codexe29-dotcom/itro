import { NavLink, Link } from "react-router-dom";
import clsx from "clsx";
import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Logo } from "@/components/Logo";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}
export interface NavGroup {
  title?: string;
  items: NavItem[];
}

function Brand({ home }: { home: string }) {
  return (
    <Link to={home} className="flex items-center px-2">
      <Logo height={30} />
    </Link>
  );
}

export default function Sidebar({
  groups, home, open, onClose, footer,
}: {
  groups: NavGroup[];
  home: string;
  open: boolean;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  const nav = (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      <div className="flex h-10 items-center justify-between">
        <Brand home={home} />
        <button onClick={onClose} className="lg:hidden text-ink-faint hover:text-ink">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-6">
        {groups.map((g, i) => (
          <div key={i}>
            {g.title && (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                {g.title}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {g.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    clsx("nav-link", isActive && "nav-link-active")
                  }
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>
      {footer && <div className="border-t border-surface-border pt-3">{footer}</div>}
    </nav>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-surface-border bg-white lg:block">
        {nav}
      </aside>
      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-surface-border bg-white animate-fade-in">
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
