import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { fetchServices, fetchInstruments, fetchFacilities } from "@/lib/queries";
import { post, patch, del } from "@/lib/api";
import type { Service, PricingMethod, PricingMode } from "@/lib/types";
import { money } from "@/lib/format";
import { ImageUploader } from "@/components/ImageUploader";
import {
  PageHeader, Card, CardBody, Table, Button, Modal, Badge,
  Field, Input, Textarea, Select, LoadingBlock, EmptyState, ErrorState, useToast,
} from "@/components/ui";

const PRICING_METHODS: { value: PricingMethod; label: string }[] = [
  { value: "FLAT", label: "Flat" },
  { value: "PER_HOUR", label: "Per hour" },
  { value: "PER_SAMPLE", label: "Per sample" },
  { value: "PER_TEST", label: "Per test" },
  { value: "PER_DAY", label: "Per day" },
  { value: "PER_UNIT", label: "Per unit" },
  { value: "TIERED", label: "Tiered" },
];

interface FormState {
  name: string; category: string; description: string; deliverable: string;
  turnaroundDays: string; priceInternal: string; priceAcademic: string; priceIndustry: string;
  pricingMethod: PricingMethod; pricingMode: PricingMode; unitLabel: string; setupFee: string; minCharge: string;
  accreditation: string; instrumentId: string; facilityId: string; isActive: boolean;
}
const EMPTY: FormState = {
  name: "", category: "", description: "", deliverable: "", turnaroundDays: "",
  priceInternal: "", priceAcademic: "", priceIndustry: "",
  pricingMethod: "FLAT", pricingMode: "QUOTE", unitLabel: "", setupFee: "", minCharge: "",
  accreditation: "", instrumentId: "", facilityId: "", isActive: true,
};

export default function AdminServices() {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [images, setImages] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<Service | null>(null);

  const { data, isLoading, isError, error } = useQuery({ queryKey: ["services"], queryFn: () => fetchServices() });
  const instrumentsQ = useQuery({ queryKey: ["instruments"], queryFn: () => fetchInstruments() });
  const facilitiesQ = useQuery({ queryKey: ["facilities"], queryFn: fetchFacilities });
  const services = data ?? [];
  const instruments = instrumentsQ.data ?? [];
  const facilities = facilitiesQ.data ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["services"] });

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        name: form.name, category: form.category,
        description: form.description || undefined,
        deliverable: form.deliverable || undefined,
        turnaroundDays: Number(form.turnaroundDays) || 0,
        priceInternal: Number(form.priceInternal) || 0,
        priceAcademic: Number(form.priceAcademic) || 0,
        priceIndustry: Number(form.priceIndustry) || 0,
        pricingMethod: form.pricingMethod,
        pricingMode: form.pricingMode,
        unitLabel: form.unitLabel || undefined,
        setupFee: Number(form.setupFee) || 0,
        minCharge: Number(form.minCharge) || 0,
        accreditation: form.accreditation || undefined,
        instrumentId: form.instrumentId || undefined,
        facilityId: form.facilityId || null,
        isActive: form.isActive,
        images,
      };
      return editing ? patch(`/services/${editing.id}`, body) : post("/services", body);
    },
    onSuccess: () => {
      toast.push("success", editing ? "Service updated." : "Service created.");
      setModalOpen(false); invalidate();
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not save service."),
  });

  const toggle = useMutation({
    mutationFn: (svc: Service) => patch(`/services/${svc.id}`, { isActive: !svc.isActive }),
    onSuccess: () => { toast.push("success", "Service updated."); invalidate(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not update."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del(`/services/${id}`),
    onSuccess: () => { toast.push("success", "Service deleted."); setConfirm(null); invalidate(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not delete."),
  });

  function openCreate() { setEditing(null); setForm(EMPTY); setImages([]); setModalOpen(true); }
  function openEdit(s: Service) {
    setEditing(s);
    setForm({
      name: s.name, category: s.category, description: s.description || "",
      deliverable: s.deliverable || "", turnaroundDays: String(s.turnaroundDays ?? ""),
      priceInternal: String(s.priceInternal ?? ""), priceAcademic: String(s.priceAcademic ?? ""),
      priceIndustry: String(s.priceIndustry ?? ""),
      pricingMethod: s.pricingMethod ?? "FLAT", pricingMode: s.pricingMode ?? "QUOTE", unitLabel: s.unitLabel ?? "",
      setupFee: String(s.setupFee ?? ""), minCharge: String(s.minCharge ?? ""),
      accreditation: s.accreditation || "",
      instrumentId: s.instrumentId || "", facilityId: s.facilityId || "", isActive: s.isActive,
    });
    setImages(s.images ?? []);
    setModalOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Testing services"
        subtitle="Your catalog offered on the exchange, with tiered pricing."
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add service</Button>}
      />

      <Card>
        {isLoading ? (
          <LoadingBlock />
        ) : isError ? (
          <ErrorState error={error} />
        ) : services.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title="No services yet"
              description="Add a service with tiered pricing to list it on the exchange."
              action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add service</Button>}
            />
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="th">Service</th>
                <th className="th">Category</th>
                <th className="th">Mode</th>
                <th className="th text-right">Internal</th>
                <th className="th text-right">Academic</th>
                <th className="th text-right">Industry</th>
                <th className="th text-right">TAT</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="hover:bg-surface-subtle">
                  <td className="td font-medium"><button onClick={() => nav(`/admin/services/${s.id}`)} className="text-left text-ink hover:text-brand-700">{s.name}</button></td>
                  <td className="td">{s.category}</td>
                  <td className="td">
                    <Badge tone={s.pricingMode === "FIXED" ? "brand" : "gray"}>
                      {s.pricingMode === "FIXED" ? "Fixed" : "RFQ"}
                    </Badge>
                  </td>
                  <td className="td text-right">{money(s.priceInternal)}</td>
                  <td className="td text-right">{money(s.priceAcademic)}</td>
                  <td className="td text-right font-medium text-ink">{money(s.priceIndustry)}</td>
                  <td className="td text-right">{s.turnaroundDays}d</td>
                  <td className="td">
                    <button onClick={() => toggle.mutate(s)}>
                      <Badge tone={s.isActive ? "success" : "gray"}>{s.isActive ? "Active" : "Inactive"}</Badge>
                    </button>
                  </td>
                  <td className="td">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" className="btn-sm" onClick={() => nav(`/admin/services/${s.id}`)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" className="btn-sm text-danger" onClick={() => setConfirm(s)}><Trash2 className="h-4 w-4" /></Button>
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
        title={editing ? "Edit service" : "Add service"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              loading={save.isPending}
              disabled={!form.name.trim() || !form.category.trim() || !form.turnaroundDays}
              onClick={() => save.mutate()}
            >
              {editing ? "Save changes" : "Create service"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <ImageUploader images={images} onChange={setImages} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tensile testing (metals)" />
            </Field>
          </div>
          <Field label="Category" hint="Machine/technique type (e.g. UTM, SEM, CNC) - buyers, tests & technologies match on this">
            <Input list="svc-cats" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. UTM, SEM, CNC" />
            <datalist id="svc-cats">
              {[...new Set(instruments.map((i) => i.category))].filter(Boolean).map((c) => <option key={c} value={c} />)}
            </datalist>
          </Field>
          <Field label="Accreditation" hint="Optional">
            <Input value={form.accreditation} onChange={(e) => setForm({ ...form, accreditation: e.target.value })} placeholder="NABL / ISO 17025" />
          </Field>
          <Field label="Turnaround (days)">
            <Input type="number" min={0} value={form.turnaroundDays} onChange={(e) => setForm({ ...form, turnaroundDays: e.target.value })} />
          </Field>
          <Field label="Instrument / machine" hint="Link the machine this service runs on to enable live availability, scheduling & capacity reservation">
            <Select value={form.instrumentId} onChange={(e) => {
              const inst = instruments.find((i) => i.id === e.target.value);
              setForm({
                ...form,
                instrumentId: e.target.value,
                category: inst?.category || form.category,
                // Follow the instrument's facility so the service is managed by that lab.
                facilityId: inst?.facilityId || form.facilityId,
              });
            }}>
              <option value="">None (no capacity scheduling)</option>
              {instruments.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.category})</option>)}
            </Select>
          </Field>
          <Field label="Facility / lab" hint="The lab that runs this service. Defaults to the instrument's facility.">
            <Select value={form.facilityId} onChange={(e) => setForm({ ...form, facilityId: e.target.value })}>
              <option value="">Institution-wide (no specific lab)</option>
              {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}{f.department ? ` · ${f.department}` : ""}</option>)}
            </Select>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Order mode" hint="Request for Quote sends an RFQ; Fixed price lets buyers order and pay directly.">
              <Select value={form.pricingMode} onChange={(e) => setForm({ ...form, pricingMode: e.target.value as PricingMode })}>
                <option value="QUOTE">Request for Quote</option>
                <option value="FIXED">Fixed price</option>
              </Select>
            </Field>
          </div>

          <div className="sm:col-span-2 rounded-lg border border-surface-border p-4">
            <p className="label mb-3">Rate card</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Pricing method">
                <Select value={form.pricingMethod} onChange={(e) => setForm({ ...form, pricingMethod: e.target.value as PricingMethod })}>
                  {PRICING_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </Select>
              </Field>
              <Field label="Unit label" hint="e.g. per sample, per hour">
                <Input value={form.unitLabel} onChange={(e) => setForm({ ...form, unitLabel: e.target.value })} placeholder="per sample" />
              </Field>
            </div>
            <p className="label mt-4 mb-2">Tiered prices</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Internal">
                <Input type="number" min={0} value={form.priceInternal} onChange={(e) => setForm({ ...form, priceInternal: e.target.value })} />
              </Field>
              <Field label="Academic">
                <Input type="number" min={0} value={form.priceAcademic} onChange={(e) => setForm({ ...form, priceAcademic: e.target.value })} />
              </Field>
              <Field label="Industry">
                <Input type="number" min={0} value={form.priceIndustry} onChange={(e) => setForm({ ...form, priceIndustry: e.target.value })} />
              </Field>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Setup fee" hint="One-time, optional">
                <Input type="number" min={0} value={form.setupFee} onChange={(e) => setForm({ ...form, setupFee: e.target.value })} />
              </Field>
              <Field label="Minimum charge" hint="Optional">
                <Input type="number" min={0} value={form.minCharge} onChange={(e) => setForm({ ...form, minCharge: e.target.value })} />
              </Field>
            </div>
          </div>

          <div className="sm:col-span-2">
            <Field label="Deliverable" hint="Optional">
              <Input value={form.deliverable} onChange={(e) => setForm({ ...form, deliverable: e.target.value })} placeholder="PDF report with raw data" />
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
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active (visible on exchange)
          </label>
        </div>
      </Modal>

      <Modal
        open={!!confirm} onClose={() => setConfirm(null)} title="Delete service"
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
