import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Microscope, CalendarClock, Maximize2 } from "lucide-react";
import { fetchInstruments, fetchFacilities, fetchBookings, asList } from "@/lib/queries";
import { post, patch, del } from "@/lib/api";
import type { Instrument, InstrumentStatus, Booking } from "@/lib/types";
import { money } from "@/lib/format";
import { INDUSTRIES } from "@/lib/taxonomy";
import {
  PageHeader, Card, CardBody, Table, Button, Modal, StatusBadge,
  Field, Input, Textarea, Select, LoadingBlock, EmptyState, ErrorState, useToast,
} from "@/components/ui";

const STATUSES: InstrumentStatus[] = ["AVAILABLE", "BOOKED", "MAINTENANCE", "OFFLINE"];
const CERTIFICATIONS = ["", "ISO 17025", "NABL", "ISO 9001"];

interface FormState {
  facilityId: string; name: string; category: string; make: string; model: string;
  hourlyRate: string; trainingRequired: boolean; imageUrl: string; description: string;
  status: InstrumentStatus; accreditation: string; industries: string[];
  netTestHours: string;
  maxLengthMm: string; maxWidthMm: string; maxHeightMm: string; maxWeightKg: string; sampleNotes: string;
}
const EMPTY: FormState = {
  facilityId: "", name: "", category: "", make: "", model: "",
  hourlyRate: "", trainingRequired: false, imageUrl: "", description: "", status: "AVAILABLE",
  accreditation: "", industries: [],
  netTestHours: "", maxLengthMm: "", maxWidthMm: "", maxHeightMm: "", maxWeightKg: "", sampleNotes: "",
};

// Build the sample-envelope JSON from the flat form fields (null when nothing entered).
function buildSampleSpec(f: FormState): Record<string, unknown> | null {
  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
  const spec: Record<string, unknown> = {};
  if (num(f.maxLengthMm) != null) spec.maxLengthMm = num(f.maxLengthMm);
  if (num(f.maxWidthMm) != null) spec.maxWidthMm = num(f.maxWidthMm);
  if (num(f.maxHeightMm) != null) spec.maxHeightMm = num(f.maxHeightMm);
  if (num(f.maxWeightKg) != null) spec.maxWeightKg = num(f.maxWeightKg);
  if (f.sampleNotes.trim()) spec.notes = f.sampleNotes.trim();
  return Object.keys(spec).length ? spec : null;
}

function fmtDateTime(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
function fmtDate(iso?: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

export default function AdminInstruments() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Instrument | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [confirm, setConfirm] = useState<Instrument | null>(null);
  const [schedule, setSchedule] = useState<Instrument | null>(null);
  const [fCategory, setFCategory] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fFacility, setFFacility] = useState("");

  const facilitiesQ = useQuery({ queryKey: ["facilities"], queryFn: fetchFacilities });
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["instruments", { fCategory, fStatus, fFacility }],
    queryFn: () => fetchInstruments({
      category: fCategory || undefined,
      status: fStatus || undefined,
      facilityId: fFacility || undefined,
    }),
  });
  const instruments = data ?? [];
  const facilities = facilitiesQ.data ?? [];
  const categories = Array.from(new Set(instruments.map((i) => i.category))).sort();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["instruments"] });

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        facilityId: form.facilityId,
        name: form.name,
        category: form.category,
        make: form.make || undefined,
        model: form.model || undefined,
        hourlyRate: Number(form.hourlyRate) || 0,
        trainingRequired: form.trainingRequired,
        imageUrl: form.imageUrl || undefined,
        description: form.description || undefined,
        accreditation: form.accreditation || undefined,
        industries: form.industries,
        netTestHours: form.netTestHours.trim() === "" ? null : Number(form.netTestHours),
        maxSampleSpec: buildSampleSpec(form),
      };
      if (editing) body.status = form.status;
      return editing
        ? patch<Instrument>(`/instruments/${editing.id}`, body)
        : post<Instrument>("/instruments", body);
    },
    onSuccess: (saved) => {
      const wasEditing = !!editing;
      toast.push("success", wasEditing ? "Instrument updated." : "Instrument added.");
      setModalOpen(false); invalidate();
      // After creating a new instrument, jump to its 360° detail page.
      if (!wasEditing && saved?.id) navigate(`/admin/instruments/${saved.id}`);
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not save instrument."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del(`/instruments/${id}`),
    onSuccess: () => { toast.push("success", "Instrument deleted."); setConfirm(null); invalidate(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not delete."),
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY, facilityId: facilities[0]?.id || "" });
    setModalOpen(true);
  }
  function openEdit(i: Instrument) {
    setEditing(i);
    setForm({
      facilityId: i.facilityId, name: i.name, category: i.category,
      make: i.make || "", model: i.model || "", hourlyRate: String(i.hourlyRate ?? ""),
      trainingRequired: i.trainingRequired, imageUrl: i.imageUrl || "",
      description: i.description || "", status: i.status,
      accreditation: i.accreditation || "", industries: i.industries ?? [],
      netTestHours: i.netTestHours != null ? String(i.netTestHours) : "",
      maxLengthMm: i.maxSampleSpec?.maxLengthMm != null ? String(i.maxSampleSpec.maxLengthMm) : "",
      maxWidthMm: i.maxSampleSpec?.maxWidthMm != null ? String(i.maxSampleSpec.maxWidthMm) : "",
      maxHeightMm: i.maxSampleSpec?.maxHeightMm != null ? String(i.maxSampleSpec.maxHeightMm) : "",
      maxWeightKg: i.maxSampleSpec?.maxWeightKg != null ? String(i.maxSampleSpec.maxWeightKg) : "",
      sampleNotes: i.maxSampleSpec?.notes ?? "",
    });
    setModalOpen(true);
  }

  function toggleIndustry(title: string) {
    setForm((f) => ({
      ...f,
      industries: f.industries.includes(title)
        ? f.industries.filter((x) => x !== title)
        : [...f.industries, title],
    }));
  }

  return (
    <div>
      <PageHeader
        title="Instruments"
        subtitle="Your catalog of instruments and assets."
        actions={
          <Button onClick={openCreate} disabled={facilities.length === 0}>
            <Plus className="h-4 w-4" /> Add instrument
          </Button>
        }
      />

      {facilities.length === 0 && !facilitiesQ.isLoading && (
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          Create a facility first before adding instruments.
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-surface-border px-5 py-3">
          <div className="w-48">
            <Select value={fFacility} onChange={(e) => setFFacility(e.target.value)}>
              <option value="">All facilities</option>
              {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          </div>
          <div className="w-44">
            <Select value={fCategory} onChange={(e) => setFCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div className="w-40">
            <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
        </div>

        {isLoading ? (
          <LoadingBlock />
        ) : isError ? (
          <ErrorState error={error} />
        ) : instruments.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={<Microscope className="h-6 w-6" />}
              title="No instruments"
              description="Add instruments to make them bookable and to attach services."
            />
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="th">Instrument</th>
                <th className="th">Category</th>
                <th className="th">Certification</th>
                <th className="th">Industries</th>
                <th className="th">Facility</th>
                <th className="th">Status</th>
                <th className="th text-right">Rate / hr</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {instruments.map((i) => (
                <tr key={i.id} className="hover:bg-surface-subtle">
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-muted text-ink-faint">
                        {i.imageUrl ? <img src={i.imageUrl} alt="" className="h-full w-full object-cover" /> : <Microscope className="h-4 w-4" />}
                      </span>
                      <div>
                        <Link to={`/admin/instruments/${i.id}`} className="font-medium text-ink hover:text-brand-600">{i.name}</Link>
                        {(i.make || i.model) && <p className="text-xs text-ink-muted">{[i.make, i.model].filter(Boolean).join(" ")}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="td">{i.category}</td>
                  <td className="td">
                    {i.accreditation
                      ? <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">{i.accreditation}</span>
                      : <span className="text-ink-faint">-</span>}
                  </td>
                  <td className="td">
                    {i.industries && i.industries.length > 0
                      ? <span className="text-xs text-ink-muted">{i.industries.length === 1 ? i.industries[0] : `${i.industries.length} industries`}</span>
                      : <span className="text-ink-faint">-</span>}
                  </td>
                  <td className="td">{i.facility?.name ?? "-"}</td>
                  <td className="td"><StatusBadge status={i.status} /></td>
                  <td className="td text-right">{money(i.hourlyRate)}</td>
                  <td className="td">
                    <div className="flex justify-end gap-1">
                      <Link to={`/admin/instruments/${i.id}`} className="btn-ghost btn-sm" title="View 360°"><Maximize2 className="h-4 w-4" /></Link>
                      <Button variant="ghost" className="btn-sm" title="Schedule" onClick={() => setSchedule(i)}><CalendarClock className="h-4 w-4" /></Button>
                      <Button variant="ghost" className="btn-sm" title="Quick edit" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" className="btn-sm text-danger" onClick={() => setConfirm(i)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal
        wide open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? "Edit instrument" : "Add instrument"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              loading={save.isPending}
              disabled={!form.name.trim() || !form.category.trim() || !form.facilityId}
              onClick={() => save.mutate()}
            >
              {editing ? "Save changes" : "Add instrument"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Facility">
            <Select value={form.facilityId} onChange={(e) => setForm({ ...form, facilityId: e.target.value })}>
              <option value="">Select facility</option>
              {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          </Field>
          <Field label="Category">
            <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Microscopy" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Scanning Electron Microscope" />
            </Field>
          </div>
          <Field label="Make" hint="Optional">
            <Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} />
          </Field>
          <Field label="Model" hint="Optional">
            <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </Field>
          <Field label="Hourly rate">
            <Input type="number" min={0} value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} />
          </Field>
          {editing && (
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as InstrumentStatus })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Certification" hint="Optional">
            <Select value={form.accreditation} onChange={(e) => setForm({ ...form, accreditation: e.target.value })}>
              {CERTIFICATIONS.map((c) => <option key={c} value={c}>{c === "" ? "None" : c}</option>)}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Applicable industries" hint="Optional">
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-surface-border p-3">
                {INDUSTRIES.map((ind) => (
                  <label key={ind.title} className="flex items-center gap-2 text-sm text-ink-soft">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-surface-border"
                      checked={form.industries.includes(ind.title)}
                      onChange={() => toggleIndustry(ind.title)}
                    />
                    {ind.title}
                  </label>
                ))}
              </div>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Image URL" hint="Optional">
              <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://…" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description" hint="Optional">
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
          </div>

          {/* Sample envelope & test timing — engineering conformance-testing specifics */}
          <div className="sm:col-span-2 rounded-lg border border-surface-border p-4">
            <p className="label mb-1">Sample envelope &amp; test timing <span className="font-normal text-ink-faint">· optional</span></p>
            <p className="mb-3 text-xs text-ink-muted">The largest specimen this setup accepts, and net test hours per cycle (excluding pre/post-test checks). Shown to buyers on the equipment page.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Field label="Max length (mm)"><Input type="number" min={0} value={form.maxLengthMm} onChange={(e) => setForm({ ...form, maxLengthMm: e.target.value })} /></Field>
              <Field label="Max width (mm)"><Input type="number" min={0} value={form.maxWidthMm} onChange={(e) => setForm({ ...form, maxWidthMm: e.target.value })} /></Field>
              <Field label="Max height (mm)"><Input type="number" min={0} value={form.maxHeightMm} onChange={(e) => setForm({ ...form, maxHeightMm: e.target.value })} /></Field>
              <Field label="Max weight (kg)"><Input type="number" min={0} value={form.maxWeightKg} onChange={(e) => setForm({ ...form, maxWeightKg: e.target.value })} /></Field>
              <Field label="Net test hours"><Input type="number" min={0} step="0.5" value={form.netTestHours} onChange={(e) => setForm({ ...form, netTestHours: e.target.value })} /></Field>
            </div>
            <div className="mt-3">
              <Field label="Sample-handling notes" hint="Optional">
                <Input value={form.sampleNotes} onChange={(e) => setForm({ ...form, sampleNotes: e.target.value })} placeholder="e.g. Fixturing envelope Ø300 mm; irregular shapes on request" />
              </Field>
            </div>
          </div>

          <label className="sm:col-span-2 flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox" className="h-4 w-4 rounded border-surface-border"
              checked={form.trainingRequired}
              onChange={(e) => setForm({ ...form, trainingRequired: e.target.checked })}
            />
            Training required before booking
          </label>
        </div>
      </Modal>

      <Modal
        open={!!confirm} onClose={() => setConfirm(null)} title="Delete instrument"
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

      <ScheduleModal instrument={schedule} onClose={() => setSchedule(null)} />
    </div>
  );
}

function ScheduleModal({ instrument, onClose }: { instrument: Instrument | null; onClose: () => void }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["bookings", "instrument", instrument?.id],
    queryFn: () => fetchBookings({ instrumentId: instrument!.id }),
    enabled: !!instrument,
  });
  const bookings: Booking[] = asList(data as any);

  return (
    <Modal
      wide open={!!instrument} onClose={onClose}
      title={instrument ? `Schedule - ${instrument.name}` : "Schedule"}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      {instrument && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-surface-border px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-ink-muted">Last calibrated</p>
              <p className="mt-1 text-sm font-medium text-ink">{fmtDate(instrument.lastCalibratedAt)}</p>
            </div>
            <div className="rounded-lg border border-surface-border px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-ink-muted">Next calibration</p>
              <p className="mt-1 text-sm font-medium text-ink">{fmtDate(instrument.nextCalibrationAt)}</p>
            </div>
          </div>

          <div>
            <p className="label mb-2">Bookings</p>
            {isLoading ? (
              <LoadingBlock />
            ) : isError ? (
              <ErrorState error={error} />
            ) : bookings.length === 0 ? (
              <EmptyState
                icon={<CalendarClock className="h-6 w-6" />}
                title="No bookings"
                description="This instrument has no bookings yet."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th className="th">Start</th>
                    <th className="th">End</th>
                    <th className="th">Booked by</th>
                    <th className="th">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-surface-subtle">
                      <td className="td">{fmtDateTime(b.startAt)}</td>
                      <td className="td">{fmtDateTime(b.endAt)}</td>
                      <td className="td">{b.user?.name ?? "-"}</td>
                      <td className="td"><StatusBadge status={b.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
