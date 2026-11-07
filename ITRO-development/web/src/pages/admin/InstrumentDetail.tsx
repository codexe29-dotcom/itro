import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Save, Plus, Trash2, CalendarClock, ExternalLink, Wrench, ListChecks,
  FileText, Download, Loader2, Upload, BadgeCheck, FlaskConical,
} from "lucide-react";
import {
  fetchInstrument, fetchFacilities, fetchBookings, fetchServices, asList,
  addMaintenanceWindow, removeMaintenanceWindow,
} from "@/lib/queries";
import { patch, post, del, uploadFile } from "@/lib/api";
import type {
  Instrument, InstrumentStatus, Booking, Service, Certification, DocumentType, InstrumentDocument,
  CapacityType, MaintenanceWindow,
} from "@/lib/types";
import InstrumentWeekCalendar from "@/components/InstrumentWeekCalendar";
import { money, dateShort, dateTime } from "@/lib/format";
import { INDUSTRIES } from "@/lib/taxonomy";
import { ImageUploader } from "@/components/ImageUploader";
import {
  PageHeader, Card, CardBody, Button, Badge,
  Field, Input, Textarea, Select, LoadingBlock, EmptyState, ErrorState, useToast,
} from "@/components/ui";

const STATUSES: InstrumentStatus[] = ["AVAILABLE", "BOOKED", "MAINTENANCE", "OFFLINE"];
const CERTIFICATIONS = ["", "ISO 17025", "NABL", "ISO 9001"];
const DOC_TYPES: DocumentType[] = [
  "WARRANTY", "LICENSE", "CALIBRATION_CERT", "MANUAL", "CERTIFICATE", "DATASHEET", "OTHER",
];
const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  WARRANTY: "Warranty", LICENSE: "License", CALIBRATION_CERT: "Calibration cert",
  MANUAL: "Manual", CERTIFICATE: "Certificate", DATASHEET: "Datasheet", OTHER: "Other",
};

function emptyCert(): Certification {
  return { body: "", number: "", scope: "", validFrom: "", validUntil: "", documentUrl: "" };
}

interface SpecRow { key: string; value: string }

interface FormState {
  facilityId: string; name: string; category: string; make: string; model: string;
  hourlyRate: string; trainingRequired: boolean; imageUrl: string; description: string;
  status: InstrumentStatus; accreditation: string; industries: string[];
  lastCalibratedAt: string; nextCalibrationAt: string;
  // Capacity & scheduling
  capacityType: CapacityType; concurrency: string; throughputPerDay: string;
  slotMinutes: string; setupMinutes: string; leadTimeDays: string; requiresOperator: boolean;
  // Sample envelope & timing
  netTestHours: string;
  maxLengthMm: string; maxWidthMm: string; maxHeightMm: string; maxWeightKg: string; sampleNotes: string;
}

// Convert ISO -> value for <input type="datetime-local">
function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | undefined {
  if (!v) return undefined;
  return new Date(v).toISOString();
}

function specsToRows(specs?: Record<string, unknown>): SpecRow[] {
  if (!specs || typeof specs !== "object") return [];
  return Object.entries(specs).map(([key, value]) => ({
    key,
    value: typeof value === "object" ? JSON.stringify(value) : String(value ?? ""),
  }));
}
function rowsToSpecs(rows: SpecRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const k = r.key.trim();
    if (k) out[k] = r.value;
  }
  return out;
}

export default function AdminInstrumentDetail() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const toast = useToast();

  const instrumentQ = useQuery({ queryKey: ["instrument", id], queryFn: () => fetchInstrument(id), enabled: !!id });
  const facilitiesQ = useQuery({ queryKey: ["facilities"], queryFn: fetchFacilities });
  const bookingsQ = useQuery({
    queryKey: ["bookings", "instrument", id],
    queryFn: () => fetchBookings({ instrumentId: id }),
    enabled: !!id,
  });
  const servicesQ = useQuery({ queryKey: ["services"], queryFn: () => fetchServices() });

  const [form, setForm] = useState<FormState | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [specRows, setSpecRows] = useState<SpecRow[]>([]);
  const [applications, setApplications] = useState<string[]>([]);
  const [newApp, setNewApp] = useState("");
  const [certs, setCerts] = useState<Certification[]>([]);

  const inst = instrumentQ.data;
  useEffect(() => {
    if (!inst) return;
    setForm({
      facilityId: inst.facilityId, name: inst.name, category: inst.category,
      make: inst.make || "", model: inst.model || "", hourlyRate: String(inst.hourlyRate ?? ""),
      trainingRequired: inst.trainingRequired, imageUrl: inst.imageUrl || "",
      description: inst.description || "", status: inst.status,
      accreditation: inst.accreditation || "", industries: inst.industries ?? [],
      lastCalibratedAt: toLocalInput(inst.lastCalibratedAt),
      nextCalibrationAt: toLocalInput(inst.nextCalibrationAt),
      capacityType: inst.capacityType ?? "TIME_SLOT",
      concurrency: String(inst.concurrency ?? 1),
      throughputPerDay: inst.throughputPerDay != null ? String(inst.throughputPerDay) : "",
      slotMinutes: String(inst.slotMinutes ?? 60),
      setupMinutes: String(inst.setupMinutes ?? 0),
      leadTimeDays: String(inst.leadTimeDays ?? 0),
      requiresOperator: inst.requiresOperator ?? false,
      netTestHours: inst.netTestHours != null ? String(inst.netTestHours) : "",
      maxLengthMm: inst.maxSampleSpec?.maxLengthMm != null ? String(inst.maxSampleSpec.maxLengthMm) : "",
      maxWidthMm: inst.maxSampleSpec?.maxWidthMm != null ? String(inst.maxSampleSpec.maxWidthMm) : "",
      maxHeightMm: inst.maxSampleSpec?.maxHeightMm != null ? String(inst.maxSampleSpec.maxHeightMm) : "",
      maxWeightKg: inst.maxSampleSpec?.maxWeightKg != null ? String(inst.maxSampleSpec.maxWeightKg) : "",
      sampleNotes: inst.maxSampleSpec?.notes ?? "",
    });
    setImages(inst.images ?? []);
    setSpecRows(specsToRows(inst.specs));
    setApplications(inst.applications ?? []);
    setCerts((inst.certifications ?? []).map((c) => ({ ...emptyCert(), ...c })));
  }, [inst]);

  const documents: InstrumentDocument[] = inst?.documents ?? [];

  const facilities = facilitiesQ.data ?? [];
  const bookings: Booking[] = asList(bookingsQ.data as any);
  const linkedServices: Service[] = (servicesQ.data ?? []).filter((s) => s.instrumentId === id);

  const save = useMutation({
    mutationFn: () => {
      if (!form) throw new Error("No form");
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
        status: form.status,
        accreditation: form.accreditation || undefined,
        industries: form.industries,
        images,
        applications,
        certifications: certs.filter((c) => c.body.trim() || c.number.trim()),
        specs: rowsToSpecs(specRows),
        lastCalibratedAt: fromLocalInput(form.lastCalibratedAt),
        nextCalibrationAt: fromLocalInput(form.nextCalibrationAt),
        capacityType: form.capacityType,
        concurrency: Math.max(1, Number(form.concurrency) || 1),
        throughputPerDay: form.throughputPerDay.trim() ? Math.max(1, Number(form.throughputPerDay)) : null,
        slotMinutes: Math.max(15, Number(form.slotMinutes) || 60),
        setupMinutes: Math.max(0, Number(form.setupMinutes) || 0),
        leadTimeDays: Math.max(0, Number(form.leadTimeDays) || 0),
        requiresOperator: form.requiresOperator,
        netTestHours: form.netTestHours.trim() === "" ? null : Number(form.netTestHours),
        maxSampleSpec: (() => {
          const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
          const spec: Record<string, unknown> = {};
          if (num(form.maxLengthMm) != null) spec.maxLengthMm = num(form.maxLengthMm);
          if (num(form.maxWidthMm) != null) spec.maxWidthMm = num(form.maxWidthMm);
          if (num(form.maxHeightMm) != null) spec.maxHeightMm = num(form.maxHeightMm);
          if (num(form.maxWeightKg) != null) spec.maxWeightKg = num(form.maxWeightKg);
          if (form.sampleNotes.trim()) spec.notes = form.sampleNotes.trim();
          return Object.keys(spec).length ? spec : null;
        })(),
      };
      return patch(`/instruments/${id}`, body);
    },
    onSuccess: () => {
      toast.push("success", "Instrument saved.");
      qc.invalidateQueries({ queryKey: ["instrument", id] });
      qc.invalidateQueries({ queryKey: ["instruments"] });
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not save instrument."),
  });

  function toggleIndustry(title: string) {
    setForm((f) => (f ? {
      ...f,
      industries: f.industries.includes(title)
        ? f.industries.filter((x) => x !== title)
        : [...f.industries, title],
    } : f));
  }
  function addApplication() {
    const v = newApp.trim();
    if (!v) return;
    setApplications((a) => [...a, v]);
    setNewApp("");
  }

  // Documents: upload state + type/name inputs.
  const docFileRef = useRef<HTMLInputElement>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [docType, setDocType] = useState<DocumentType>("MANUAL");
  const [docName, setDocName] = useState("");
  const [docExpiry, setDocExpiry] = useState("");

  const invalidateInstrument = () => {
    qc.invalidateQueries({ queryKey: ["instrument", id] });
    qc.invalidateQueries({ queryKey: ["public-instrument", id] });
  };

  async function handleDocFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setDocUploading(true);
    try {
      const { url } = await uploadFile(file);
      await post(`/instruments/${id}/documents`, {
        type: docType,
        name: docName.trim() || file.name,
        url,
        expiresAt: docExpiry ? new Date(docExpiry).toISOString() : undefined,
      });
      toast.push("success", "Document uploaded.");
      setDocName(""); setDocExpiry("");
      invalidateInstrument();
    } catch (e: any) {
      toast.push("error", e?.response?.data?.message || "Document upload failed.");
    } finally {
      setDocUploading(false);
      if (docFileRef.current) docFileRef.current.value = "";
    }
  }

  const removeDoc = useMutation({
    mutationFn: (docId: string) => del(`/instruments/${id}/documents/${docId}`),
    onSuccess: () => { toast.push("success", "Document removed."); invalidateInstrument(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not remove document."),
  });

  // Certification certificate upload (fills documentUrl on a row).
  const certFileRef = useRef<HTMLInputElement>(null);
  const [certUploadIdx, setCertUploadIdx] = useState<number | null>(null);
  async function handleCertFile(files: FileList | null) {
    if (!files || files.length === 0 || certUploadIdx === null) return;
    const file = files[0];
    const idx = certUploadIdx;
    try {
      const { url } = await uploadFile(file);
      setCerts((rows) => rows.map((r, i) => (i === idx ? { ...r, documentUrl: url } : r)));
      toast.push("success", "Certificate uploaded. Save to persist.");
    } catch (e: any) {
      toast.push("error", e?.response?.data?.message || "Certificate upload failed.");
    } finally {
      setCertUploadIdx(null);
      if (certFileRef.current) certFileRef.current.value = "";
    }
  }
  function updateCert(idx: number, patchRow: Partial<Certification>) {
    setCerts((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patchRow } : r)));
  }

  // Maintenance windows editor.
  const maintenanceWindows: MaintenanceWindow[] = inst?.maintenanceWindows ?? [];
  const [mwStart, setMwStart] = useState("");
  const [mwEnd, setMwEnd] = useState("");
  const [mwReason, setMwReason] = useState("");

  const addMw = useMutation({
    mutationFn: () =>
      addMaintenanceWindow(id, {
        startAt: new Date(mwStart).toISOString(),
        endAt: new Date(mwEnd).toISOString(),
        reason: mwReason.trim() || undefined,
      }),
    onSuccess: () => {
      toast.push("success", "Maintenance window added.");
      setMwStart(""); setMwEnd(""); setMwReason("");
      qc.invalidateQueries({ queryKey: ["instrument", id] });
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not add maintenance window."),
  });
  const removeMw = useMutation({
    mutationFn: (mwId: string) => removeMaintenanceWindow(id, mwId),
    onSuccess: () => {
      toast.push("success", "Maintenance window removed.");
      qc.invalidateQueries({ queryKey: ["instrument", id] });
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not remove maintenance window."),
  });

  if (instrumentQ.isLoading) return <LoadingBlock />;
  if (instrumentQ.isError) return <ErrorState error={instrumentQ.error} />;
  if (!inst || !form) return <ErrorState error={new Error("Instrument not found")} />;

  return (
    <div>
      <div className="mb-4">
        <Link to="/admin/instruments" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Back to instruments
        </Link>
      </div>

      <PageHeader
        title={inst.name}
        subtitle={`${inst.category}${inst.make || inst.model ? " · " + [inst.make, inst.model].filter(Boolean).join(" ") : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <Link to={`/instruments/${inst.id}`} target="_blank" className="btn-secondary btn-sm">
              <ExternalLink className="h-4 w-4" /> View public page
            </Link>
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              <Save className="h-4 w-4" /> Save changes
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Photo gallery */}
          <Card>
            <CardBody>
              <ImageUploader images={images} onChange={setImages} />
            </CardBody>
          </Card>

          {/* Details */}
          <Card>
            <CardBody>
              <h3 className="mb-4 font-semibold text-ink">Details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Name">
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </Field>
                </div>
                <Field label="Category">
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                </Field>
                <Field label="Facility">
                  <Select value={form.facilityId} onChange={(e) => setForm({ ...form, facilityId: e.target.value })}>
                    <option value="">Select facility</option>
                    {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </Select>
                </Field>
                <Field label="Make" hint="Optional">
                  <Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} />
                </Field>
                <Field label="Model" hint="Optional">
                  <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
                </Field>
                <Field label="Status">
                  <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as InstrumentStatus })}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </Field>
                <Field label="Hourly rate">
                  <Input type="number" min={0} value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} />
                </Field>
                <Field label="Certification" hint="Optional">
                  <Select value={form.accreditation} onChange={(e) => setForm({ ...form, accreditation: e.target.value })}>
                    {CERTIFICATIONS.map((c) => <option key={c} value={c}>{c === "" ? "None" : c}</option>)}
                  </Select>
                </Field>
                <Field label="Last calibrated" hint="Optional">
                  <Input type="datetime-local" value={form.lastCalibratedAt} onChange={(e) => setForm({ ...form, lastCalibratedAt: e.target.value })} />
                </Field>
                <Field label="Next calibration" hint="Optional">
                  <Input type="datetime-local" value={form.nextCalibrationAt} onChange={(e) => setForm({ ...form, nextCalibrationAt: e.target.value })} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Primary image URL" hint="Optional legacy field - the gallery above is preferred.">
                    <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://…" />
                  </Field>
                </div>
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
                  <Field label="Description" hint="Optional">
                    <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </Field>
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
            </CardBody>
          </Card>

          {/* Scheduling & capacity */}
          <Card>
            <CardBody>
              <h3 className="mb-1 flex items-center gap-2 font-semibold text-ink">
                <CalendarClock className="h-4 w-4 text-brand-600" /> Scheduling & capacity
              </h3>
              <p className="mb-4 text-sm text-ink-muted">
                How this instrument's availability is computed on the exchange.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Capacity type">
                  <Select
                    value={form.capacityType}
                    onChange={(e) => setForm({ ...form, capacityType: e.target.value as CapacityType })}
                  >
                    <option value="TIME_SLOT">Time-slot (bookable slots)</option>
                    <option value="THROUGHPUT">Throughput (units per day)</option>
                  </Select>
                </Field>
                {form.capacityType === "TIME_SLOT" ? (
                  <>
                    <Field label="Concurrency" hint="Jobs at once">
                      <Input type="number" min={1} value={form.concurrency}
                        onChange={(e) => setForm({ ...form, concurrency: e.target.value })} />
                    </Field>
                    <Field label="Slot minutes" hint="Length of a slot">
                      <Input type="number" min={15} step={15} value={form.slotMinutes}
                        onChange={(e) => setForm({ ...form, slotMinutes: e.target.value })} />
                    </Field>
                    <Field label="Setup buffer (min)" hint="Cleanup between jobs">
                      <Input type="number" min={0} step={5} value={form.setupMinutes}
                        onChange={(e) => setForm({ ...form, setupMinutes: e.target.value })} />
                    </Field>
                  </>
                ) : (
                  <Field label="Throughput / day" hint="Samples processed per day">
                    <Input type="number" min={1} value={form.throughputPerDay}
                      onChange={(e) => setForm({ ...form, throughputPerDay: e.target.value })} />
                  </Field>
                )}
                <Field label="Lead time (days)" hint="Earliest start from now">
                  <Input type="number" min={0} value={form.leadTimeDays}
                    onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })} />
                </Field>
                <label className="sm:col-span-2 flex items-center gap-2 text-sm text-ink-soft">
                  <input
                    type="checkbox" className="h-4 w-4 rounded border-surface-border"
                    checked={form.requiresOperator}
                    onChange={(e) => setForm({ ...form, requiresOperator: e.target.checked })}
                  />
                  Requires an operator to run
                </label>
              </div>
              <p className="mt-3 text-xs text-ink-faint">Saved with <span className="font-medium">Save changes</span>.</p>
            </CardBody>
          </Card>

          {/* Sample envelope & test timing */}
          <Card>
            <CardBody>
              <h3 className="mb-1 flex items-center gap-2 font-semibold text-ink">
                <FlaskConical className="h-4 w-4 text-brand-600" /> Sample envelope & test timing
              </h3>
              <p className="mb-4 text-sm text-ink-muted">
                Largest specimen this setup accepts and net test hours per cycle (excluding pre/post-test checks). Shown to buyers.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Field label="Max length (mm)"><Input type="number" min={0} value={form.maxLengthMm} onChange={(e) => setForm({ ...form, maxLengthMm: e.target.value })} /></Field>
                <Field label="Max width (mm)"><Input type="number" min={0} value={form.maxWidthMm} onChange={(e) => setForm({ ...form, maxWidthMm: e.target.value })} /></Field>
                <Field label="Max height (mm)"><Input type="number" min={0} value={form.maxHeightMm} onChange={(e) => setForm({ ...form, maxHeightMm: e.target.value })} /></Field>
                <Field label="Max weight (kg)"><Input type="number" min={0} value={form.maxWeightKg} onChange={(e) => setForm({ ...form, maxWeightKg: e.target.value })} /></Field>
                <Field label="Net test hours"><Input type="number" min={0} step="0.5" value={form.netTestHours} onChange={(e) => setForm({ ...form, netTestHours: e.target.value })} /></Field>
              </div>
              <div className="mt-4">
                <Field label="Sample-handling notes" hint="Optional">
                  <Input value={form.sampleNotes} onChange={(e) => setForm({ ...form, sampleNotes: e.target.value })} placeholder="e.g. Fixturing envelope Ø300 mm; irregular shapes on request" />
                </Field>
              </div>
            </CardBody>
          </Card>

          {/* Maintenance windows */}
          <Card>
            <CardBody>
              <h3 className="mb-1 flex items-center gap-2 font-semibold text-ink">
                <Wrench className="h-4 w-4 text-brand-600" /> Maintenance windows
              </h3>
              <p className="mb-4 text-sm text-ink-muted">
                Blocked periods removed from availability. Applied immediately.
              </p>
              <div className="mb-4 grid gap-3 rounded-lg border border-surface-border p-3 sm:grid-cols-2">
                <Field label="Start">
                  <Input type="datetime-local" value={mwStart} onChange={(e) => setMwStart(e.target.value)} />
                </Field>
                <Field label="End">
                  <Input type="datetime-local" value={mwEnd} onChange={(e) => setMwEnd(e.target.value)} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Reason" hint="Optional">
                    <Input value={mwReason} placeholder="Preventive service" onChange={(e) => setMwReason(e.target.value)} />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Button
                    variant="secondary" className="btn-sm"
                    loading={addMw.isPending}
                    disabled={!mwStart || !mwEnd}
                    onClick={() => addMw.mutate()}
                  >
                    <Plus className="h-4 w-4" /> Add window
                  </Button>
                </div>
              </div>
              {maintenanceWindows.length === 0 ? (
                <p className="text-sm text-ink-muted">No maintenance windows scheduled.</p>
              ) : (
                <ul className="space-y-2">
                  {maintenanceWindows.map((m) => (
                    <li key={m.id} className="flex items-center justify-between rounded-lg border border-surface-border px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium text-ink">{dateTime(m.startAt)} → {dateTime(m.endAt)}</p>
                        {m.reason && <p className="text-xs text-ink-muted">{m.reason}</p>}
                      </div>
                      <button className="rounded p-1 text-ink-faint hover:text-danger" onClick={() => removeMw.mutate(m.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Specifications */}
          <Card>
            <CardBody>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-ink">Specifications</h3>
                <Button variant="secondary" className="btn-sm" onClick={() => setSpecRows((r) => [...r, { key: "", value: "" }])}>
                  <Plus className="h-4 w-4" /> Add row
                </Button>
              </div>
              {specRows.length === 0 ? (
                <p className="text-sm text-ink-muted">No specifications yet. Add rows such as Resolution, Voltage, Capacity or Standards.</p>
              ) : (
                <div className="space-y-2">
                  {specRows.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        className="w-1/3" placeholder="Key (e.g. Resolution)"
                        value={row.key}
                        onChange={(e) => setSpecRows((r) => r.map((x, i) => i === idx ? { ...x, key: e.target.value } : x))}
                      />
                      <Input
                        className="flex-1" placeholder="Value (e.g. 1 nm)"
                        value={row.value}
                        onChange={(e) => setSpecRows((r) => r.map((x, i) => i === idx ? { ...x, value: e.target.value } : x))}
                      />
                      <Button variant="ghost" className="btn-sm text-danger" onClick={() => setSpecRows((r) => r.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Applications */}
          <Card>
            <CardBody>
              <h3 className="mb-1 flex items-center gap-2 font-semibold text-ink"><ListChecks className="h-4 w-4 text-brand-600" /> Applications</h3>
              <p className="mb-4 text-sm text-ink-muted">What this instrument is used for.</p>
              <div className="mb-3 flex items-center gap-2">
                <Input
                  placeholder="e.g. Surface topography of thin films"
                  value={newApp}
                  onChange={(e) => setNewApp(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addApplication(); } }}
                />
                <Button variant="secondary" className="btn-sm" onClick={addApplication}><Plus className="h-4 w-4" /> Add</Button>
              </div>
              {applications.length === 0 ? (
                <p className="text-sm text-ink-muted">No applications listed yet.</p>
              ) : (
                <ul className="space-y-2">
                  {applications.map((a, idx) => (
                    <li key={idx} className="flex items-center justify-between rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-soft">
                      <span>{a}</span>
                      <button className="text-ink-faint hover:text-danger" onClick={() => setApplications((list) => list.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Certifications */}
          <Card>
            <CardBody>
              <div className="mb-1 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-semibold text-ink">
                  <BadgeCheck className="h-4 w-4 text-brand-600" /> Certifications
                </h3>
                <Button variant="secondary" className="btn-sm" onClick={() => setCerts((c) => [...c, emptyCert()])}>
                  <Plus className="h-4 w-4" /> Add certification
                </Button>
              </div>
              <p className="mb-4 text-sm text-ink-muted">
                Rich accreditations (e.g. NABL, ISO 17025) with number, scope, validity and certificate. Saved on <span className="font-medium">Save changes</span>.
              </p>
              {certs.length === 0 ? (
                <p className="text-sm text-ink-muted">No certifications yet.</p>
              ) : (
                <div className="space-y-4">
                  {certs.map((c, idx) => (
                    <div key={idx} className="rounded-lg border border-surface-border p-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Body">
                          <Input value={c.body} placeholder="NABL / ISO 17025" onChange={(e) => updateCert(idx, { body: e.target.value })} />
                        </Field>
                        <Field label="Number">
                          <Input value={c.number} placeholder="TC-1234" onChange={(e) => updateCert(idx, { number: e.target.value })} />
                        </Field>
                        <div className="sm:col-span-2">
                          <Field label="Scope" hint="Optional">
                            <Input value={c.scope} placeholder="Mechanical testing of metals" onChange={(e) => updateCert(idx, { scope: e.target.value })} />
                          </Field>
                        </div>
                        <Field label="Valid from" hint="Optional">
                          <Input type="date" value={c.validFrom} onChange={(e) => updateCert(idx, { validFrom: e.target.value })} />
                        </Field>
                        <Field label="Valid until" hint="Optional">
                          <Input type="date" value={c.validUntil} onChange={(e) => updateCert(idx, { validUntil: e.target.value })} />
                        </Field>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          variant="secondary" className="btn-sm"
                          onClick={() => { setCertUploadIdx(idx); certFileRef.current?.click(); }}
                        >
                          <Upload className="h-4 w-4" /> {c.documentUrl ? "Replace certificate" : "Upload certificate"}
                        </Button>
                        {c.documentUrl && (
                          <a href={c.documentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700">
                            <FileText className="h-4 w-4" /> View certificate
                          </a>
                        )}
                        <Button variant="ghost" className="btn-sm text-danger ml-auto" onClick={() => setCerts((rows) => rows.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-4 w-4" /> Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <input ref={certFileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleCertFile(e.target.files)} />
            </CardBody>
          </Card>

          {/* Documents */}
          <Card>
            <CardBody>
              <h3 className="mb-1 flex items-center gap-2 font-semibold text-ink">
                <FileText className="h-4 w-4 text-brand-600" /> Documents
              </h3>
              <p className="mb-4 text-sm text-ink-muted">Warranty, licenses, calibration certs, manuals and datasheets (PDF / image).</p>

              <div className="mb-4 grid gap-3 rounded-lg border border-surface-border p-3 sm:grid-cols-2">
                <Field label="Type">
                  <Select value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}>
                    {DOC_TYPES.map((t) => <option key={t} value={t}>{DOC_TYPE_LABEL[t]}</option>)}
                  </Select>
                </Field>
                <Field label="Name" hint="Defaults to file name">
                  <Input value={docName} placeholder="Operating Manual" onChange={(e) => setDocName(e.target.value)} />
                </Field>
                <Field label="Expiry" hint="Optional">
                  <Input type="date" value={docExpiry} onChange={(e) => setDocExpiry(e.target.value)} />
                </Field>
                <div className="flex items-end">
                  <Button variant="secondary" className="btn-sm" disabled={docUploading} onClick={() => docFileRef.current?.click()}>
                    {docUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {docUploading ? "Uploading…" : "Upload document"}
                  </Button>
                </div>
              </div>
              <input ref={docFileRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" onChange={(e) => handleDocFile(e.target.files)} />

              {documents.length === 0 ? (
                <p className="text-sm text-ink-muted">No documents uploaded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-surface-border px-3 py-2 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge tone="gray">{DOC_TYPE_LABEL[d.type] ?? d.type}</Badge>
                        <span className="truncate font-medium text-ink">{d.name}</span>
                        {d.expiresAt && <span className="text-xs text-ink-muted">exp {dateShort(d.expiresAt)}</span>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <a href={d.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded px-2 py-1 text-brand-600 hover:bg-surface-subtle hover:text-brand-700">
                          <Download className="h-4 w-4" /> Open
                        </a>
                        <button className="rounded p-1 text-ink-faint hover:text-danger" onClick={() => removeDoc.mutate(d.id)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Schedule - week calendar of bookings, reservations & maintenance */}
          <Card>
            <CardBody>
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-ink"><CalendarClock className="h-4 w-4 text-brand-600" /> Schedule</h3>
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-surface-border px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-ink-muted">Last calibrated</p>
                  <p className="mt-0.5 text-sm font-medium text-ink">{dateShort(inst.lastCalibratedAt)}</p>
                </div>
                <div className="rounded-lg border border-surface-border px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-ink-muted">Next calibration</p>
                  <p className="mt-0.5 text-sm font-medium text-ink">{dateShort(inst.nextCalibrationAt)}</p>
                </div>
              </div>
              {bookingsQ.isLoading ? (
                <LoadingBlock />
              ) : (
                <InstrumentWeekCalendar
                  bookings={bookings}
                  maintenanceWindows={maintenanceWindows}
                  reservations={inst.reservations ?? []}
                />
              )}
            </CardBody>
          </Card>

          {/* Linked services */}
          <Card>
            <CardBody>
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-ink"><Wrench className="h-4 w-4 text-brand-600" /> Linked services</h3>
              {servicesQ.isLoading ? (
                <LoadingBlock />
              ) : linkedServices.length === 0 ? (
                <EmptyState icon={<Wrench className="h-6 w-6" />} title="No linked services" description="Attach services to this instrument from the Services page." />
              ) : (
                <div className="space-y-2">
                  {linkedServices.map((s) => (
                    <Link
                      key={s.id}
                      to="/admin/services"
                      className="flex items-center justify-between rounded-lg border border-surface-border px-3 py-2 text-sm hover:bg-surface-subtle"
                    >
                      <div>
                        <p className="font-medium text-ink">{s.name}</p>
                        <p className="text-xs text-ink-muted">{s.category}</p>
                      </div>
                      <span className="text-sm font-medium text-ink">{money(s.priceIndustry)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
