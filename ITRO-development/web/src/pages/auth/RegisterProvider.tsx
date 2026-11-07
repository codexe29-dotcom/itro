import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Field, Input, Select, Button } from "@/components/ui";
import AuthShell from "./AuthShell";

const TYPES: { value: string; label: string }[] = [
  { value: "PRIVATE_RND", label: "Private R&D / Company" },
  { value: "UNIVERSITY", label: "University" },
  { value: "ENGINEERING_COLLEGE", label: "Engineering College" },
  { value: "MEDICAL_COLLEGE", label: "Medical College" },
  { value: "NATIONAL_LAB", label: "National Laboratory" },
  { value: "INCUBATOR", label: "Incubator" },
  { value: "INDUSTRY", label: "Industry" },
];

export default function RegisterProvider() {
  const { registerProvider } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({
    institutionName: "", type: "PRIVATE_RND", city: "", state: "", country: "India",
    contactName: "", email: "", password: "", phone: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!f.institutionName.trim() || !f.contactName.trim() || !f.email.trim() || f.password.length < 6) {
      setError("Please complete all required fields (password ≥ 6 characters).");
      return;
    }
    setSubmitting(true);
    try {
      await registerProvider(f);
      navigate("/admin", { replace: true });
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not create your provider account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="List your facility"
      subtitle="Create a provider account to publish your instruments, testing services and experts on the network."
      footer={<>Looking to buy instead? <Link to="/register" className="font-medium text-brand-700 hover:underline">Create a buyer account</Link></>}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>
        )}

        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Your organization</p>
        <Field label="Provider / institution name">
          <Input value={f.institutionName} onChange={set("institutionName")} placeholder="Acme Testing Labs Pvt. Ltd." />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={f.type} onChange={set("type")}>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="City">
            <Input value={f.city} onChange={set("city")} placeholder="Chennai" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="State / Region">
            <Input value={f.state} onChange={set("state")} placeholder="Tamil Nadu" />
          </Field>
          <Field label="Country">
            <Input value={f.country} onChange={set("country")} />
          </Field>
        </div>

        <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Admin account</p>
        <Field label="Your name">
          <Input value={f.contactName} onChange={set("contactName")} placeholder="Full name" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Work email">
            <Input type="email" autoComplete="email" value={f.email} onChange={set("email")} placeholder="you@company.com" />
          </Field>
          <Field label="Phone" hint="Optional">
            <Input value={f.phone} onChange={set("phone")} />
          </Field>
        </div>
        <Field label="Password" hint="At least 6 characters">
          <Input type="password" autoComplete="new-password" value={f.password} onChange={set("password")} placeholder="••••••••" />
        </Field>

        <Button type="submit" className="w-full" loading={submitting}>Create provider account</Button>
        <p className="text-center text-xs text-ink-muted">
          You'll land in your admin console to add facilities, instruments, services and experts.
        </p>
      </form>
    </AuthShell>
  );
}
