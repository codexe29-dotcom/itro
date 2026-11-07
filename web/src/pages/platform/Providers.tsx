import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Building2, ArrowRight, Search, Star } from "lucide-react";
import { fetchPlatformProviders } from "@/lib/queries";
import { post, patch } from "@/lib/api";
import { uploadFile } from "@/lib/api";
import { useConfig } from "@/lib/useConfig";
import { money } from "@/lib/format";
import type { Institution, ProviderRow } from "@/lib/types";
import {
  PageHeader, Card, CardBody, Table, Badge, Button, Modal,
  Field, Input, Select, Textarea, LoadingBlock, EmptyState, ErrorState, useToast,
} from "@/components/ui";
import MapPicker from "@/components/MapPicker";
import { useSort, cmp, SortHead } from "@/components/tableControls";

type ProvSortKey = "name" | "type" | "location" | "services" | "revenue" | "rating" | "status";

const TYPES = [
  "UNIVERSITY", "ENGINEERING_COLLEGE", "MEDICAL_COLLEGE",
  "NATIONAL_LAB", "PRIVATE_RND", "INCUBATOR", "INDUSTRY",
] as const;

const typeLabel = (t: string) =>
  t.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

interface CreateForm {
  name: string; slug: string; type: string; city: string; state: string;
  country: string; currency: string;
}
const EMPTY_CREATE: CreateForm = {
  name: "", slug: "", type: "UNIVERSITY", city: "", state: "",
  country: "India", currency: "INR",
};

interface EditForm {
  name: string; type: string;
  addressLine1: string; addressLine2: string; postalCode: string;
  city: string; state: string; country: string;
  latitude: string; longitude: string;
  about: string; logoUrl: string; themeColor: string; currency: string;
  taxRate: string; accreditations: string; isPublished: boolean; onExchange: boolean;
  feeMode: string; feeValue: string;
}

export default function PlatformProviders() {
  const qc = useQueryClient();
  const toast = useToast();
  const { config } = useConfig();
  const currency = config.defaultCurrency;
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [editing, setEditing] = useState<ProviderRow | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["platform-providers", search],
    queryFn: () => fetchPlatformProviders(search || undefined),
  });
  const providers = data ?? [];

  const { sortKey, sortDir, toggle } = useSort<ProvSortKey>("name", "asc");
  const rows = useMemo(() => {
    const val = (p: ProviderRow): string | number => {
      switch (sortKey) {
        case "name": return p.name;
        case "type": return p.type;
        case "location": return p.city ?? "";
        case "services": return p.counts.services;
        case "revenue": return p.revenue;
        case "rating": return p.avgRating ?? -1;
        case "status": return p.isPublished ? 1 : 0;
      }
    };
    return [...providers].sort((a, b) => cmp(val(a), val(b), sortDir));
  }, [providers, sortKey, sortDir]);

  const create = useMutation({
    mutationFn: () => post<Institution>("/institutions", {
      name: createForm.name.trim(),
      slug: createForm.slug.trim() || slugify(createForm.name),
      type: createForm.type,
      city: createForm.city || undefined,
      state: createForm.state || undefined,
      country: createForm.country || undefined,
      currency: createForm.currency || undefined,
    }),
    onSuccess: () => {
      toast.push("success", "Provider created.");
      setCreateOpen(false); setCreateForm(EMPTY_CREATE);
      qc.invalidateQueries({ queryKey: ["platform-providers"] });
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not create provider."),
  });

  const update = useMutation({
    mutationFn: () => patch<Institution>(`/institutions/${editing!.id}`, {
      name: editForm!.name.trim(),
      type: editForm!.type,
      addressLine1: editForm!.addressLine1 || undefined,
      addressLine2: editForm!.addressLine2 || undefined,
      postalCode: editForm!.postalCode || undefined,
      city: editForm!.city || undefined,
      state: editForm!.state || undefined,
      country: editForm!.country || undefined,
      latitude: editForm!.latitude ? Number(editForm!.latitude) : undefined,
      longitude: editForm!.longitude ? Number(editForm!.longitude) : undefined,
      about: editForm!.about || undefined,
      logoUrl: editForm!.logoUrl || undefined,
      themeColor: editForm!.themeColor || undefined,
      currency: editForm!.currency || undefined,
      taxRate: editForm!.taxRate !== "" ? Number(editForm!.taxRate) : undefined,
      accreditations: editForm!.accreditations
        ? editForm!.accreditations.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      isPublished: editForm!.isPublished,
      onExchange: editForm!.onExchange,
      feeMode: editForm!.feeMode ? editForm!.feeMode : null,
      feeValue: editForm!.feeMode && editForm!.feeValue !== "" ? Number(editForm!.feeValue) : null,
    }),
    onSuccess: () => {
      toast.push("success", "Provider updated.");
      setEditing(null); setEditForm(null);
      qc.invalidateQueries({ queryKey: ["platform-providers"] });
      qc.invalidateQueries({ queryKey: ["platform-provider"] });
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not update provider."),
  });

  function openEdit(p: ProviderRow) {
    setEditing(p);
    setEditForm({
      name: p.name, type: p.type,
      addressLine1: p.addressLine1 ?? "", addressLine2: p.addressLine2 ?? "",
      postalCode: p.postalCode ?? "",
      city: p.city ?? "", state: p.state ?? "", country: p.country ?? "",
      latitude: p.latitude != null ? String(p.latitude) : "",
      longitude: p.longitude != null ? String(p.longitude) : "",
      about: p.about ?? "", logoUrl: p.logoUrl ?? "",
      themeColor: p.themeColor ?? "", currency: p.currency ?? "",
      taxRate: p.taxRate != null ? String(p.taxRate) : "",
      accreditations: (p.accreditations ?? []).join(", "),
      isPublished: p.isPublished, onExchange: p.onExchange,
      feeMode: p.feeMode ?? "", feeValue: p.feeValue != null ? String(p.feeValue) : "",
    });
  }

  async function handleLogo(file: File | null) {
    if (!file || !editForm) return;
    setUploading(true);
    try {
      const { url } = await uploadFile(file);
      setEditForm({ ...editForm, logoUrl: url });
      toast.push("success", "Logo uploaded.");
    } catch (e: any) {
      toast.push("error", e?.response?.data?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Providers"
        subtitle="Every institution on the exchange."
        actions={<Button onClick={() => { setCreateForm(EMPTY_CREATE); setCreateOpen(true); }}><Plus className="h-4 w-4" /> New provider</Button>}
      />

      <form
        className="mb-4 flex max-w-md items-center gap-2"
        onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search providers…" />
        </div>
        <Button type="submit" variant="secondary">Search</Button>
      </form>

      <Card>
        {isLoading ? (
          <LoadingBlock />
        ) : isError ? (
          <ErrorState error={error} />
        ) : providers.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={<Building2 className="h-6 w-6" />}
              title="No providers"
              description="Create the first provider to get the exchange started."
              action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New provider</Button>}
            />
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <SortHead k="name" label="Provider" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortHead k="type" label="Type" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortHead k="location" label="Location" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortHead k="services" label="Services" right sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortHead k="revenue" label="Revenue" right sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortHead k="rating" label="Rating" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortHead k="status" label="Status" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-surface-subtle">
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-brand-50 text-brand-600">
                        {p.logoUrl ? <img src={p.logoUrl} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-4 w-4" />}
                      </span>
                      <div>
                        <Link to={`/platform/providers/${p.id}`} className="font-medium text-ink hover:text-brand-600">{p.name}</Link>
                        <p className="text-xs text-ink-muted">/{p.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="td">{typeLabel(p.type)}</td>
                  <td className="td">{[p.city, p.country].filter(Boolean).join(", ") || "-"}</td>
                  <td className="td text-right">{p.counts.services}</td>
                  <td className="td text-right">{money(p.revenue, currency)}</td>
                  <td className="td">
                    {p.avgRating != null ? (
                      <span className="inline-flex items-center gap-1 text-ink-soft">
                        <Star className="h-3.5 w-3.5 fill-brand-500 text-brand-500" /> {p.avgRating}
                        <span className="text-xs text-ink-faint">({p.reviewCount})</span>
                      </span>
                    ) : "-"}
                  </td>
                  <td className="td">
                    <Badge tone={p.isPublished ? "brand" : "gray"}>{p.isPublished ? "Published" : "Draft"}</Badge>
                    {p.onExchange && <span className="ml-1 text-xs text-ink-faint">On exchange</span>}
                  </td>
                  <td className="td text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button variant="secondary" className="btn-sm" onClick={() => openEdit(p)}>Edit</Button>
                      <Link to={`/platform/providers/${p.id}`} className="btn-ghost btn-sm inline-flex">
                        360 <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* Create modal */}
      <Modal
        wide open={createOpen} onClose={() => setCreateOpen(false)} title="Create provider"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={create.isPending} disabled={!createForm.name.trim()} onClick={() => create.mutate()}>
              Create provider
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Name">
              <Input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
            </Field>
          </div>
          <Field label="Slug" hint="Optional - generated from name if blank">
            <Input value={createForm.slug} onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })} placeholder="central-university" />
          </Field>
          <Field label="Type">
            <Select value={createForm.type} onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}>
              {TYPES.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
            </Select>
          </Field>
          <Field label="City">
            <Input value={createForm.city} onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })} />
          </Field>
          <Field label="State">
            <Input value={createForm.state} onChange={(e) => setCreateForm({ ...createForm, state: e.target.value })} />
          </Field>
          <Field label="Country">
            <Input value={createForm.country} onChange={(e) => setCreateForm({ ...createForm, country: e.target.value })} />
          </Field>
          <Field label="Currency">
            <Input value={createForm.currency} onChange={(e) => setCreateForm({ ...createForm, currency: e.target.value.toUpperCase() })} />
          </Field>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal
        wide open={!!editing} onClose={() => { setEditing(null); setEditForm(null); }} title="Edit provider"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setEditing(null); setEditForm(null); }}>Cancel</Button>
            <Button loading={update.isPending} disabled={!editForm?.name.trim()} onClick={() => update.mutate()}>
              Save changes
            </Button>
          </>
        }
      >
        {editForm && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Name">
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </Field>
            </div>
            <Field label="Type">
              <Select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                {TYPES.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address line 1">
                <Input value={editForm.addressLine1} onChange={(e) => setEditForm({ ...editForm, addressLine1: e.target.value })} placeholder="Street / building" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Address line 2" hint="Optional">
                <Input value={editForm.addressLine2} onChange={(e) => setEditForm({ ...editForm, addressLine2: e.target.value })} placeholder="Area / landmark" />
              </Field>
            </div>
            <Field label="City">
              <Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
            </Field>
            <Field label="State">
              <Input value={editForm.state} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} />
            </Field>
            <Field label="Postal code">
              <Input value={editForm.postalCode} onChange={(e) => setEditForm({ ...editForm, postalCode: e.target.value })} placeholder="411001" />
            </Field>
            <Field label="Country">
              <Input value={editForm.country} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Pin location" hint="Click the map or drag the marker to set coordinates.">
                <MapPicker
                  lat={editForm.latitude ? Number(editForm.latitude) : undefined}
                  lng={editForm.longitude ? Number(editForm.longitude) : undefined}
                  onChange={(lat, lng) => setEditForm((f) => (f ? { ...f, latitude: String(lat), longitude: String(lng) } : f))}
                />
              </Field>
            </div>
            <Field label="Latitude">
              <Input type="number" step="any" value={editForm.latitude} onChange={(e) => setEditForm({ ...editForm, latitude: e.target.value })} placeholder="18.5204" />
            </Field>
            <Field label="Longitude">
              <Input type="number" step="any" value={editForm.longitude} onChange={(e) => setEditForm({ ...editForm, longitude: e.target.value })} placeholder="73.8567" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="About">
                <Textarea rows={3} value={editForm.about} onChange={(e) => setEditForm({ ...editForm, about: e.target.value })} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Logo</label>
              <div className="flex items-center gap-3">
                <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-surface-border bg-surface-muted text-ink-faint">
                  {editForm.logoUrl ? <img src={editForm.logoUrl} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-5 w-5" />}
                </span>
                <label className="btn-secondary btn-sm cursor-pointer">
                  {uploading ? "Uploading…" : "Upload logo"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogo(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              <div className="mt-2">
                <Input value={editForm.logoUrl} onChange={(e) => setEditForm({ ...editForm, logoUrl: e.target.value })} placeholder="…or paste a logo URL" />
              </div>
            </div>
            <Field label="Theme color">
              <Input value={editForm.themeColor} onChange={(e) => setEditForm({ ...editForm, themeColor: e.target.value })} placeholder="#0000ff" />
            </Field>
            <Field label="Currency">
              <Input value={editForm.currency} onChange={(e) => setEditForm({ ...editForm, currency: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Tax rate" hint="Fraction, e.g. 0.18 for 18%">
              <Input type="number" step="0.01" min="0" value={editForm.taxRate} onChange={(e) => setEditForm({ ...editForm, taxRate: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Accreditations" hint="Comma-separated, e.g. NABL, ISO 17025">
                <Input value={editForm.accreditations} onChange={(e) => setEditForm({ ...editForm, accreditations: e.target.value })} />
              </Field>
            </div>
            <div className="sm:col-span-2 rounded-lg border border-surface-border p-4">
              <p className="label mb-1">Platform-fee override</p>
              <p className="mb-3 text-xs text-ink-faint">Leave the mode blank to use the global platform fee.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Fee mode">
                  <Select value={editForm.feeMode} onChange={(e) => setEditForm({ ...editForm, feeMode: e.target.value })}>
                    <option value="">Use global default</option>
                    <option value="MARKUP_PERCENT">Markup %</option>
                    <option value="FIXED_FEE">Fixed fee</option>
                    <option value="SETTLEMENT_DEDUCTION">Deduct from settlement</option>
                  </Select>
                </Field>
                <Field label="Fee value" hint="% for markup/deduction, flat amount for fixed fee">
                  <Input
                    type="number" min="0" step="any"
                    value={editForm.feeValue}
                    disabled={!editForm.feeMode}
                    onChange={(e) => setEditForm({ ...editForm, feeValue: e.target.value })}
                  />
                </Field>
              </div>
            </div>

            <div className="sm:col-span-2 flex flex-wrap gap-6 border-t border-surface-border pt-4">
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input type="checkbox" checked={editForm.isPublished} onChange={(e) => setEditForm({ ...editForm, isPublished: e.target.checked })} />
                Published
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input type="checkbox" checked={editForm.onExchange} onChange={(e) => setEditForm({ ...editForm, onExchange: e.target.checked })} />
                On exchange
              </label>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
