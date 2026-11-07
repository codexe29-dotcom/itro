import crypto from "crypto";
import { getIntegrationConfig } from "./integrations";

export async function razorpayConfigured() {
  const c = await getIntegrationConfig();
  return !!(c.razorpayEnabled && c.razorpayKeyId && c.razorpayKeySecret);
}

/** Create a Razorpay order. amountPaise = amount in the smallest currency unit (paise). */
export async function createRazorpayOrder(amountPaise: number, currency: string, receipt: string) {
  const c = await getIntegrationConfig();
  if (!c.razorpayEnabled || !c.razorpayKeyId || !c.razorpayKeySecret) throw new Error("Razorpay is not configured");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${c.razorpayKeyId}:${c.razorpayKeySecret}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount: amountPaise, currency, receipt, payment_capture: 1 }),
  });
  if (!res.ok) throw new Error(`Razorpay ${res.status}: ${await res.text()}`);
  const order = (await res.json()) as { id: string; amount: number; currency: string };
  return { orderId: order.id, keyId: c.razorpayKeyId, amount: order.amount, currency: order.currency };
}

/** Verify the checkout signature returned by Razorpay's client SDK. */
export async function verifyRazorpaySignature(razorpayOrderId: string, razorpayPaymentId: string, signature: string) {
  const c = await getIntegrationConfig();
  if (!c.razorpayKeySecret) return false;
  const expected = crypto.createHmac("sha256", c.razorpayKeySecret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
