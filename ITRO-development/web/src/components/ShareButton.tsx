import { useState } from "react";
import { Share2, Copy, Check, X } from "lucide-react";
import clsx from "clsx";
import { useToast } from "@/components/ui";

/**
 * Shareable "microsite" control — copy link, scan a QR, or use the native share
 * sheet. Turns any lab / facility / event page into something a provider can promote.
 */
export default function ShareButton({ url, title, className }: { url?: string; title?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=190x190&margin=8&data=${encodeURIComponent(shareUrl)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.push("success", "Link copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.push("error", "Could not copy the link.");
    }
  }

  async function nativeShare() {
    if (navigator.share) {
      try { await navigator.share({ title: title ?? "ITRO", url: shareUrl }); } catch { /* dismissed */ }
    } else {
      copy();
    }
  }

  return (
    <div className={clsx("relative inline-block", className)}>
      <button onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-white px-3 py-2 text-sm font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-700">
        <Share2 className="h-4 w-4" /> Share
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-surface-border bg-white p-4 shadow-pop">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Share this page</p>
              <button onClick={() => setOpen(false)} className="rounded p-0.5 text-ink-faint hover:text-ink"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex justify-center rounded-lg border border-surface-border bg-surface-subtle p-3">
              <img src={qr} alt="QR code" width={150} height={150} className="rounded" />
            </div>
            <p className="mt-2 text-center text-xs text-ink-muted">Scan to open on a phone</p>
            <div className="mt-3 flex items-center gap-2">
              <input readOnly value={shareUrl} className="min-w-0 flex-1 truncate rounded-lg border border-surface-border bg-surface-subtle px-2 py-1.5 text-xs text-ink-soft" />
              <button onClick={copy} className="inline-flex items-center gap-1 rounded-lg border border-surface-border px-2 py-1.5 text-xs font-medium text-ink-soft hover:border-brand-300 hover:text-brand-700">
                {copied ? <Check className="h-3.5 w-3.5 text-brand-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button onClick={nativeShare} className="mt-2 w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
                Share…
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
