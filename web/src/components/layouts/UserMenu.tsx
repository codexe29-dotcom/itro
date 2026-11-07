import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";

export default function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!user) return null;
  const org = user.institution?.name || user.orgName;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[44px] items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-muted transition"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
          {initials(user.name)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-semibold leading-tight text-ink">{user.name}</span>
          {org && <span className="block text-xs leading-tight text-ink-muted">{org}</span>}
        </span>
        <ChevronDown className="h-4 w-4 text-ink-faint" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-surface-border bg-white p-1.5 shadow-pop animate-fade-in z-50">
          {logoutError && <p role="alert" className="px-3 py-2 text-xs text-danger">{logoutError}</p>}
          <div className="px-3 py-2">
            <p className="text-sm font-semibold text-ink">{user.name}</p>
            <p className="text-xs text-ink-muted truncate">{user.email}</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              {user.role.replace(/_/g, " ")}
            </p>
          </div>
          <div className="my-1 h-px bg-surface-border" />
          <button
            onClick={async () => {
              setLogoutError(null);
              try {
                await logout();
                setOpen(false);
                navigate("/login");
              } catch (error) {
                console.error("Sign-out request failed.", error);
                setLogoutError("Could not sign out. Please try again.");
              }
            }}
            className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-surface-muted"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
