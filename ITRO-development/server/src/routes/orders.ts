import { Router } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { z } from "zod";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "../db";
import { env } from "../env";
import { AppError, paginate, pageResult, strParam } from "../http";
import { requireAuth, requireRole, currentUser, type AuthUser } from "../middleware/auth";
import { generateOrderCode, generateInvoiceNumber } from "../lib/tokens";
import { resolveFee, computeBreakdown } from "../lib/pricing";
import { reserveForOrder, releaseForOrder } from "../lib/scheduling";

export const ordersRouter = Router();

const orderInclude = {
  service: true,
  institution: true,
  buyer: { select: { id: true, name: true, email: true, orgName: true } },
  events: { orderBy: { createdAt: "asc" as const } },
  invoice: { include: { payment: true } },
  settlement: true,
  review: true,
  documents: { orderBy: { createdAt: "asc" as const } },
  messages: { orderBy: { createdAt: "asc" as const } },
};

async function loadOrderForActor(id: string, u: AuthUser) {
  const order = await prisma.serviceOrder.findUnique({ where: { id }, include: orderInclude });
  if (!order) throw new AppError(404, "Order not found");
  const isBuyer = order.buyerId === u.id;
  const isInstitution = u.role !== "INDUSTRY_BUYER" && order.institutionId === u.institutionId;
  if (u.role !== "SUPER_ADMIN" && !isBuyer && !isInstitution) {
    throw new AppError(403, "Cannot access this order");
  }
  return { order, isBuyer, isInstitution };
}

function assertStatus(current: OrderStatus, allowed: OrderStatus[]) {
  if (!allowed.includes(current)) {
    throw new AppError(409, `Invalid transition from status ${current}`);
  }
}

async function addEvent(orderId: string, type: string, message: string, actor?: string) {
  await prisma.orderEvent.create({ data: { orderId, type, message, actor } });
}

// ---- Order thread: documents + messages (buyer <-> provider <-> platform) ----
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const DOC_MIMES = new Set([
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel", "text/plain", "text/csv",
]);
const docUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".bin";
      cb(null, crypto.randomBytes(16).toString("hex") + ext);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || DOC_MIMES.has(file.mimetype)) cb(null, true);
    else cb(new AppError(400, "Only image, PDF, Word, Excel or text files are allowed"));
  },
});

function actorRole(isBuyer: boolean, isInstitution: boolean): string {
  return isBuyer ? "buyer" : isInstitution ? "provider" : "platform";
}
async function actorName(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, orgName: true } });
  return u?.orgName || u?.name || "User";
}

// POST /orders/:id/messages — any party on the order posts to the thread
ordersRouter.post("/:id/messages", requireAuth, async (req, res) => {
  const u = currentUser(req);
  const { order, isBuyer, isInstitution } = await loadOrderForActor(req.params.id, u);
  const { body } = z.object({ body: z.string().min(1).max(4000) }).parse(req.body);
  const name = await actorName(u.id);
  const msg = await prisma.orderMessage.create({
    data: { serviceOrderId: order.id, userId: u.id, authorRole: actorRole(isBuyer, isInstitution), authorName: name, body },
  });
  await addEvent(order.id, "message", `${name}: ${body.slice(0, 80)}${body.length > 80 ? "…" : ""}`, u.id);
  res.status(201).json(msg);
});

// POST /orders/:id/documents — upload a file to the order (buyer supporting docs / provider deliverables)
ordersRouter.post("/:id/documents", requireAuth, docUpload.single("file"), async (req, res) => {
  const u = currentUser(req);
  const { order, isBuyer, isInstitution } = await loadOrderForActor(req.params.id, u);
  if (!req.file) throw new AppError(400, "No file uploaded (field name must be 'file')");
  const kindRaw = typeof req.body.kind === "string" ? req.body.kind : "";
  const kind = kindRaw || (isInstitution ? "DELIVERABLE" : isBuyer ? "SUPPORTING" : "OTHER");
  const deliverable = typeof req.body.deliverable === "string" && req.body.deliverable.trim() ? req.body.deliverable.trim() : null;
  const url = `${env.publicApiUrl}/uploads/${req.file.filename}`;
  const name = req.file.originalname || req.file.filename;
  const author = await actorName(u.id);
  const doc = await prisma.orderDocument.create({
    data: { serviceOrderId: order.id, uploadedById: u.id, authorRole: actorRole(isBuyer, isInstitution), authorName: author, kind, deliverable, name, url },
  });
  await addEvent(order.id, "document_uploaded", `${author} uploaded ${name}`, u.id);
  res.status(201).json(doc);
});

// DELETE /orders/:id/documents/:docId — uploader or platform can remove
ordersRouter.delete("/:id/documents/:docId", requireAuth, async (req, res) => {
  const u = currentUser(req);
  const { order } = await loadOrderForActor(req.params.id, u);
  const doc = await prisma.orderDocument.findUnique({ where: { id: req.params.docId } });
  if (!doc || doc.serviceOrderId !== order.id) throw new AppError(404, "Document not found");
  if (u.role !== "SUPER_ADMIN" && doc.uploadedById !== u.id) throw new AppError(403, "Only the uploader or platform can remove this document");
  await prisma.orderDocument.delete({ where: { id: doc.id } });
  res.json({ ok: true });
});

const parentOrderInclude = {
  lines: {
    orderBy: { createdAt: "asc" as const },
    include: {
      service: { select: { id: true, name: true, category: true } },
      institution: { select: { id: true, name: true, slug: true, currency: true } },
      invoice: { include: { payment: true } },
      settlement: true,
    },
  },
};

// GET /orders — buyers see their own PARENT orders (basket); institution admins see institution's lines
ordersRouter.get("/", requireAuth, async (req, res) => {
  const u = currentUser(req);
  const p = paginate(req.query);

  // Buyers get grouped parent Orders (aggregator baskets).
  if (u.role === "INDUSTRY_BUYER") {
    const where: any = { buyerId: u.id, status: { not: "OPEN" } };
    if (p.q) where.code = { contains: p.q, mode: "insensitive" };
    const [data, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: p.skip,
        take: p.take,
        include: parentOrderInclude,
      }),
      prisma.order.count({ where }),
    ]);
    res.json(pageResult(data, total, p));
    return;
  }

  // Provider / admin: unchanged ServiceOrder line view.
  const where: any = {};
  if (u.role === "SUPER_ADMIN") {
    // no scope
  } else {
    if (!u.institutionId) throw new AppError(403, "User is not associated with an institution");
    where.institutionId = u.institutionId;
  }
  const status = strParam(req.query, "status");
  if (status) where.status = status;
  if (p.q) where.code = { contains: p.q, mode: "insensitive" };

  const [data, total] = await Promise.all([
    prisma.serviceOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: p.skip,
      take: p.take,
      include: {
        service: { select: { id: true, name: true, category: true } },
        institution: { select: { id: true, name: true, slug: true } },
        buyer: { select: { id: true, name: true, orgName: true } },
        invoice: { select: { id: true, status: true, total: true } },
      },
    }),
    prisma.serviceOrder.count({ where }),
  ]);
  res.json(pageResult(data, total, p));
});

// GET /orders/:id — buyer: parent Order (with grouped lines); provider/admin: single ServiceOrder line
ordersRouter.get("/:id", requireAuth, async (req, res) => {
  const u = currentUser(req);

  // Buyers view the parent aggregator order.
  if (u.role === "INDUSTRY_BUYER") {
    const parent = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        lines: {
          orderBy: { createdAt: "asc" },
          include: {
            service: { select: { id: true, name: true, category: true } },
            institution: true,
            invoice: { include: { payment: true } },
            settlement: true,
            events: { orderBy: { createdAt: "asc" } },
            review: true,
            documents: { orderBy: { createdAt: "asc" } },
            messages: { orderBy: { createdAt: "asc" } },
          },
        },
        samples: { orderBy: { createdAt: "asc" } },
      },
    });
    if (parent && parent.buyerId === u.id) {
      res.json(parent);
      return;
    }
    // Fall through: maybe it's a legacy single ServiceOrder id the buyer owns.
    const { order } = await loadOrderForActor(req.params.id, u);
    res.json(order);
    return;
  }

  const { order } = await loadOrderForActor(req.params.id, u);
  res.json(order);
});

const createSchema = z.object({
  serviceId: z.string().min(1),
  sampleDetails: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  requirements: z.string().optional(),
});

// POST /orders — INDUSTRY_BUYER creates RFQ
ordersRouter.post("/", requireAuth, requireRole("INDUSTRY_BUYER"), async (req, res) => {
  const u = currentUser(req);
  const body = createSchema.parse(req.body);
  const service = await prisma.service.findUnique({ where: { id: body.serviceId } });
  if (!service) throw new AppError(404, "Service not found");
  if (!service.isActive) throw new AppError(400, "Service is not available");

  const code = await generateOrderCode();
  const order = await prisma.serviceOrder.create({
    data: {
      code,
      serviceId: service.id,
      institutionId: service.institutionId,
      buyerId: u.id,
      status: "QUOTE_REQUESTED",
      tier: "INDUSTRY",
      sampleDetails: body.sampleDetails,
      quantity: body.quantity ?? 1,
      requirements: body.requirements,
    },
  });
  await addEvent(order.id, "status", "Quote requested", u.id);
  await prisma.auditLog.create({
    data: { userId: u.id, action: "create", entity: "ServiceOrder", entityId: order.id },
  });
  const full = await prisma.serviceOrder.findUnique({ where: { id: order.id }, include: orderInclude });
  res.status(201).json(full);
});

const quoteSchema = z.object({
  quotedPrice: z.number().positive(),
  slaDays: z.number().int().positive(),
  discountPct: z.number().min(0).max(100).optional(), // provider discount on this quote (fee-on-discounted)
});

// POST /orders/:id/quote — institution issues quote
ordersRouter.post(
  "/:id/quote",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "LAB_MANAGER"),
  async (req, res) => {
    const u = currentUser(req);
    const { order, isInstitution } = await loadOrderForActor(req.params.id, u);
    if (u.role !== "SUPER_ADMIN" && !isInstitution) throw new AppError(403, "Cannot quote this order");
    assertStatus(order.status, ["QUOTE_REQUESTED", "QUOTED"]);
    const body = quoteSchema.parse(req.body);

    // The provider quotes their price; the platform fee is applied so buyerAmount is fee-inclusive.
    // An optional quote discount reduces the provider price (fee-on-discounted).
    const fee = await resolveFee(order.institution);
    const disc = body.discountPct ?? 0;
    const bd = computeBreakdown(Math.round(body.quotedPrice * (1 - disc / 100)), fee);
    const listPrice = disc > 0 ? computeBreakdown(body.quotedPrice, fee).buyerAmount : null;

    const updated = await prisma.serviceOrder.update({
      where: { id: order.id },
      data: {
        quotedPrice: bd.buyerAmount,
        slaDays: body.slaDays,
        status: "QUOTED",
        providerAmount: bd.providerAmount,
        platformFeeAmount: bd.platformFeeAmount,
        buyerAmount: bd.buyerAmount,
        listPrice,
      },
    });
    await addEvent(order.id, "status", disc > 0 ? `Quote issued: ${bd.buyerAmount} (${disc}% off; SLA ${body.slaDays}d)` : `Quote issued: ${bd.buyerAmount} (SLA ${body.slaDays}d)`, u.id);
    await prisma.auditLog.create({
      data: { userId: u.id, action: "quote", entity: "ServiceOrder", entityId: order.id, meta: body },
    });
    res.json(updated);
  }
);

// POST /orders/:id/accept — buyer accepts quote -> create Invoice + Settlement, ACCEPTED then NDA_PENDING
ordersRouter.post(
  "/:id/accept",
  requireAuth,
  requireRole("INDUSTRY_BUYER"),
  async (req, res) => {
    const u = currentUser(req);
    const { order, isBuyer } = await loadOrderForActor(req.params.id, u);
    if (u.role !== "SUPER_ADMIN" && !isBuyer) throw new AppError(403, "Only the buyer can accept");
    assertStatus(order.status, ["QUOTED"]);
    if (order.quotedPrice == null) throw new AppError(400, "Order has no quoted price");

    const inst = await prisma.institution.findUnique({ where: { id: order.institutionId } });
    if (!inst) throw new AppError(404, "Institution not found");

    const subtotal = order.quotedPrice;
    const taxRate = inst.taxRate;
    const taxAmount = round2(subtotal * taxRate);
    const total = round2(subtotal + taxAmount);
    const takeRate = env.platformTakeRate;
    const platformFee = round2(total * takeRate);
    const netToProvider = round2(total - platformFee);
    const invoiceNumber = await generateInvoiceNumber();

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          number: invoiceNumber,
          orderId: order.id,
          institutionId: order.institutionId,
          subtotal,
          taxRate,
          taxAmount,
          total,
          currency: inst.currency,
          status: "ISSUED",
        },
      });
      const settlement = await tx.settlement.create({
        data: {
          orderId: order.id,
          grossAmount: total,
          takeRate,
          platformFee,
          netToProvider,
          status: "PENDING",
        },
      });
      const updated = await tx.serviceOrder.update({
        where: { id: order.id },
        data: { status: "NDA_PENDING" },
      });
      await tx.orderEvent.create({ data: { orderId: order.id, type: "status", message: "Quote accepted", actor: u.id } });
      await tx.orderEvent.create({ data: { orderId: order.id, type: "status", message: "Awaiting NDA e-sign", actor: u.id } });
      return { invoice, settlement, updated };
    });

    // Quote accepted → the line is committed; consume instrument capacity.
    await reserveForOrder(order.id);

    await prisma.auditLog.create({
      data: { userId: u.id, action: "accept", entity: "ServiceOrder", entityId: order.id, meta: { total } },
    });
    res.json({ order: result.updated, invoice: result.invoice, settlement: result.settlement });
  }
);

// POST /orders/:id/nda — buyer e-signs NDA -> ndaSigned true, SAMPLE_AWAITED
ordersRouter.post(
  "/:id/nda",
  requireAuth,
  requireRole("INDUSTRY_BUYER"),
  async (req, res) => {
    const u = currentUser(req);
    const { order, isBuyer } = await loadOrderForActor(req.params.id, u);
    if (u.role !== "SUPER_ADMIN" && !isBuyer) throw new AppError(403, "Only the buyer can sign the NDA");
    assertStatus(order.status, ["NDA_PENDING"]);
    const updated = await prisma.serviceOrder.update({
      where: { id: order.id },
      data: { ndaSigned: true, ndaSignedAt: new Date(), status: "SAMPLE_AWAITED" },
    });
    await addEvent(order.id, "status", "NDA signed; awaiting sample", u.id);
    await prisma.auditLog.create({
      data: { userId: u.id, action: "nda", entity: "ServiceOrder", entityId: order.id },
    });
    res.json(updated);
  }
);

// POST /orders/:id/sample-received -> IN_PROGRESS, dueAt = now + slaDays
ordersRouter.post(
  "/:id/sample-received",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "LAB_MANAGER", "OPERATOR"),
  async (req, res) => {
    const u = currentUser(req);
    const { order, isInstitution } = await loadOrderForActor(req.params.id, u);
    if (u.role !== "SUPER_ADMIN" && !isInstitution) throw new AppError(403, "Cannot update this order");
    assertStatus(order.status, ["SAMPLE_AWAITED"]);
    const slaDays = order.slaDays ?? 7;
    const dueAt = new Date(Date.now() + slaDays * 24 * 60 * 60 * 1000);
    const updated = await prisma.serviceOrder.update({
      where: { id: order.id },
      data: { status: "IN_PROGRESS", dueAt },
    });
    await addEvent(order.id, "sample_received", `Sample received; due ${dueAt.toISOString()}`, u.id);
    await prisma.auditLog.create({
      data: { userId: u.id, action: "sample-received", entity: "ServiceOrder", entityId: order.id },
    });
    res.json(updated);
  }
);

const reportSchema = z.object({ reportUrl: z.string().min(1) });

// POST /orders/:id/report -> REPORT_READY
ordersRouter.post(
  "/:id/report",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "LAB_MANAGER", "OPERATOR"),
  async (req, res) => {
    const u = currentUser(req);
    const { order, isInstitution } = await loadOrderForActor(req.params.id, u);
    if (u.role !== "SUPER_ADMIN" && !isInstitution) throw new AppError(403, "Cannot update this order");
    assertStatus(order.status, ["IN_PROGRESS"]);
    const body = reportSchema.parse(req.body);
    const updated = await prisma.serviceOrder.update({
      where: { id: order.id },
      data: { reportUrl: body.reportUrl, status: "REPORT_READY" },
    });
    await addEvent(order.id, "report_uploaded", "Report uploaded", u.id);
    await prisma.auditLog.create({
      data: { userId: u.id, action: "report", entity: "ServiceOrder", entityId: order.id },
    });
    res.json(updated);
  }
);

// POST /orders/:id/complete -> COMPLETED, releases settlement
ordersRouter.post(
  "/:id/complete",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "LAB_MANAGER"),
  async (req, res) => {
    const u = currentUser(req);
    const { order, isInstitution } = await loadOrderForActor(req.params.id, u);
    if (u.role !== "SUPER_ADMIN" && !isInstitution) throw new AppError(403, "Cannot complete this order");
    assertStatus(order.status, ["REPORT_READY", "IN_PROGRESS"]);

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.serviceOrder.update({
        where: { id: order.id },
        data: { status: "COMPLETED" },
      });
      const settlement = await tx.settlement.findUnique({ where: { orderId: order.id } });
      if (settlement && settlement.status !== "RELEASED") {
        await tx.settlement.update({
          where: { orderId: order.id },
          data: { status: "RELEASED", releasedAt: new Date() },
        });
      }
      await tx.orderEvent.create({ data: { orderId: order.id, type: "status", message: "Order completed", actor: u.id } });
      return updated;
    });

    // Job done → free the reserved capacity.
    await releaseForOrder(order.id);

    await prisma.auditLog.create({
      data: { userId: u.id, action: "complete", entity: "ServiceOrder", entityId: order.id },
    });
    res.json(result);
  }
);

// POST /orders/:id/cancel -> CANCELLED (owner buyer or institution admin)
ordersRouter.post("/:id/cancel", requireAuth, async (req, res) => {
  const u = currentUser(req);
  const { order, isBuyer, isInstitution } = await loadOrderForActor(req.params.id, u);
  if (u.role !== "SUPER_ADMIN" && !isBuyer && !isInstitution) {
    throw new AppError(403, "Cannot cancel this order");
  }
  if (["COMPLETED", "CANCELLED"].includes(order.status)) {
    throw new AppError(409, `Cannot cancel an order in status ${order.status}`);
  }
  const updated = await prisma.serviceOrder.update({
    where: { id: order.id },
    data: { status: "CANCELLED" },
  });
  // Cancellation frees any held capacity.
  await releaseForOrder(order.id);
  await addEvent(order.id, "status", "Order cancelled", u.id);
  await prisma.auditLog.create({
    data: { userId: u.id, action: "cancel", entity: "ServiceOrder", entityId: order.id },
  });
  res.json(updated);
});

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

// POST /orders/:id/review — buyer leaves a review
ordersRouter.post(
  "/:id/review",
  requireAuth,
  requireRole("INDUSTRY_BUYER"),
  async (req, res) => {
    const u = currentUser(req);
    const { order, isBuyer } = await loadOrderForActor(req.params.id, u);
    if (u.role !== "SUPER_ADMIN" && !isBuyer) throw new AppError(403, "Only the buyer can review");
    if (order.status !== "COMPLETED") throw new AppError(409, "Can only review completed orders");
    const existing = await prisma.review.findUnique({ where: { orderId: order.id } });
    if (existing) throw new AppError(409, "Order already reviewed");
    const body = reviewSchema.parse(req.body);
    const review = await prisma.review.create({
      data: { orderId: order.id, userId: u.id, rating: body.rating, comment: body.comment },
    });
    await addEvent(order.id, "note", `Review submitted (${body.rating}/5)`, u.id);
    await prisma.auditLog.create({
      data: { userId: u.id, action: "review", entity: "ServiceOrder", entityId: order.id },
    });
    res.status(201).json(review);
  }
);

const paySchema = z.object({
  method: z.enum(["upi", "card", "netbanking", "wire"]).optional(),
  reference: z.string().optional(),
});

// POST /orders/:id/pay — buyer pays all unpaid invoices across a parent Order's lines
ordersRouter.post("/:id/pay", requireAuth, requireRole("INDUSTRY_BUYER"), async (req, res) => {
  const u = currentUser(req);
  const body = paySchema.parse(req.body ?? {});
  const method = body.method ?? "card";

  const parent = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { lines: { include: { invoice: true } } },
  });
  if (!parent) throw new AppError(404, "Order not found");
  if (u.role !== "SUPER_ADMIN" && parent.buyerId !== u.id) throw new AppError(403, "Not your order");

  const payable = parent.lines
    .map((l) => l.invoice)
    .filter((inv): inv is NonNullable<typeof inv> => !!inv && inv.status !== "PAID" && inv.status !== "VOID");

  if (payable.length === 0) throw new AppError(409, "Nothing to pay on this order");

  const now = new Date();
  const paid = await prisma.$transaction(async (tx) => {
    const done: string[] = [];
    for (const inv of payable) {
      const existing = await tx.payment.findUnique({ where: { invoiceId: inv.id } });
      if (!existing) {
        await tx.payment.create({
          data: {
            invoiceId: inv.id,
            amount: inv.total,
            method,
            reference: body.reference ?? `PAY-${now.getTime()}-${inv.number}`,
            status: "SUCCESS",
            paidAt: now,
          },
        });
      }
      await tx.invoice.update({ where: { id: inv.id }, data: { status: "PAID" } });
      await tx.orderEvent.create({
        data: { orderId: inv.orderId, type: "note", message: `Invoice ${inv.number} paid via ${method}`, actor: u.id },
      });
      done.push(inv.id);
    }
    return done;
  });

  await prisma.auditLog.create({
    data: { userId: u.id, action: "pay", entity: "Order", entityId: parent.id, meta: { invoices: paid.length } },
  });

  const full = await prisma.order.findUnique({
    where: { id: parent.id },
    include: {
      lines: {
        orderBy: { createdAt: "asc" },
        include: {
          service: { select: { id: true, name: true, category: true } },
          institution: true,
          invoice: { include: { payment: true } },
          settlement: true,
          events: { orderBy: { createdAt: "asc" } },
          review: true,
        },
      },
    },
  });
  res.json(full);
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
