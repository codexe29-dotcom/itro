import { useState } from "react";
import { Menu } from "lucide-react";
import { Outlet } from "react-router-dom";
import Sidebar, { NavGroup } from "./Sidebar";
import UserMenu from "./UserMenu";

/**
 * Shared authenticated-app shell: responsive sidebar + sticky topbar.
 * Each role layout supplies its nav groups, home path, and topbar title.
 */
export default function DashboardShell({
  groups, home, topbarTitle, topbarExtra,
}: {
  groups: NavGroup[];
  home: string;
  topbarTitle?: React.ReactNode;
  topbarExtra?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-full">
      <Sidebar groups={groups} home={home} open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-surface-border bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setOpen(true)}
              className="lg:hidden text-ink-soft hover:text-ink"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 truncate text-sm font-semibold text-ink">{topbarTitle}</div>
          </div>
          <div className="flex items-center gap-2">
            {topbarExtra}
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
