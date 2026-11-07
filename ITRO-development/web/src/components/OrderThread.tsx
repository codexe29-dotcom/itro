import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Paperclip, Download, Trash2, Send, FileText, Upload } from "lucide-react";
import type { OrderDocument, OrderMessage } from "@/lib/types";
import { uploadOrderDocument, deleteOrderDocument, postOrderMessage } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { Card, CardBody, Button, Badge, Textarea, useToast } from "@/components/ui";

const ROLE_TONE: Record<string, string> = { buyer: "brand", provider: "success", platform: "gray" };

function when(iso: string) {
  try { return format(new Date(iso), "d MMM, HH:mm"); } catch { return ""; }
}

export default function OrderThread({
  lineId, documents, messages, onChanged, title,
}: {
  lineId: string;
  documents: OrderDocument[];
  messages: OrderMessage[];
  onChanged: () => void;
  title?: string;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");

  const upload = useMutation({
    mutationFn: (file: File) => uploadOrderDocument(lineId, file),
    onSuccess: () => { toast.push("success", "Document uploaded."); onChanged(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Upload failed."),
  });
  const removeDoc = useMutation({
    mutationFn: (docId: string) => deleteOrderDocument(lineId, docId),
    onSuccess: () => { toast.push("success", "Document removed."); onChanged(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not remove."),
  });
  const send = useMutation({
    mutationFn: () => postOrderMessage(lineId, body.trim()),
    onSuccess: () => { setBody(""); onChanged(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not send."),
  });

  return (
    <Card>
      <CardBody>
        {title && <h3 className="section-title mb-3">{title}</h3>}

        {/* Documents */}
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink"><Paperclip className="h-4 w-4 text-ink-faint" /> Documents ({documents.length})</p>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
            <Button variant="secondary" className="btn-sm" loading={upload.isPending} onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Upload
            </Button>
          </div>
          {documents.length === 0 ? (
            <p className="rounded-lg border border-dashed border-surface-border px-3 py-4 text-center text-xs text-ink-faint">No documents yet. Upload a spec, PO, report or any supporting file.</p>
          ) : (
            <ul className="divide-y divide-surface-border rounded-lg border border-surface-border">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-3 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-ink-faint" />
                  <div className="min-w-0 flex-1">
                    <a href={d.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-ink hover:text-brand-700">{d.name}</a>
                    <p className="text-xs text-ink-faint">{d.authorName} · <Badge tone={(ROLE_TONE[d.authorRole] ?? "gray") as any}>{d.authorRole}</Badge> · {d.kind.toLowerCase()} · {when(d.createdAt)}</p>
                  </div>
                  <a href={d.url} target="_blank" rel="noreferrer" className="rounded p-1.5 text-ink-muted hover:bg-surface-muted hover:text-brand-600"><Download className="h-4 w-4" /></a>
                  {(d.uploadedById === user?.id || user?.role === "SUPER_ADMIN") && (
                    <button onClick={() => removeDoc.mutate(d.id)} className="rounded p-1.5 text-ink-muted hover:bg-surface-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Messages */}
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">Messages ({messages.length})</p>
          <div className="max-h-80 space-y-3 overflow-auto">
            {messages.length === 0 ? (
              <p className="rounded-lg border border-dashed border-surface-border px-3 py-4 text-center text-xs text-ink-faint">No messages yet. Ask the provider a question or share an update.</p>
            ) : (
              messages.map((m) => {
                const mine = m.userId === user?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${mine ? "bg-brand-600 text-white" : "bg-surface-muted text-ink"}`}>
                      <p className={`mb-0.5 text-[11px] ${mine ? "text-brand-100" : "text-ink-faint"}`}>{m.authorName} · {m.authorRole} · {when(m.createdAt)}</p>
                      <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="mt-3 flex items-end gap-2">
            <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message…"
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) send.mutate(); }} />
            <Button loading={send.isPending} disabled={!body.trim()} onClick={() => send.mutate()}><Send className="h-4 w-4" /></Button>
          </div>
          <p className="mt-1 text-[11px] text-ink-faint">⌘/Ctrl + Enter to send.</p>
        </div>
      </CardBody>
    </Card>
  );
}
