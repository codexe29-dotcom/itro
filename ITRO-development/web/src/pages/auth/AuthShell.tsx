import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";

export default function AuthShell({
  title, subtitle, children, footer,
}: {
  title: string; subtitle?: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-full items-center justify-center bg-surface-subtle px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center">
          <Logo height={44} />
        </Link>
        <div className="card p-6 sm:p-8 animate-fade-in">
          <h1 className="text-xl font-bold text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-ink-muted">{footer}</div>}
      </div>
    </div>
  );
}
