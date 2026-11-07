import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Mail, MessageCircle } from "lucide-react";
import { fetchIntegrations, updateIntegrations } from "@/lib/queries";
import { PageHeader, Card, CardBody, Field, Input, Button, LoadingBlock, useToast } from "@/components/ui";

type Form = {
  razorpayEnabled: boolean; razorpayKeyId: string; razorpayKeySecret: string;
  emailEnabled: boolean; smtpHost: string; smtpPort: string; smtpUser: string; smtpPass: string; emailFrom: string;
  whatsappEnabled: boolean; twilioSid: string; twilioToken: string; twilioFrom: string;
};
const secretPh = (set: boolean) => (set ? "•••••••• (configured — leave blank to keep)" : "");

export default function PlatformIntegrations() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data } = useQuery({ queryKey: ["integrations"], queryFn: fetchIntegrations });
  const [f, setF] = useState<Form | null>(null);
  const [has, setHas] = useState({ secret: false, smtp: false, twilio: false });

  useEffect(() => {
    if (data && !f) {
      setF({
        razorpayEnabled: data.razorpayEnabled, razorpayKeyId: data.razorpayKeyId, razorpayKeySecret: "",
        emailEnabled: data.emailEnabled, smtpHost: data.smtpHost, smtpPort: String(data.smtpPort ?? 587), smtpUser: data.smtpUser, smtpPass: "", emailFrom: data.emailFrom,
        whatsappEnabled: data.whatsappEnabled, twilioSid: data.twilioSid, twilioToken: "", twilioFrom: data.twilioFrom,
      });
      setHas({ secret: data.hasRazorpaySecret, smtp: data.hasSmtpPass, twilio: data.hasTwilioToken });
    }
  }, [data, f]);

  const save = useMutation({
    mutationFn: () => updateIntegrations({
      razorpayEnabled: f!.razorpayEnabled, razorpayKeyId: f!.razorpayKeyId, ...(f!.razorpayKeySecret ? { razorpayKeySecret: f!.razorpayKeySecret } : {}),
      emailEnabled: f!.emailEnabled, smtpHost: f!.smtpHost, smtpPort: Number(f!.smtpPort) || 587, smtpUser: f!.smtpUser, emailFrom: f!.emailFrom, ...(f!.smtpPass ? { smtpPass: f!.smtpPass } : {}),
      whatsappEnabled: f!.whatsappEnabled, twilioSid: f!.twilioSid, twilioFrom: f!.twilioFrom, ...(f!.twilioToken ? { twilioToken: f!.twilioToken } : {}),
    }),
    onSuccess: () => { toast.push("success", "Integrations saved."); qc.invalidateQueries({ queryKey: ["integrations"] }); qc.invalidateQueries({ queryKey: ["payment-status"] }); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not save."),
  });

  if (!f) return <div className="mx-auto max-w-4xl px-4 py-8"><LoadingBlock /></div>;
  const set = (p: Partial<Form>) => setF({ ...f, ...p });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Integrations" subtitle="Configure the payment gateway and notifications. Once keys are saved, they start working automatically." actions={<Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button>} />

      <div className="space-y-6">
        {/* Payment */}
        <Card><CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title flex items-center gap-2"><CreditCard className="h-4 w-4 text-brand-600" /> Payment gateway — Razorpay</h2>
            <Toggle on={f.razorpayEnabled} onChange={(v) => set({ razorpayEnabled: v })} />
          </div>
          <p className="text-sm text-ink-muted">Buyers pay online at checkout. When off, the platform uses manual/simulated payment.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Key ID"><Input value={f.razorpayKeyId} onChange={(e) => set({ razorpayKeyId: e.target.value })} placeholder="rzp_live_..." /></Field>
            <Field label="Key secret"><Input type="password" value={f.razorpayKeySecret} onChange={(e) => set({ razorpayKeySecret: e.target.value })} placeholder={secretPh(has.secret)} /></Field>
          </div>
        </CardBody></Card>

        {/* Email */}
        <Card><CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title flex items-center gap-2"><Mail className="h-4 w-4 text-brand-600" /> Email notifications — SMTP</h2>
            <Toggle on={f.emailEnabled} onChange={(v) => set({ emailEnabled: v })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SMTP host"><Input value={f.smtpHost} onChange={(e) => set({ smtpHost: e.target.value })} placeholder="smtp.gmail.com" /></Field>
            <Field label="SMTP port"><Input type="number" value={f.smtpPort} onChange={(e) => set({ smtpPort: e.target.value })} placeholder="587" /></Field>
            <Field label="Username"><Input value={f.smtpUser} onChange={(e) => set({ smtpUser: e.target.value })} placeholder="user@domain.com" /></Field>
            <Field label="Password / app key"><Input type="password" value={f.smtpPass} onChange={(e) => set({ smtpPass: e.target.value })} placeholder={secretPh(has.smtp)} /></Field>
            <Field label="From address"><Input value={f.emailFrom} onChange={(e) => set({ emailFrom: e.target.value })} placeholder="ITRO <info@adart.in>" /></Field>
          </div>
        </CardBody></Card>

        {/* WhatsApp */}
        <Card><CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title flex items-center gap-2"><MessageCircle className="h-4 w-4 text-brand-600" /> WhatsApp notifications — Twilio</h2>
            <Toggle on={f.whatsappEnabled} onChange={(v) => set({ whatsappEnabled: v })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Account SID"><Input value={f.twilioSid} onChange={(e) => set({ twilioSid: e.target.value })} placeholder="AC..." /></Field>
            <Field label="Auth token"><Input type="password" value={f.twilioToken} onChange={(e) => set({ twilioToken: e.target.value })} placeholder={secretPh(has.twilio)} /></Field>
            <Field label="From (WhatsApp)"><Input value={f.twilioFrom} onChange={(e) => set({ twilioFrom: e.target.value })} placeholder="whatsapp:+14155238886" /></Field>
          </div>
        </CardBody></Card>
      </div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={`relative h-6 w-11 rounded-full transition ${on ? "bg-brand-600" : "bg-surface-border"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}
