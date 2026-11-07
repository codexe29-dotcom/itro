import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Plus, Trash2, Pencil, ExternalLink, ShieldCheck, AlertTriangle, X } from "lucide-react";
import { fetchLabAccreditations, createAccreditation, updateAccreditation, deleteAccreditation, type AccreditationInput } from "@/lib/queries";
import type { AccreditationRecord } from "@/lib/types";
import { Field, Input, Button, LoadingBlock, useToast } from "@/components/ui";

function styleFor(s: AccreditationRecord["status"]) {
  switch (s) {
    case "EXPIRED": return "bg-surface-muted text-ink-soft";
    case "EXPIRING": return "bg-orange-50 text-orange-700";
    default: return "bg-brand-50 text-brand-700";
  }
}
const STATUS_LABEL = { ACTIVE: "Active", EXPIRING: "Expiring soon", EXPIRED: "Expired", UNKNOWN: "On file" };
const toDateInput = (iso?: string | null) => (iso ? iso.slice(0, 10) : "");
const toIso = (d: string) => (d ? new Date(d + "T00:00:00.000Z").toISOString() : null);

interface Draft { id?: string; body: string; certNumber: string; scope: string; issuedAt: string; expiresAt: string; verifyUrl: string; }
const emptyDraft: Draft = { body: "", certNumber: "", scope: "", issuedAt: "", expiresAt: "", verifyUrl: "" };

export default function AccreditationManager({ institutionId }: { institutionId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: records, isLoading } = useQuery({
    queryKey: ["lab-accreditations", institutionId],
    queryFn: () => fetchLabAccreditations(institutionId),
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["lab-accreditations", institutionId] });
    qc.invalidateQueries({ queryKey: ["institution"] });
    qc.invalidateQueries({ queryKey: ["providers"] });
  };

  const save = useMutation({
    mutationFn: (d: Draft) => {
      const body: AccreditationInput = {
        body: d.body.trim(),
        certNumber: d.certNumber.trim() || null,
        scope: d.scope.split(",").map((s) => s.trim()).filter(Boolean),
        issuedAt: toIso(d.issuedAt),
        expiresAt: toIso(d.expiresAt),
        verifyUrl: d.verifyUrl.trim() || null,
      };
      return d.id ? updateAccreditation(d.id, body) : createAccreditation(institutionId, body);
    },
    onSuccess: () => { toast.push("success", "Accreditation saved."); setDraft(null); invalidate(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not save."),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteAccreditation(id),
    onSuccess: () => { toast.push("success", "Removed."); invalidate(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not remove."),
  });

  const editFrom = (r: AccreditationRecord): Draft => ({
    id: r.id, body: r.body, certNumber: r.certNumber ?? "", scope: (r.scope ?? []).join(", "),
    issuedAt: toDateInput(r.issuedAt), expiresAt: toDateInput(r.expiresAt), verifyUrl: r.verifyUrl ?? "",
  });

  if (isLoading) return <LoadingBlock />;

  return (
    <div className="space-y-3">
      {(records ?? []).length === 0 && !draft && <p className="text-sm text-ink-muted">No accreditation certificates yet. Add one so buyers can see and verify your scope.</p>}

      {(records ?? []).map((r) => (
        <div key={r.id} className="rounded-lg border border-surface-border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-ink">{r.body}</span>
              <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", styleFor(r.status))}>
                {r.status === "EXPIRED" || r.status === "EXPIRING" ? <AlertTriangle className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                {STATUS_LABEL[r.status]}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-1.5 text-ink-faint hover:text-brand-600" onClick={() => setDraft(editFrom(r))} aria-label="Edit"><Pencil className="h-4 w-4" /></button>
              <button className="p-1.5 text-ink-faint hover:text-danger" onClick={() => remove.mutate(r.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
            {r.certNumber && <span>Cert no. {r.certNumber}</span>}
            {r.expiresAt && <span>Valid till {new Date(r.expiresAt).toLocaleDateString()}</span>}
            {r.verifyUrl && <a href={r.verifyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">Verify <ExternalLink className="h-3 w-3" /></a>}
          </div>
          {r.scope.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{r.scope.map((s) => <span key={s} className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] text-ink-muted">{s}</span>)}</div>}
        </div>
      ))}

      {draft ? (
        <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold text-ink">{draft.id ? "Edit accreditation" : "New accreditation"}</p>
            <button className="text-ink-faint hover:text-ink" onClick={() => setDraft(null)}><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Accrediting body"><Input value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="NABL / ISO 17025 / BIS" /></Field>
            <Field label="Certificate number"><Input value={draft.certNumber} onChange={(e) => setDraft({ ...draft, certNumber: e.target.value })} placeholder="TC-xxxx" /></Field>
            <Field label="Issued on"><Input type="date" value={draft.issuedAt} onChange={(e) => setDraft({ ...draft, issuedAt: e.target.value })} /></Field>
            <Field label="Valid till"><Input type="date" value={draft.expiresAt} onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })} /></Field>
          </div>
          <Field label="Scope (comma-separated disciplines/tests)"><Input value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value })} placeholder="Mechanical, Chemical, EMI/EMC" /></Field>
          <Field label="Verification URL" hint="Public page on the issuing body's site"><Input value={draft.verifyUrl} onChange={(e) => setDraft({ ...draft, verifyUrl: e.target.value })} placeholder="https://nablwp.qci.org.in/…" /></Field>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button>
            <Button loading={save.isPending} disabled={!draft.body.trim()} onClick={() => save.mutate(draft)}>{draft.id ? "Save" : "Add accreditation"}</Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" className="btn-sm" onClick={() => setDraft({ ...emptyDraft })}><Plus className="h-3.5 w-3.5" /> Add accreditation</Button>
      )}
    </div>
  );
}
