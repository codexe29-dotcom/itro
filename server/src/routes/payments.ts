import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { AppError } from "../http";
import { requireAuth, requireRole, currentUser } from "../middleware/auth";
import { createRazorpayOrder, verifyRazorpaySignature, razorpayConfigured } from "../lib/payments";
import { notify } from "../lib/integrations";

export const paymentsRouter = Router();

// GET /payments/status — is the online gateway configured? (frontend decides the flow)
paymentsRouter.get("/payments/status", async (_req, res) => {
  res.json({ razorpay: await razorpayConfigured() });
});

async function loadPayable(orderId: string, buyerId: string, role: string) {
  const parent = await prisma.order.findUnique({ where: { id: orderId }, include: { lines: { include: { invoice: true } } } });
  if (!parent) throw new AppError(404, "Order not found");
  if (role !== "SUPER_ADMIN" && parent.buyerId !== buyerId) throw new AppError(403, "Not your order");
  const payable = parent.lines.map((l) => l.invoice).filter((inv): inv is NonNullable<typeof inv> => !!inv && inv.status !== "PAID" && inv.status !== "VOID");
  const total = payable.reduce((n, inv) => n + inv.total, 0);
  return { parent, payable, total };
}

// POST /payments/razorpay/order — create a gateway order for an aggregator Order's unpaid invoices
paymentsRouter.post("/payments/razorpay/order", requireAuth, requireRole("INDUSTRY_BUYER"), async (req, res) => {
  const u = currentUser(req);
  const { orderId } = z.object({ orderId: z.string().min(1) }).parse(req.body);
  const { parent, total } = await loadPayable(orderId, u.id, u.role);
  if (total <= 0) throw new AppError(409, "Nothing to pay on this order");
  const rp = await createRazorpayOrder(Math.round(total * 100), parent.currency || "INR", parent.code);
  res.json(rp);
});

// POST /payments/razorpay/verify — verify the signature and mark invoices paid
paymentsRouter.post("/payments/razorpay/verify", requireAuth, requireRole("INDUSTRY_BUYER"), async (req, res) => {
  const u = currentUser(req);
  const b = z.object({
    orderId: z.string().min(1),
    razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string(),
  }).parse(req.body);

  const ok = await verifyRazorpaySignature(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature);
  if (!ok) throw new AppError(400, "Payment verification failed");

  const { parent, payable } = await loadPayable(b.orderId, u.id, u.role);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const inv of payable) {
      const existing = await tx.payment.findUnique({ where: { invoiceId: inv.id } });
      if (!existing) await tx.payment.create({ data: { invoiceId: inv.id, amount: inv.total, method: "razorpay", reference: b.razorpay_payment_id, status: "SUCCESS", paidAt: now } });
      await tx.invoice.update({ where: { id: inv.id }, data: { status: "PAID" } });
      await tx.orderEvent.create({ data: { orderId: inv.orderId, type: "note", message: `Invoice ${inv.number} paid via Razorpay`, actor: u.id } });
    }
  });
  await prisma.auditLog.create({ data: { userId: u.id, action: "pay-razorpay", entity: "Order", entityId: parent.id, meta: { payment: b.razorpay_payment_id } } });

  const buyer = await prisma.user.findUnique({ where: { id: u.id }, select: { email: true, phone: true, name: true } });
  await notify({
    email: buyer?.email, phone: buyer?.phone,
    subject: `Payment received — ${parent.code}`,
    message: `Hi ${buyer?.name ?? "there"}, we've received your payment for order ${parent.code}. Your testing is now confirmed. — ITRO`,
  });
  res.json({ ok: true });
});
