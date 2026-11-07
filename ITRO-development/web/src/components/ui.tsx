import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, createContext, useContext, useState, useCallback, forwardRef } from "react";
import clsx from "clsx";
import { Loader2, X, Inbox, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { statusTone } from "@/lib/format";

/* ---------- Button ---------- */
type Variant = "primary" | "secondary" | "ghost" | "danger";
export function Button({ variant = "primary", loading, className, children, ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  const cls = { primary: "btn-primary", secondary: "btn-secondary", ghost: "btn-ghost", danger: "btn-danger" }[variant];
  return (
    <button className={clsx(cls, className)} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />} {children}
    </button>
  );
}

/* ---------- Card ---------- */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("card", className)}>{children}</div>;
}
export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("card-pad", className)}>{children}</div>;
}

/* ---------- Badge / Status ---------- */
const TONE: Record<string, string> = {
  gray: "badge-gray", brand: "badge-brand", success: "badge-success",
  warning: "badge-warning", danger: "badge-danger", info: "badge-info",
};
export function Badge({ tone = "gray", children }: { tone?: keyof typeof TONE; children: ReactNode }) {
  return <span className={TONE[tone]}>{children}</span>;
}
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className={TONE[statusTone(status)]}>{label ?? status}</span>;
}

/* ---------- Inputs ---------- */
export function Field({ label, error, hint, children }:
  { label?: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
// forwardRef so react-hook-form's register() ref attaches to the real element.
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={clsx("input", className)} {...props} />
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={clsx("input", className)} {...props} />
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => <select ref={ref} className={clsx("input", className)} {...props}>{children}</select>
);
Select.displayName = "Select";

/* ---------- Page header ---------- */
export function PageHeader({ title, subtitle, actions }:
  { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-ink tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-ink-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- Stat card ---------- */
export function StatCard({ label, value, icon, trend }:
  { label: string; value: ReactNode; icon?: ReactNode; trend?: string }) {
  return (
    <Card>
      <div className="p-5 flex items-start justify-between">
        <div>
          <p className="text-sm text-ink-muted">{label}</p>
          <p className="stat-value mt-1">{value}</p>
          {trend && <p className="text-xs text-success mt-1">{trend}</p>}
        </div>
        {icon && <div className="rounded-lg bg-brand-50 p-2.5 text-brand-600">{icon}</div>}
      </div>
    </Card>
  );
}

/* ---------- States ---------- */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx("h-5 w-5 animate-spin text-brand-500", className)} />;
}
export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-ink-muted"><Spinner /> {label}</div>;
}
export function EmptyState({ title, description, action, icon }:
  { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-surface-muted p-4 text-ink-faint mb-4">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <h3 className="font-semibold text-ink">{title}</h3>
      {description && <p className="text-sm text-ink-muted mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function ErrorState({ error }: { error?: unknown }) {
  const msg = (error as any)?.response?.data?.message || (error as any)?.message || "Something went wrong.";
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="h-6 w-6 text-danger mb-2" />
      <p className="text-sm text-ink-soft">{msg}</p>
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, footer, wide }:
  { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx("relative card animate-fade-in w-full", wide ? "max-w-2xl" : "max-w-md")}>
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
          <h3 className="font-semibold text-ink">{title}</h3>
          <button onClick={onClose} className="text-ink-faint hover:text-ink"><X className="h-5 w-5" /></button>
        </div>
        <div className="card-pad max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-surface-border px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Toasts ---------- */
type Toast = { id: number; kind: "success" | "error" | "info"; message: string };
const ToastCtx = createContext<{ push: (kind: Toast["kind"], message: string) => void } | undefined>(undefined);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  const icon = { success: <CheckCircle2 className="h-4 w-4" />, error: <AlertCircle className="h-4 w-4" />, info: <Info className="h-4 w-4" /> };
  const tone = { success: "border-success text-success", error: "border-danger text-danger", info: "border-info text-info" };
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={clsx("card flex items-center gap-2 px-4 py-3 text-sm border-l-4 animate-fade-in", tone[t.kind])}>
            {icon[t.kind]} <span className="text-ink-soft">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast within ToastProvider");
  return ctx;
}

/* ---------- Table primitives ---------- */
export function Table({ children }: { children: ReactNode }) {
  return <div className="table-wrap"><table className="w-full">{children}</table></div>;
}
