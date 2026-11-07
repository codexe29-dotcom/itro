import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, CalendarDays, Users, Eye, EyeOff } from "lucide-react";
import { fetchManagedEvents, createEvent, updateEvent, deleteEvent, fetchEventRegistrations, fetchFacilities } from "@/lib/queries";
import { uploadFile } from "@/lib/api";
import type { EventItem } from "@/lib/types";
import { dateTime } from "@/lib/format";
import {
  PageHeader, Card, CardBody, Table, Button, Modal, Field, Input, Textarea, Select,
  LoadingBlock, EmptyState, ErrorState, useToast, Badge,
} from "@/components/ui";

const TYPES = ["WORKSHOP", "WEBINAR", "TRAINING", "OPEN_DAY", "CONFERENCE"];
const TYPE_LABEL: Record<string, string> = { WORKSHOP: "Workshop", WEBINAR: "Webinar", TRAINING: "Training", OPEN_DAY: "Open day", CONFERENCE: "Conference" };
const MODES = ["IN_PERSON", "ONLINE", "HYBRID"];
const MODE_LABEL: Record<string, string> = { IN_PERSON: "In person", ONLINE: "Online", HYBRID: "Hybrid" };

interface FormState {
  title: string; type: string; mode: string; description: string;
  location: string; onlineUrl: string; imageUrl: string;
  startAt: string; endAt: string; capacity: string; price: string;
  facilityId: string; isPublished: boolean;
}
const EMPTY: FormState = {
  title: "", type: "WORKSHOP", mode: "IN_PERSON", description: "",
  location: "", onlineUrl: "", imageUrl: "", startAt: "", endAt: "", capacity: "", price: "",
  facilityId: "", isPublished: true,
};

// datetime-local <-> ISO helpers (local wall-clock).
function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const toISO = (local: string) => (local ? new Date(local).toISOString() : null);

export default function AdminEvents() {
  const qc = useQueryClient();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [confirm, setConfirm] = useState<EventItem | null>(null);
  const [regsFor, setRegsFor] = useState<EventItem | null>(null);

  const { data, isLoading, isError, error } = useQuery({ queryKey: ["managed-events"], queryFn: fetchManagedEvents });
  const facilitiesQ = useQuery({ queryKey: ["facilities"], queryFn: fetchFacilities });
  const events = data ?? [];
  const facilities = facilitiesQ.data ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["managed-events"] });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title,
        type: form.type, mode: form.mode,
        description: form.description || undefined,
        location: form.location || undefined,
        onlineUrl: form.onlineUrl || undefined,
        imageUrl: form.imageUrl || undefined,
        startAt: toISO(form.startAt),
        endAt: form.endAt ? toISO(form.endAt) : null,
        capacity: form.capacity ? Number(form.capacity) : null,
        price: Number(form.price) || 0,
        facilityId: form.facilityId || null,
        isPublished: form.isPublished,
      };
      return editing ? updateEvent(editing.id, body) : createEvent(body);
    },
    onSuccess: () => { toast.push("success", editing ? "Event updated." : "Event created."); setModalOpen(false); invalidate(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not save event."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => { toast.push("success", "Event deleted."); setConfirm(null); invalidate(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not delete."),
  });

  function openCreate() { setEditing(null); setForm(EMPTY); setModalOpen(true); }
  function openEdit(ev: EventItem) {
    setEditing(ev);
    setForm({
      title: ev.title, type: ev.type, mode: ev.mode, description: ev.description || "",
      location: ev.location || "", onlineUrl: ev.onlineUrl || "", imageUrl: ev.imageUrl || "",
      startAt: toLocalInput(ev.startAt), endAt: toLocalInput(ev.endAt),
      capacity: ev.capacity != null ? String(ev.capacity) : "", price: String(ev.price ?? 0),
      facilityId: ev.facilityId || "", isPublished: ev.isPublished,
    });
    setModalOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Events & workshops"
        subtitle="Host workshops, webinars, training and open days — buyers can register."
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add event</Button>}
      />

      <Card>
        {isLoading ? <LoadingBlock /> : isError ? <ErrorState error={error} /> : events.length === 0 ? (
          <CardBody>
            <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="No events yet"
              description="Create a workshop or webinar to engage buyers and the community."
              action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add event</Button>} />
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="th">Title</th>
                <th className="th">Type</th>
                <th className="th">When</th>
                <th className="th text-right">Registered</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="hover:bg-surface-subtle">
                  <td className="td font-medium text-ink">{ev.title}</td>
                  <td className="td">{TYPE_LABEL[ev.type] ?? ev.type}</td>
                  <td className="td whitespace-nowrap">{dateTime(ev.startAt)}</td>
                  <td className="td text-right">
                    <button onClick={() => setRegsFor(ev)} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                      <Users className="h-3.5 w-3.5" /> {ev.registeredCount ?? 0}{ev.capacity != null ? ` / ${ev.capacity}` : ""}
                    </button>
                  </td>
                  <td className="td">{ev.isPublished ? <Badge tone="success">Published</Badge> : <Badge tone="gray">Draft</Badge>}</td>
                  <td className="td">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" className="btn-sm" onClick={() => openEdit(ev)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" className="btn-sm text-danger" onClick={() => setConfirm(ev)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* Create / edit */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit event" : "Add event"}
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button loading={save.isPending} disabled={!form.title.trim() || !form.startAt} onClick={() => save.mutate()}>{editing ? "Save changes" : "Create"}</Button>
        </>}>
        <div className="space-y-4">
          <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Hands-on SEM workshop" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type"><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</Select></Field>
            <Field label="Mode"><Select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>{MODES.map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}</Select></Field>
          </div>
          <Field label="Description" hint="Optional"><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts"><Input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} /></Field>
            <Field label="Ends" hint="Optional"><Input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} /></Field>
          </div>
          {form.mode !== "ONLINE" && <Field label="Location" hint="Venue / address"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Main auditorium, Block A" /></Field>}
          {form.mode !== "IN_PERSON" && <Field label="Online link" hint="Meeting / webinar URL"><Input value={form.onlineUrl} onChange={(e) => setForm({ ...form, onlineUrl: e.target.value })} placeholder="https://…" /></Field>}
          <Field label="Host lab / facility" hint="Optional"><Select value={form.facilityId} onChange={(e) => setForm({ ...form, facilityId: e.target.value })}>
            <option value="">Institution-wide</option>
            {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </Select></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Capacity" hint="Blank = unlimited"><Input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="30" /></Field>
            <Field label="Price (₹)" hint="0 = free"><Input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" /></Field>
          </div>
          <Field label="Cover image" hint="Optional">
            <div className="flex items-center gap-3">
              {form.imageUrl && <img src={form.imageUrl} alt="" className="h-12 w-16 rounded object-cover" />}
              <label className="btn-secondary btn-sm cursor-pointer">
                {form.imageUrl ? "Replace" : "Upload"}
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  try { const { url } = await uploadFile(file); setForm((s) => ({ ...s, imageUrl: url })); toast.push("success", "Image uploaded."); }
                  catch { toast.push("error", "Upload failed."); }
                }} />
              </label>
              {form.imageUrl && <button type="button" className="text-xs text-ink-faint hover:text-danger" onClick={() => setForm({ ...form, imageUrl: "" })}>Remove</button>}
            </div>
          </Field>
          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-surface-border px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm font-medium text-ink-soft">
              {form.isPublished ? <Eye className="h-4 w-4 text-brand-600" /> : <EyeOff className="h-4 w-4 text-ink-faint" />} Published (visible publicly)
            </span>
            <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} className="h-4 w-4 accent-brand-600" />
          </label>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Delete event"
        footer={<>
          <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant="danger" loading={remove.isPending} onClick={() => confirm && remove.mutate(confirm.id)}>Delete</Button>
        </>}>
        <p className="text-sm text-ink-soft">Delete <span className="font-semibold">{confirm?.title}</span>? Registrations will be removed too.</p>
      </Modal>

      {/* Registrations */}
      <RegistrationsModal event={regsFor} onClose={() => setRegsFor(null)} />
    </div>
  );
}

function RegistrationsModal({ event, onClose }: { event: EventItem | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["event-regs", event?.id],
    queryFn: () => fetchEventRegistrations(event!.id),
    enabled: !!event,
  });
  return (
    <Modal open={!!event} onClose={onClose} title={`Registrations — ${event?.title ?? ""}`}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {isLoading ? <LoadingBlock /> : !data || data.length === 0 ? (
        <p className="text-sm text-ink-muted">No registrations yet.</p>
      ) : (
        <ul className="divide-y divide-surface-border">
          {data.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2 text-sm">
              <span className="font-medium text-ink">{r.user?.name || r.name || "Attendee"}{r.user?.orgName ? ` · ${r.user.orgName}` : ""}</span>
              <span className="text-ink-muted">{r.user?.email || r.email}</span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
