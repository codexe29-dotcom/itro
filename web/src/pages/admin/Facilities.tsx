import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Building2, CalendarOff } from "lucide-react";
import { fetchFacilities, addHoliday, removeHoliday } from "@/lib/queries";
import { post, patch, del, uploadFile } from "@/lib/api";
import type { Facility, OpeningHours, WeekdayKey, DayHours } from "@/lib/types";
import { dateShort } from "@/lib/format";
import {
  PageHeader, Card, CardBody, Table, Button, Modal,
  Field, Input, Textarea, LoadingBlock, EmptyState, ErrorState, useToast,
} from "@/components/ui";

const WEEKDAYS: { key: WeekdayKey; label: string }[] = [
  { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

const DEFAULT_HOURS: OpeningHours = {
  mon: { open: "09:00", close: "18:00" }, tue: { open: "09:00", close: "18:00" },
  wed: { open: "09:00", close: "18:00" }, thu: { open: "09:00", close: "18:00" },
  fri: { open: "09:00", close: "18:00" }, sat: { open: "09:00", close: "13:00" }, sun: null,
};

interface FormState {
  name: string; department: string; description: string; location: string;
  inchargeName: string; contactEmail: string; contactPhone: string;
  accreditations: string; imageUrl: string;
  timezone: string; hours: OpeningHours;
}
const EMPTY: FormState = {
  name: "", department: "", description: "", location: "",
  inchargeName: "", contactEmail: "", contactPhone: "",
  accreditations: "", imageUrl: "",
  timezone: "Asia/Kolkata", hours: DEFAULT_HOURS,
};

function normalizeHours(h?: OpeningHours | null): OpeningHours {
  const out: OpeningHours = {};
  for (const { key } of WEEKDAYS) out[key] = h?.[key] ?? null;
  return out;
}

export default function AdminFacilities() {
  const qc = useQueryClient();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Facility | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [confirm, setConfirm] = useState<Facility | null>(null);

  // Holiday inputs (only when editing an existing facility).
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["facilities"],
    queryFn: fetchFacilities,
  });
  const facilities = data ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["facilities"] });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        department: form.department || undefined,
        description: form.description || undefined,
        location: form.location || undefined,
        inchargeName: form.inchargeName || undefined,
        contactEmail: form.contactEmail || undefined,
        contactPhone: form.contactPhone || undefined,
        accreditations: form.accreditations.split(",").map((s) => s.trim()).filter(Boolean),
        imageUrl: form.imageUrl || undefined,
        timezone: form.timezone || undefined,
        openingHours: form.hours,
      };
      return editing ? patch(`/facilities/${editing.id}`, body) : post("/facilities", body);
    },
    onSuccess: () => {
      toast.push("success", editing ? "Facility updated." : "Facility created.");
      setModalOpen(false); invalidate();
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not save facility."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del(`/facilities/${id}`),
    onSuccess: () => { toast.push("success", "Facility deleted."); setConfirm(null); invalidate(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not delete."),
  });

  const addHol = useMutation({
    mutationFn: () => addHoliday(editing!.id, { date: new Date(holidayDate).toISOString(), name: holidayName.trim() || undefined }),
    onSuccess: async () => {
      toast.push("success", "Holiday added.");
      setHolidayDate(""); setHolidayName("");
      await invalidate();
      // Keep the edited facility's holiday list fresh in the modal.
      refreshEditing();
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not add holiday."),
  });
  const removeHol = useMutation({
    mutationFn: (hid: string) => removeHoliday(editing!.id, hid),
    onSuccess: async () => { toast.push("success", "Holiday removed."); await invalidate(); refreshEditing(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not remove holiday."),
  });

  async function refreshEditing() {
    const fresh = await fetchFacilities();
    const match = fresh.find((f) => f.id === editing?.id);
    if (match) setEditing(match);
  }

  function openCreate() {
    setEditing(null); setForm(EMPTY); setHolidayDate(""); setHolidayName(""); setModalOpen(true);
  }
  function openEdit(f: Facility) {
    setEditing(f);
    setForm({
      name: f.name, department: f.department || "", description: f.description || "", location: f.location || "",
      inchargeName: f.inchargeName || "", contactEmail: f.contactEmail || "", contactPhone: f.contactPhone || "",
      accreditations: (f.accreditations ?? []).join(", "), imageUrl: f.imageUrl || "",
      timezone: f.timezone || "Asia/Kolkata", hours: normalizeHours(f.openingHours),
    });
    setHolidayDate(""); setHolidayName("");
    setModalOpen(true);
  }

  function setDayOpen(key: WeekdayKey, open: boolean) {
    setForm((s) => ({
      ...s,
      hours: { ...s.hours, [key]: open ? (s.hours[key] ?? { open: "09:00", close: "18:00" }) : null },
    }));
  }
  function setDayField(key: WeekdayKey, field: keyof DayHours, value: string) {
    setForm((s) => {
      const cur = s.hours[key] ?? { open: "09:00", close: "18:00" };
      return { ...s, hours: { ...s.hours, [key]: { ...cur, [field]: value } } };
    });
  }

  return (
    <div>
      <PageHeader
        title="Facilities"
        subtitle="Labs and departments that house your instruments."
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add facility</Button>}
      />

      <Card>
        {isLoading ? (
          <LoadingBlock />
        ) : isError ? (
          <ErrorState error={error} />
        ) : facilities.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={<Building2 className="h-6 w-6" />}
              title="No facilities yet"
              description="Create a facility to start adding instruments."
              action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add facility</Button>}
            />
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="th">Name</th>
                <th className="th">Department</th>
                <th className="th">Location</th>
                <th className="th">Timezone</th>
                <th className="th text-right">Instruments</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {facilities.map((f) => (
                <tr key={f.id} className="hover:bg-surface-subtle">
                  <td className="td font-medium text-ink">{f.name}</td>
                  <td className="td">{f.department || "-"}</td>
                  <td className="td">{f.location || "-"}</td>
                  <td className="td">{f.timezone || "-"}</td>
                  <td className="td text-right">{f.instruments?.length ?? 0}</td>
                  <td className="td">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" className="btn-sm" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" className="btn-sm text-danger" onClick={() => setConfirm(f)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? "Edit facility" : "Add facility"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={save.isPending} disabled={!form.name.trim()} onClick={() => save.mutate()}>
              {editing ? "Save changes" : "Create"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Central Materials Lab" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Department" hint="Optional">
              <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Materials Science" />
            </Field>
            <Field label="Location" hint="Optional">
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Building A, Floor 2" />
            </Field>
          </div>
          <Field label="Timezone">
            <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} placeholder="Asia/Kolkata" />
          </Field>
          <Field label="Description" hint="Optional">
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>

          {/* Team & contact — a facility is an independently-run lab */}
          <div className="rounded-lg border border-surface-border p-3">
            <p className="mb-2 text-sm font-medium text-ink">Lab team &amp; contact</p>
            <div className="space-y-3">
              <Field label="In-charge" hint="Person / team running this lab">
                <Input value={form.inchargeName} onChange={(e) => setForm({ ...form, inchargeName: e.target.value })} placeholder="Dr. A. Sharma" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Contact email" hint="Optional">
                  <Input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} placeholder="lab@institute.edu" />
                </Field>
                <Field label="Contact phone" hint="Optional">
                  <Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder="+91 …" />
                </Field>
              </div>
              <Field label="Accreditations" hint="Comma-separated, e.g. NABL, ISO 17025">
                <Input value={form.accreditations} onChange={(e) => setForm({ ...form, accreditations: e.target.value })} placeholder="NABL, ISO 17025" />
              </Field>
              <Field label="Lab photo" hint="Shown on the facility page">
                <div className="flex items-center gap-3">
                  {form.imageUrl && <img src={form.imageUrl} alt="" className="h-12 w-16 rounded object-cover" />}
                  <label className="btn-secondary btn-sm cursor-pointer">
                    {form.imageUrl ? "Replace" : "Upload"}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try { const { url } = await uploadFile(file); setForm((s) => ({ ...s, imageUrl: url })); toast.push("success", "Image uploaded."); }
                        catch { toast.push("error", "Upload failed."); }
                      }} />
                  </label>
                  {form.imageUrl && <button type="button" className="text-xs text-ink-faint hover:text-danger" onClick={() => setForm({ ...form, imageUrl: "" })}>Remove</button>}
                </div>
              </Field>
            </div>
          </div>

          {/* Operating hours */}
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Operating hours</p>
            <div className="space-y-1.5 rounded-lg border border-surface-border p-3">
              {WEEKDAYS.map(({ key, label }) => {
                const dh = form.hours[key];
                const open = !!dh;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <label className="flex w-24 items-center gap-2 text-sm text-ink-soft">
                      <input
                        type="checkbox" className="h-4 w-4 rounded border-surface-border"
                        checked={open} onChange={(e) => setDayOpen(key, e.target.checked)}
                      />
                      {label}
                    </label>
                    {open ? (
                      <div className="flex items-center gap-1.5">
                        <Input type="time" className="w-28" value={dh!.open} onChange={(e) => setDayField(key, "open", e.target.value)} />
                        <span className="text-ink-faint">–</span>
                        <Input type="time" className="w-28" value={dh!.close} onChange={(e) => setDayField(key, "close", e.target.value)} />
                      </div>
                    ) : (
                      <span className="text-sm text-ink-faint">Closed</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Holidays - only meaningful for an existing facility */}
          {editing ? (
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
                <CalendarOff className="h-4 w-4 text-brand-600" /> Holidays
              </p>
              <div className="mb-3 flex items-end gap-2 rounded-lg border border-surface-border p-3">
                <div className="flex-1">
                  <Field label="Date">
                    <Input type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} />
                  </Field>
                </div>
                <div className="flex-1">
                  <Field label="Name" hint="Optional">
                    <Input value={holidayName} placeholder="Foundation Day" onChange={(e) => setHolidayName(e.target.value)} />
                  </Field>
                </div>
                <Button variant="secondary" className="btn-sm" loading={addHol.isPending} disabled={!holidayDate} onClick={() => addHol.mutate()}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
              {(editing.holidays ?? []).length === 0 ? (
                <p className="text-sm text-ink-muted">No holidays configured.</p>
              ) : (
                <ul className="space-y-1.5">
                  {(editing.holidays ?? []).map((h) => (
                    <li key={h.id} className="flex items-center justify-between rounded-lg border border-surface-border px-3 py-1.5 text-sm">
                      <span className="text-ink">{dateShort(h.date)}{h.name ? ` · ${h.name}` : ""}</span>
                      <button className="rounded p-1 text-ink-faint hover:text-danger" onClick={() => removeHol.mutate(h.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-xs text-ink-faint">Save the facility first to add holidays.</p>
          )}
        </div>
      </Modal>

      <Modal
        open={!!confirm} onClose={() => setConfirm(null)} title="Delete facility"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => confirm && remove.mutate(confirm.id)}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          Delete <span className="font-semibold">{confirm?.name}</span>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
