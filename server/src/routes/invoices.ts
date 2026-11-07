import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { AppError, paginate, pageResult, strParam } from "../http";
import { requireAuth, currentUser, type AuthUser } from "../middleware/auth";

export const invoicesRouter = Router();

async function loadInvoiceForActor(id: string, u: AuthUser) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { order: true, payment: true, institution: { select: { id: true, name: true, slug: true } } },
  });
  if (!invoice) throw new AppError(404, "Invoice not found");
  const isBuyer = invoice.order.buyerId === u.id;
  const isInstitution = u.role !== "INDUSTRY_BUYER" && invoice.institutionId === u.institutionId;
  if (u.role !== "SUPER_ADMIN" && !isBuyer && !isInstitution) {
    throw new AppError(403, "Cannot access this invoice");
  }
  return { invoice, isBuyer };
}

// GET /invoices — buyer(own) / admin(institution)
invoicesRouter.get("/", requireAuth, async (req, res) => {
  const u = currentUser(req);
  const p = paginate(req.query);
  const where: any = {};
  if (u.role === "SUPER_ADMIN") {
    // no scope
  } else if (u.role === "INDUSTRY_BUYER") {
    where.order = { buyerId: u.id };
  } else {
    if (!u.institutionId) throw new AppError(403, "User is not associated with an institution");
    where.institutionId = u.institutionId;
  }
  const status = strParam(req.query, "status");
  if (status) where.status = status;
  if (p.q) where.number = { contains: p.q, mode: "insensitive" };

  const [data, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      skip: p.skip,
      take: p.take,
      include: {
        payment: true,
        order: { select: { id: true, code: true, buyerId: true } },
        institution: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ]);
  res.json(pageResult(data, total, p));
});

// GET /invoices/:id — owner (+order, +payment)
invoicesRouter.get("/:id", requireAuth, async (req, res) => {
  const u = currentUser(req);
  const { invoice } = await loadInvoiceForActor(req.params.id, u);
  res.json(invoice);
});

const paySchema = z.object({
  method: z.enum(["upi", "card", "netbanking", "wire"]),
  reference: z.string().optional(),
});

// POST /invoices/:id/pay — buyer(own): Payment SUCCESS, Invoice PAID (simulated gateway, real rows)
invoicesRouter.post("/:id/pay", requireAuth, async (req, res) => {
  const u = currentUser(req);
  const { invoice, isBuyer } = await loadInvoiceForActor(req.params.id, u);
  if (u.role !== "SUPER_ADMIN" && u.role !== "INDUSTRY_BUYER") {
    throw new AppError(403, "Only the buyer can pay this invoice");
  }
  if (u.role === "INDUSTRY_BUYER" && !isBuyer) throw new AppError(403, "Not your invoice");
  if (invoice.status === "PAID") throw new AppError(409, "Invoice already paid");
  if (invoice.status === "VOID") throw new AppError(409, "Invoice is void");

  const body = paySchema.parse(req.body);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: invoice.total,
        method: body.method,
        reference: body.reference ?? `PAY-${now.getTime()}`,
        status: "SUCCESS",
        paidAt: now,
      },
    });
    const updated = await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: "PAID" },
    });
    await tx.orderEvent.create({
      data: { orderId: invoice.orderId, type: "note", message: `Invoice ${invoice.number} paid via ${body.method}`, actor: u.id },
    });
    return { payment, invoice: updated };
  });

  await prisma.auditLog.create({
    data: { userId: u.id, action: "pay", entity: "Invoice", entityId: invoice.id, meta: { method: body.method, amount: invoice.total } },
  });
  res.json(result);
});
