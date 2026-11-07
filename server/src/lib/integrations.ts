import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "../db";

/** The single platform settings row also holds integration config. */
export async function getIntegrationConfig() {
  return prisma.platformSetting.upsert({ where: { id: "global" }, update: {}, create: { id: "global" } });
}

// ---- Email (SMTP via nodemailer) ----
let cachedTransport: Transporter | null = null;
let cachedKey = "";

export async function sendEmail(to: string, subject: string, html: string) {
  const c = await getIntegrationConfig();
  if (!c.emailEnabled || !c.smtpHost || !c.smtpUser) return { skipped: true as const };
  const port = c.smtpPort ?? 587;
  const key = `${c.smtpHost}:${port}:${c.smtpUser}`;
  if (!cachedTransport || cachedKey !== key) {
    cachedTransport = nodemailer.createTransport({
      host: c.smtpHost, port, secure: port === 465,
      auth: { user: c.smtpUser, pass: c.smtpPass ?? "" },
    });
    cachedKey = key;
  }
  await cachedTransport.sendMail({ from: c.emailFrom || c.smtpUser, to, subject, html });
  return { sent: true as const };
}

// ---- WhatsApp (Twilio REST API) ----
export async function sendWhatsApp(toPhone: string, message: string) {
  const c = await getIntegrationConfig();
  if (!c.whatsappEnabled || !c.twilioSid || !c.twilioToken || !c.twilioFrom) return { skipped: true as const };
  const to = toPhone.startsWith("whatsapp:") ? toPhone : `whatsapp:${toPhone}`;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${c.twilioSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${c.twilioSid}:${c.twilioToken}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ From: c.twilioFrom, To: to, Body: message }).toString(),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
  return { sent: true as const };
}

/**
 * Fire-and-forget notification across configured channels. Never throws — a
 * failed notification must not break the business action that triggered it.
 */
export async function notify(opts: { email?: string | null; phone?: string | null; subject: string; message: string; html?: string }) {
  const html = opts.html ?? `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#0f172a">${opts.message}</div>`;
  await Promise.allSettled([
    opts.email ? sendEmail(opts.email, opts.subject, html) : Promise.resolve(),
    opts.phone ? sendWhatsApp(opts.phone, opts.message) : Promise.resolve(),
  ]);
}
