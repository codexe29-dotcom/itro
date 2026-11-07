import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, ImagePlus, Loader2 } from "lucide-react";
import { patch, uploadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Institution } from "@/lib/types";
import {
  PageHeader, Card, CardBody, Field, Input, Textarea, Button,
  EmptyState, useToast,
} from "@/components/ui";
import MapPicker from "@/components/MapPicker";
import AccreditationManager from "@/components/AccreditationManager";

interface FormState {
  name: string; about: string; logoUrl: string; themeColor: string;
  currency: string; taxRate: string; onExchange: boolean;
  addressLine1: string; addressLine2: string; postalCode: string;
  city: string; state: string; country: string; latitude: string; longitude: string;
}

export default function AdminSettings() {
  const { user, refresh } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const inst = user?.institution as Institution | undefined;

  const [form, setForm] = useState<FormState | null>(null);
  const [accreditations, setAccreditations] = useState<string[]>([]);
  const [accInput, setAccInput] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  async function handleLogoFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.push("error", "Please choose an image file.");
      return;
    }
    setUploadingLogo(true);
    try {
      const { url } = await uploadFile(file);
      setForm((f) => (f ? { ...f, logoUrl: url } : f));
      toast.push("success", "Logo uploaded. Save changes to apply.");
    } catch (e: any) {
      toast.push("error", e?.response?.data?.message || "Logo upload failed.");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  useEffect(() => {
    if (inst) {
      setForm({
        name: inst.name ?? "",
        about: inst.about ?? "",
        logoUrl: inst.logoUrl ?? "",
        themeColor: inst.themeColor ?? "#4f46e5",
        currency: inst.currency ?? "INR",
        taxRate: inst.taxRate != null ? String(inst.taxRate) : "",
        onExchange: !!inst.onExchange,
        addressLine1: inst.addressLine1 ?? "",
        addressLine2: inst.addressLine2 ?? "",
        postalCode: inst.postalCode ?? "",
        city: inst.city ?? "",
        state: inst.state ?? "",
        country: inst.country ?? "India",
        latitude: inst.latitude != null ? String(inst.latitude) : "",
        longitude: inst.longitude != null ? String(inst.longitude) : "",
      });
      setAccreditations(inst.accreditations ?? []);
    }
  }, [inst]);

  const save = useMutation({
    mutationFn: () => patch(`/institutions/${inst!.id}`, {
      name: form!.name,
      about: form!.about || undefined,
      logoUrl: form!.logoUrl || undefined,
      themeColor: form!.themeColor,
      currency: form!.currency,
      taxRate: Number(form!.taxRate) || 0,
      accreditations,
      onExchange: form!.onExchange,
      addressLine1: form!.addressLine1 || undefined,
      addressLine2: form!.addressLine2 || undefined,
      postalCode: form!.postalCode || undefined,
      city: form!.city || undefined,
      state: form!.state || undefined,
      country: form!.country || undefined,
      latitude: form!.latitude ? Number(form!.latitude) : undefined,
      longitude: form!.longitude ? Number(form!.longitude) : undefined,
    }),
    onSuccess: async () => {
      toast.push("success", "Settings saved.");
      qc.invalidateQueries({ queryKey: ["config"] });
      qc.invalidateQueries({ queryKey: ["provider-setup"] });
      await refresh(); // pull the fresh institution into auth state so the form reflects the save
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not save settings."),
  });

  if (!inst || !form) {
    return (
      <div>
        <PageHeader title="Settings" />
        <Card><CardBody><EmptyState title="No institution" description="Your account isn't linked to an institution." /></CardBody></Card>
      </div>
    );
  }

  function addAcc() {
    const v = accInput.trim();
    if (v && !accreditations.includes(v)) setAccreditations([...accreditations, v]);
    setAccInput("");
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Branding and configuration for your institution."
        actions={<Button loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody className="space-y-4">
            <h2 className="section-title">Profile</h2>
            <Field label="Institution name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="About" hint="Shown on your public profile">
              <Textarea rows={4} value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} />
            </Field>
            <Field label="Logo" hint="Upload an image (PNG/JPG, up to 6MB) or paste an image URL - shown on your public profile and console.">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-surface-border bg-surface-muted">
                    {form.logoUrl
                      ? <img src={form.logoUrl} alt="Logo preview" className="h-full w-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
                      : <span className="text-xs font-semibold text-ink-faint">{(form.name || "?").slice(0, 2).toUpperCase()}</span>}
                  </span>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLogoFile(e.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="btn-sm"
                    disabled={uploadingLogo}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    {uploadingLogo ? "Uploading…" : "Upload logo"}
                  </Button>
                </div>
                <Input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="…or paste an image URL (https://…)" />
              </div>
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4">
            <h2 className="section-title">Branding & commerce</h2>
            <Field label="Theme color">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.themeColor}
                  onChange={(e) => setForm({ ...form, themeColor: e.target.value })}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-surface-border"
                />
                <Input value={form.themeColor} onChange={(e) => setForm({ ...form, themeColor: e.target.value })} className="w-40" />
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Currency">
                <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} placeholder="INR" />
              </Field>
              <Field label="Tax rate" hint="Decimal, e.g. 0.18 = 18%">
                <Input type="number" step="0.01" min={0} value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox" className="h-4 w-4 rounded border-surface-border"
                checked={form.onExchange}
                onChange={(e) => setForm({ ...form, onExchange: e.target.checked })}
              />
              Publish on the public exchange
            </label>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardBody className="space-y-4">
            <h2 className="section-title">Location</h2>
            <p className="text-sm text-ink-muted">
              Shown to buyers on your public profile - powers distance-based search and directions.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Address line 1"><Input value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} placeholder="Street / building" /></Field>
              <Field label="Address line 2" hint="Optional"><Input value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} placeholder="Area / landmark" /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
              <Field label="State / Region"><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></Field>
              <Field label="Postal code"><Input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} placeholder="411001" /></Field>
              <Field label="Country"><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Field>
            </div>
            <Field label="Pin location" hint="Click the map or drag the marker to set precise coordinates.">
              <MapPicker
                lat={form.latitude ? Number(form.latitude) : undefined}
                lng={form.longitude ? Number(form.longitude) : undefined}
                onChange={(lat, lng) => setForm((f) => (f ? { ...f, latitude: String(lat), longitude: String(lng) } : f))}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Latitude" hint="e.g. 13.0827">
                <Input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="13.0827" />
              </Field>
              <Field label="Longitude" hint="e.g. 80.2707">
                <Input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="80.2707" />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([form.name, form.addressLine1, form.city, form.state, form.country].filter(Boolean).join(", "))}`}
                target="_blank" rel="noreferrer" className="btn-secondary btn-sm"
              >
                Find coordinates on Google Maps
              </a>
              {form.latitude && form.longitude && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${form.latitude},${form.longitude}`}
                  target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-700 hover:underline"
                >
                  Get directions →
                </a>
              )}
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardBody className="space-y-4">
            <div>
              <h2 className="section-title">Accreditation tags</h2>
              <p className="text-sm text-ink-muted">Quick badges shown on your profile. For scope, validity &amp; verification, use the certificates section below.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {accreditations.length === 0 && <p className="text-sm text-ink-muted">No accreditation tags added yet.</p>}
              {accreditations.map((a) => (
                <span key={a} className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-sm font-medium text-success">
                  {a}
                  <button onClick={() => setAccreditations(accreditations.filter((x) => x !== a))}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={accInput}
                onChange={(e) => setAccInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAcc(); } }}
                placeholder="e.g. NABL, ISO 17025"
                className="max-w-xs"
              />
              <Button variant="secondary" onClick={addAcc}>Add</Button>
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardBody className="space-y-4">
            <div>
              <h2 className="section-title">Accreditation certificates</h2>
              <p className="text-sm text-ink-muted">Scope-verified accreditations buyers can see and verify. Status (active / expiring / expired) is derived from the validity date.</p>
            </div>
            {inst && <AccreditationManager institutionId={inst.id} />}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
