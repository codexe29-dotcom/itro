import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, UserCog } from "lucide-react";
import { fetchExperts } from "@/lib/queries";
import { post, patch, del } from "@/lib/api";
import { ImageUploader } from "@/components/ImageUploader";
import type { Expert, RatePeriod } from "@/lib/types";
import { money } from "@/lib/format";
import {
  PageHeader, Card, CardBody, Table, Button, Modal, Badge,
  Field, Input, Textarea, Select, LoadingBlock, EmptyState, ErrorState, useToast,
} from "@/components/ui";

const RATE_PERIODS: RatePeriod[] = ["HOURLY", "DAILY", "PROJECT"];
const RATE_LABEL: Record<RatePeriod, string> = { HOURLY: "/ hr", DAILY: "/ day", PROJECT: "/ project" };

interface FormState {
  name: string; title: string; photoUrl: string; bio: string;
  expertise: string; skills: string; experienceYears: string;
  ratePeriod: RatePeriod; rate: string; availability: string;
  certifications: string; isActive: boolean;
}
const EMPTY: FormState = {
  name: "", title: "", photoUrl: "", bio: "", expertise: "", skills: "",
  experienceYears: "", ratePeriod: "HOURLY", rate: "", availability: "",
  certifications: "", isActive: true,
};

/** Split a comma-separated field into a trimmed, de-duped array. */
function toList(v: string): string[] {
  return Array.from(new Set(v.split(",").map((s) => s.trim()).filter(Boolean)));
}

export default function AdminExperts() {
  const qc = useQueryClient();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expert | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [confirm, setConfirm] = useState<Expert | null>(null);
  const [fQuery, setFQuery] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["experts", { fQuery }],
    queryFn: () => fetchExperts({ q: fQuery || undefined }),
  });
  const experts = data ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["experts"] });

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        title: form.title.trim(),
        photoUrl: form.photoUrl || undefined,
        bio: form.bio || undefined,
        expertise: toList(form.expertise),
        skills: toList(form.skills),
        experienceYears: form.experienceYears ? Number(form.experienceYears) : undefined,
        ratePeriod: form.ratePeriod,
        rate: Number(form.rate) || 0,
        availability: form.availability || undefined,
        certifications: toList(form.certifications),
        isActive: form.isActive,
      };
      return editing
        ? patch<Expert>(`/experts/${editing.id}`, body)
        : post<Expert>("/experts", body);
    },
    onSuccess: () => {
      toast.push("success", editing ? "Expert updated." : "Expert added.");
      setModalOpen(false); invalidate();
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not save expert."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del(`/experts/${id}`),
    onSuccess: () => { toast.push("success", "Expert removed."); setConfirm(null); invalidate(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not delete."),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  }
  function openEdit(x: Expert) {
    setEditing(x);
    setForm({
      name: x.name, title: x.title, photoUrl: x.photoUrl || "", bio: x.bio || "",
      expertise: (x.expertise ?? []).join(", "), skills: (x.skills ?? []).join(", "),
      experienceYears: x.experienceYears != null ? String(x.experienceYears) : "",
      ratePeriod: x.ratePeriod, rate: String(x.rate ?? ""),
      availability: x.availability || "", certifications: (x.certifications ?? []).join(", "),
      isActive: x.isActive,
    });
    setModalOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Skilled Resources"
        subtitle="Your bench of researchers, technicians and consultants available to buyers."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add expert
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-surface-border px-5 py-3">
          <div className="w-64">
            <Input
              value={fQuery}
              onChange={(e) => setFQuery(e.target.value)}
              placeholder="Search by name or role…"
            />
          </div>
        </div>

        {isLoading ? (
          <LoadingBlock />
        ) : isError ? (
          <ErrorState error={error} />
        ) : experts.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={<UserCog className="h-6 w-6" />}
              title="No experts yet"
              description="Add skilled people so buyers can discover and engage them alongside your instruments and services."
            />
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="th">Expert</th>
                <th className="th">Expertise</th>
                <th className="th">Experience</th>
                <th className="th text-right">Rate</th>
                <th className="th">Active</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {experts.map((x) => (
                <tr key={x.id} className="hover:bg-surface-subtle">
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-muted text-ink-faint">
                        {x.photoUrl ? <img src={x.photoUrl} alt="" className="h-full w-full object-cover" /> : <UserCog className="h-4 w-4" />}
                      </span>
                      <div>
                        <p className="font-medium text-ink">{x.name}</p>
                        <p className="text-xs text-ink-muted">{x.title}</p>
                      </div>
                    </div>
                  </td>
                  <td className="td">
                    {x.expertise && x.expertise.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {x.expertise.slice(0, 3).map((e) => (
                          <span key={e} className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{e}</span>
                        ))}
                        {x.expertise.length > 3 && <span className="text-xs text-ink-muted">+{x.expertise.length - 3}</span>}
                      </div>
                    ) : <span className="text-ink-faint">-</span>}
                  </td>
                  <td className="td">{x.experienceYears != null ? `${x.experienceYears} yrs` : "-"}</td>
                  <td className="td text-right">
                    {x.rate ? <span>{money(x.rate)} <span className="text-xs text-ink-muted">{RATE_LABEL[x.ratePeriod]}</span></span> : "-"}
                  </td>
                  <td className="td"><Badge tone={x.isActive ? "brand" : "gray"}>{x.isActive ? "Active" : "Hidden"}</Badge></td>
                  <td className="td">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" className="btn-sm" title="Edit" onClick={() => openEdit(x)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" className="btn-sm text-danger" onClick={() => setConfirm(x)}><Trash2 className="h-4 w-4" /></Button>
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
        title={editing ? "Edit expert" : "Add expert"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              loading={save.isPending}
              disabled={!form.name.trim() || !form.title.trim()}
              onClick={() => save.mutate()}
            >
              {editing ? "Save changes" : "Add expert"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dr. Anita Rao" />
          </Field>
          <Field label="Title / role">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Senior Materials Scientist" />
          </Field>

          <div className="sm:col-span-2">
            <ImageUploader
              label="Photo"
              hint="Upload a headshot. The first image is used as the profile photo."
              images={form.photoUrl ? [form.photoUrl] : []}
              onChange={(next) => setForm({ ...form, photoUrl: next[0] ?? "" })}
            />
          </div>

          <div className="sm:col-span-2">
            <Field label="Bio" hint="Optional">
              <Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Short professional summary." />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Expertise areas" hint="Comma-separated, e.g. Failure analysis, Fractography">
              <Input value={form.expertise} onChange={(e) => setForm({ ...form, expertise: e.target.value })} placeholder="Failure analysis, Fractography" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Skills" hint="Comma-separated, e.g. SEM, EDS">
              <Input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="SEM, EDS, Metallography" />
            </Field>
          </div>

          <Field label="Experience (years)" hint="Optional">
            <Input type="number" min={0} value={form.experienceYears} onChange={(e) => setForm({ ...form, experienceYears: e.target.value })} />
          </Field>
          <Field label="Availability" hint="Optional">
            <Input value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })} placeholder="On request" />
          </Field>

          <Field label="Rate period">
            <Select value={form.ratePeriod} onChange={(e) => setForm({ ...form, ratePeriod: e.target.value as RatePeriod })}>
              {RATE_PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="Rate">
            <Input type="number" min={0} value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Certifications" hint="Comma-separated, e.g. ASNT NDT Level II">
              <Input value={form.certifications} onChange={(e) => setForm({ ...form, certifications: e.target.value })} placeholder="ASNT NDT Level II" />
            </Field>
          </div>

          <label className="sm:col-span-2 flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox" className="h-4 w-4 rounded border-surface-border"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active (visible to buyers on the exchange)
          </label>
        </div>
      </Modal>

      <Modal
        open={!!confirm} onClose={() => setConfirm(null)} title="Remove expert"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => confirm && remove.mutate(confirm.id)}>Remove</Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          Remove <span className="font-semibold">{confirm?.name}</span>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
