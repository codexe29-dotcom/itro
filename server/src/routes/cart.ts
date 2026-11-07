import { Router } from "express";
import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../db";
import { AppError } from "../http";
import { requireAuth, requireRole, currentUser } from "../middleware/auth";
import { pendingUploadFilename, pendingUploadKey, privateUploadKeyFromReference } from "../lib/uploads";
import { secureOrderFileUrls } from "../controllers/orderDocuments";
import { privateObjectExists, privateObjectReference, putObject } from "../lib/storage";
import { generateOrderCode, generateBasketCode } from "../lib/tokens";
import { resolveFee, computeBreakdown, discountedBase } from "../lib/pricing";
import { reserveForOrder } from "../lib/scheduling";
import { quotePackage, type Strategy } from "../lib/routing";
import { allocateAcross, loadValidCoupon, creditSummary, type WorkingLine, type Funder } from "../lib/discounts";

export const cartRouter = Router();

const lineInclude = {
  service: { include: { institution: true } },
  institution: true,
};

const cartInclude = {
  lines: {
    orderBy: { createdAt: "asc" as const },
    include: lineInclude,
  },
  samples: { orderBy: { createdAt: "asc" as const } },
};

/** Find the buyer's OPEN parent Order (the cart), if any. */
async function findOpenCart(buyerId: string) {
  return prisma.order.findFirst({
    where: { buyerId, status: "OPEN" },
    include: cartInclude,
  });
}

/**
 * Config-driven sample requirements for a cart: maps each line's Service to its
 * linked TestDefinition (via TestProvider) and reads the provider-configured
 * sample rules. Falls back to 1 generic sample for non-test services.
 */
async function cartSampleRequirements(cart: NonNullable<Awaited<ReturnType<typeof findOpenCart>>>) {
  const serviceIds = [...new Set(cart.lines.map((l) => l.serviceId))];
  const links = serviceIds.length
    ? await prisma.testProvider.findMany({ where: { serviceId: { in: serviceIds } }, include: { test: true } })
    : [];
  const testByService = new Map<string, (typeof links)[number]["test"]>();
  for (const lk of links) if (!testByService.has(lk.serviceId)) testByService.set(lk.serviceId, lk.test);

  const items = cart.lines.map((l) => {
    const t = testByService.get(l.serviceId);
    const s = l.service; // provider overrides win over the catalog default
    return {
      lineId: l.id,
      service: l.service.name,
      provider: l.institution.name,
      samplesRequired: s.samplesRequired ?? t?.samplesRequired ?? 1,
      sampleSpec: s.sampleRequirements ?? t?.sampleRequirements ?? l.sampleDetails ?? null,
      destructive: s.sampleDestructive ?? t?.sampleDestructive ?? false,
      returned: s.sampleReturned ?? t?.sampleReturned ?? false,
      deliverables: (s.deliverables && s.deliverables.length ? s.deliverables : t?.deliverables) ?? [],
      intakeForms: (s.intakeForms as { name: string; description?: string; required?: boolean; type?: string; options?: string[] }[]) ?? [],
    };
  });
  const totalSamples = items.reduce((n, i) => n + (i.samplesRequired || 0), 0);
  return { items, totalSamples };
}

// Every cart endpoint is buyer-scoped (applied per-route: this router is mounted at "/").
const buyerOnly = [requireAuth, requireRole("INDUSTRY_BUYER")] as const;
const INTAKE_FILE_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/plain",
  "text/csv",
]);
const CAD_EXTENSIONS = new Set([
  ".3mf", ".dxf", ".dwg", ".glb", ".gltf", ".iges", ".igs", ".obj", ".step", ".stl", ".stp",
]);
const intakeFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (file.mimetype.startsWith("image/") || INTAKE_FILE_MIMES.has(file.mimetype) || CAD_EXTENSIONS.has(extension)) {
      cb(null, true);
    } else {
      cb(new AppError(400, "Only image, PDF, Word, Excel, text or supported CAD files are allowed"));
    }
  },
});

cartRouter.post("/cart/intake-files", ...buyerOnly, intakeFileUpload.single("file"), async (req, res) => {
  if (!req.file) throw new AppError(400, "No file uploaded (field name must be 'file')");
  const originalExtension = path.extname(req.file.originalname).toLowerCase();
  const extension = /^\.[a-z0-9]{1,32}$/.test(originalExtension) ? originalExtension : ".bin";
  const filename = `${crypto.randomBytes(16).toString("hex")}${extension}`;
  const key = pendingUploadKey(currentUser(req).id, filename);
  await putObject({
    visibility: "private",
    key,
    body: req.file.buffer,
    contentType: req.file.mimetype,
  });
  res.status(201).json({ url: privateObjectReference(key) });
});

// GET /cart — the buyer's OPEN order + its lines (or an empty shell)
cartRouter.get("/cart", ...buyerOnly, async (req, res) => {
  const u = currentUser(req);
  const cart = await findOpenCart(u.id);
  res.json(cart ?? { id: null, code: null, status: "OPEN", lines: [], subtotal: 0, platformFee: 0, taxAmount: 0, total: 0, currency: "INR" });
});

// GET /cart/requirements — what samples/deliverables the current cart needs
cartRouter.get("/cart/requirements", ...buyerOnly, async (req, res) => {
  const u = currentUser(req);
  const cart = await findOpenCart(u.id);
  if (!cart || cart.lines.length === 0) return res.json({ items: [], totalSamples: 0 });
  res.json(await cartSampleRequirements(cart));
});

const addSchema = z.object({
  serviceId: z.string().min(1),
  quantity: z.number().int().positive().optional(),
  expedited: z.boolean().optional(),
  sampleDetails: z.string().optional(),
  requirements: z.string().optional(),
});

// POST /cart/items — add a service as a line (create the OPEN order if needed)
cartRouter.post("/cart/items", ...buyerOnly, async (req, res) => {
  const u = currentUser(req);
  const body = addSchema.parse(req.body);

  const service = await prisma.service.findUnique({
    where: { id: body.serviceId },
    include: { institution: true },
  });
  if (!service) throw new AppError(404, "Service not found");
  if (!service.isActive) throw new AppError(400, "Service is not available");

  const quantity = body.quantity ?? 1;
  // Expedited tier: only when the buyer opted in and the service offers a rush option.
  const expedited = !!body.expedited && service.rushDays != null && service.rushSurchargePct != null;
  const rushFactor = expedited ? 1 + (service.rushSurchargePct as number) / 100 : 1;

  // Ensure an OPEN cart exists.
  let cart = await prisma.order.findFirst({ where: { buyerId: u.id, status: "OPEN" } });
  if (!cart) {
    cart = await prisma.order.create({
      data: {
        code: await generateBasketCode(),
        buyerId: u.id,
        status: "OPEN",
        currency: service.institution.currency,
      },
    });
  }

  // Compute line breakdown for FIXED services; leave null for QUOTE.
  let providerAmount: number | null = null;
  let platformFeeAmount: number | null = null;
  let buyerAmount: number | null = null;
  let listPrice: number | null = null;
  if (service.pricingMode === "FIXED") {
    const fee = await resolveFee(service.institution);
    const discFactor = 1 - (service.discountPct ?? 0) / 100;
    const bd = computeBreakdown(service.priceIndustry * quantity * rushFactor * discFactor, fee);
    providerAmount = bd.providerAmount;
    platformFeeAmount = bd.platformFeeAmount;
    buyerAmount = bd.buyerAmount;
    listPrice = (service.discountPct ?? 0) > 0 ? computeBreakdown(service.priceIndustry * quantity * rushFactor, fee).buyerAmount : null;
  }

  const line = await prisma.serviceOrder.create({
    data: {
      code: await generateOrderCode(),
      orderId: cart.id,
      serviceId: service.id,
      institutionId: service.institutionId,
      buyerId: u.id,
      status: "DRAFT",
      tier: "INDUSTRY",
      quantity,
      expedited,
      sampleDetails: body.sampleDetails,
      requirements: body.requirements,
      providerAmount,
      platformFeeAmount,
      buyerAmount,
      listPrice,
    },
    include: lineInclude,
  });

  await prisma.auditLog.create({
    data: { userId: u.id, action: "cart-add", entity: "ServiceOrder", entityId: line.id },
  });

  const full = await findOpenCart(u.id);
  res.status(201).json(full);
});

const addPackageSchema = z.object({
  packageSlug: z.string().min(1),
  strategy: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

// POST /cart/package — route a package with the chosen strategy and add one line per test
// (each test → its recommended provider). DYNAMIC packages apply the bundle discount to FIXED lines.
cartRouter.post("/cart/package", ...buyerOnly, async (req, res) => {
  const u = currentUser(req);
  const body = addPackageSchema.parse(req.body);

  const quote = await quotePackage(body.packageSlug, {
    strategy: body.strategy as Strategy | undefined,
    lat: body.lat,
    lng: body.lng,
  });
  if (!quote) throw new AppError(404, "Package not found");
  const chosen = quote.items.map((i) => i.recommended).filter((r): r is NonNullable<typeof r> => !!r);
  if (chosen.length === 0) throw new AppError(400, "No available providers for this package");

  const pkg = await prisma.testPackage.findUnique({ where: { slug: body.packageSlug }, select: { name: true } });
  const discountFactor = quote.pricingMode === "DYNAMIC" ? 1 - quote.discountPct / 100 : 1;

  let cart = await prisma.order.findFirst({ where: { buyerId: u.id, status: "OPEN" } });
  if (!cart) {
    cart = await prisma.order.create({
      data: { code: await generateBasketCode(), buyerId: u.id, status: "OPEN", currency: quote.currency },
    });
  }

  for (const r of chosen) {
    const service = await prisma.service.findUnique({ where: { id: r.serviceId }, include: { institution: true } });
    if (!service || !service.isActive) continue;

    let providerAmount: number | null = null;
    let platformFeeAmount: number | null = null;
    let buyerAmount: number | null = null;
    if (service.pricingMode === "FIXED") {
      const fee = await resolveFee(service.institution);
      const bd = computeBreakdown(service.priceIndustry * discountFactor, fee);
      providerAmount = bd.providerAmount;
      platformFeeAmount = bd.platformFeeAmount;
      buyerAmount = bd.buyerAmount;
    }

    await prisma.serviceOrder.create({
      data: {
        code: await generateOrderCode(),
        orderId: cart.id,
        serviceId: service.id,
        institutionId: service.institutionId,
        buyerId: u.id,
        status: "DRAFT",
        tier: "INDUSTRY",
        quantity: 1,
        requirements: `Part of package: ${pkg?.name ?? body.packageSlug}`,
        providerAmount,
        platformFeeAmount,
        buyerAmount,
      },
    });
  }

  await prisma.auditLog.create({
    data: { userId: u.id, action: "cart-add-package", entity: "TestPackage", entityId: body.packageSlug, meta: { lines: chosen.length } },
  });

  const full = await findOpenCart(u.id);
  res.status(201).json(full);
});

const addBundleSchema = z.object({ bundleSlug: z.string().min(1) });

// POST /cart/bundle — add a provider bundle: one line per member service with the bundle discount applied.
cartRouter.post("/cart/bundle", ...buyerOnly, async (req, res) => {
  const u = currentUser(req);
  const { bundleSlug } = addBundleSchema.parse(req.body);
  const bundle = await prisma.serviceBundle.findUnique({
    where: { slug: bundleSlug },
    include: { items: { include: { service: { include: { institution: true } } } } },
  });
  if (!bundle || !bundle.isActive) throw new AppError(404, "Bundle not found");
  const members = bundle.items.map((i) => i.service).filter((s) => s.isActive && s.pricingMode === "FIXED");
  if (members.length === 0) throw new AppError(400, "This bundle has no available services");
  const factor = 1 - (bundle.discountPct ?? 0) / 100;

  let cart = await prisma.order.findFirst({ where: { buyerId: u.id, status: "OPEN" } });
  if (!cart) cart = await prisma.order.create({ data: { code: await generateBasketCode(), buyerId: u.id, status: "OPEN", currency: members[0].institution.currency } });

  for (const s of members) {
    const fee = await resolveFee(s.institution);
    const base = discountedBase(s.priceIndustry, s.discountPct);
    const bd = computeBreakdown(Math.round(base * factor), fee);
    const listPrice = computeBreakdown(base, fee).buyerAmount;
    await prisma.serviceOrder.create({
      data: {
        code: await generateOrderCode(), orderId: cart.id, serviceId: s.id, institutionId: s.institutionId, buyerId: u.id,
        status: "DRAFT", tier: "INDUSTRY", quantity: 1, requirements: `Part of bundle: ${bundle.name}`,
        providerAmount: bd.providerAmount, platformFeeAmount: bd.platformFeeAmount, buyerAmount: bd.buyerAmount, listPrice,
      },
    });
  }
  await prisma.auditLog.create({ data: { userId: u.id, action: "cart-add-bundle", entity: "ServiceBundle", entityId: bundle.id, meta: { lines: members.length } } });
  res.status(201).json(await findOpenCart(u.id));
});

const qtySchema = z.object({ quantity: z.number().int().positive() });

// PATCH /cart/items/:lineId — change quantity (recomputes FIXED breakdown)
cartRouter.patch("/cart/items/:lineId", ...buyerOnly, async (req, res) => {
  const u = currentUser(req);
  const body = qtySchema.parse(req.body);

  const line = await prisma.serviceOrder.findUnique({
    where: { id: req.params.lineId },
    include: { service: { include: { institution: true } }, order: true },
  });
  if (!line || !line.order) throw new AppError(404, "Cart item not found");
  if (line.buyerId !== u.id) throw new AppError(403, "Not your cart item");
  if (line.order.status !== "OPEN") throw new AppError(409, "Cart already checked out");

  const data: Record<string, unknown> = { quantity: body.quantity };
  if (line.service.pricingMode === "FIXED") {
    const fee = await resolveFee(line.service.institution);
    const rushFactor = line.expedited && line.service.rushSurchargePct != null ? 1 + line.service.rushSurchargePct / 100 : 1;
    const discFactor = 1 - (line.service.discountPct ?? 0) / 100;
    const bd = computeBreakdown(line.service.priceIndustry * body.quantity * rushFactor * discFactor, fee);
    data.providerAmount = bd.providerAmount;
    data.platformFeeAmount = bd.platformFeeAmount;
    data.buyerAmount = bd.buyerAmount;
    data.listPrice = (line.service.discountPct ?? 0) > 0 ? computeBreakdown(line.service.priceIndustry * body.quantity * rushFactor, fee).buyerAmount : null;
  }
  await prisma.serviceOrder.update({ where: { id: line.id }, data });

  const full = await findOpenCart(u.id);
  res.json(full);
});

// DELETE /cart/items/:lineId — remove a line
cartRouter.delete("/cart/items/:lineId", ...buyerOnly, async (req, res) => {
  const u = currentUser(req);
  const line = await prisma.serviceOrder.findUnique({
    where: { id: req.params.lineId },
    include: { order: true },
  });
  if (!line || !line.order) throw new AppError(404, "Cart item not found");
  if (line.buyerId !== u.id) throw new AppError(403, "Not your cart item");
  if (line.order.status !== "OPEN") throw new AppError(409, "Cart already checked out");

  await prisma.serviceOrder.delete({ where: { id: line.id } });

  const full = await findOpenCart(u.id);
  res.json(full ?? { id: null, code: null, status: "OPEN", lines: [], subtotal: 0, platformFee: 0, taxAmount: 0, total: 0, currency: "INR" });
});

// Build discountable working lines from the cart's FIXED (priced) lines.
async function buildWorkingLines(cart: NonNullable<Awaited<ReturnType<typeof findOpenCart>>>): Promise<WorkingLine[]> {
  const lines: WorkingLine[] = [];
  for (const l of cart.lines) {
    if (l.service.pricingMode === "FIXED" && l.buyerAmount != null) {
      const fee = await resolveFee(l.institution);
      lines.push({
        lineId: l.id, institutionId: l.institutionId, serviceId: l.serviceId, category: l.service.category,
        fee, providerAmount: l.providerAmount ?? 0, platformFeeAmount: l.platformFeeAmount ?? 0,
        buyerAmount: l.buyerAmount, discount: 0,
      });
    }
  }
  return lines;
}

interface AppliedDiscounts {
  couponId?: string; couponCode?: string; couponDiscount: number;
  creditApplied: number;
  creditRedemptions: { funder: Funder; institutionId: string | null; amount: number }[];
}

// Apply a coupon (if any) and wallet credits (if opted-in) to the working lines, mutating them.
async function applyCartDiscounts(buyerId: string, lines: WorkingLine[], opts: { couponCode?: string; useCredits?: boolean }): Promise<AppliedDiscounts> {
  let couponId: string | undefined, couponCode: string | undefined, couponDiscount = 0;
  const creditRedemptions: AppliedDiscounts["creditRedemptions"] = [];
  let creditApplied = 0;

  if (opts.couponCode && opts.couponCode.trim()) {
    const { coupon, eligible, discount } = await loadValidCoupon(opts.couponCode, buyerId, lines);
    couponDiscount = allocateAcross(eligible, discount, coupon.funder as Funder);
    couponId = coupon.id; couponCode = coupon.code;
  }

  if (opts.useCredits) {
    const summary = await creditSummary(buyerId);
    // Provider-restricted credits apply only to that provider's lines; then platform credits across all.
    for (const [instId, amt] of Object.entries(summary.byInstitution)) {
      if (amt <= 0) continue;
      const instLines = lines.filter((l) => l.institutionId === instId);
      const use = Math.min(amt, instLines.reduce((s, l) => s + l.buyerAmount, 0));
      const applied = allocateAcross(instLines, use, "PROVIDER");
      if (applied > 0) { creditRedemptions.push({ funder: "PROVIDER", institutionId: instId, amount: applied }); creditApplied += applied; }
    }
    if (summary.platform > 0) {
      const use = Math.min(summary.platform, lines.reduce((s, l) => s + l.buyerAmount, 0));
      const applied = allocateAcross(lines, use, "PLATFORM");
      if (applied > 0) { creditRedemptions.push({ funder: "PLATFORM", institutionId: null, amount: applied }); creditApplied += applied; }
    }
  }
  return { couponId, couponCode, couponDiscount, creditApplied, creditRedemptions };
}

const previewSchema = z.object({ couponCode: z.string().optional(), useCredits: z.boolean().optional() });

// POST /cart/preview-discount — show what a code + credits would do, without committing.
cartRouter.post("/cart/preview-discount", ...buyerOnly, async (req, res) => {
  const u = currentUser(req);
  const body = previewSchema.parse(req.body ?? {});
  const cart = await findOpenCart(u.id);
  if (!cart || cart.lines.length === 0) return res.json({ discountAmount: 0, creditApplied: 0, newSubtotal: 0 });

  const lines = await buildWorkingLines(cart);
  const gross = lines.reduce((s, l) => s + l.buyerAmount, 0);
  let error: string | null = null;
  let applied: AppliedDiscounts = { couponDiscount: 0, creditApplied: 0, creditRedemptions: [] };
  try {
    applied = await applyCartDiscounts(u.id, lines, body);
  } catch (e: any) { error = e?.message ?? "Could not apply"; }
  const newSubtotal = lines.reduce((s, l) => s + l.buyerAmount, 0);
  const wallet = await creditSummary(u.id);
  res.json({
    grossSubtotal: gross,
    couponCode: applied.couponCode ?? null,
    discountAmount: applied.couponDiscount,
    creditApplied: applied.creditApplied,
    newSubtotal,
    walletBalance: wallet.total,
    error,
  });
});

const checkoutSchema = z.object({
  samples: z.array(z.object({
    label: z.string().min(1),
    description: z.string().optional(),
    quantity: z.number().int().positive().optional(),
    condition: z.string().optional(),
  })).optional(),
  shippingNote: z.string().optional(),
  couponCode: z.string().optional(),
  useCredits: z.boolean().optional(),
  // Buyer answers to provider intake questions: { [lineId]: { [fieldName]: value } }
  intakeAnswers: z.record(z.string(), z.record(z.string(), z.string())).optional(),
});

// POST /cart/checkout — finalize the OPEN order into a placed Order
cartRouter.post("/cart/checkout", ...buyerOnly, async (req, res) => {
  const u = currentUser(req);
  const body = checkoutSchema.parse(req.body ?? {});
  const cart = await findOpenCart(u.id);
  if (!cart || cart.lines.length === 0) throw new AppError(400, "Cart is empty");

  // Compute coupon + credit discounts on the FIXED lines (validated here; committed in the tx).
  const workingLines = await buildWorkingLines(cart);
  const applied = await applyCartDiscounts(u.id, workingLines, { couponCode: body.couponCode, useCredits: body.useCredits });
  const adjByLine = new Map(workingLines.map((w) => [w.lineId, w]));

  // Build & validate the buyer's answers to each provider's intake questions.
  const intakeByLine = new Map<string, { name: string; type: string; answer: string; required: boolean }[]>();
  for (const line of cart.lines) {
    const forms = ((line.service.intakeForms as any[]) ?? []);
    if (!forms.length) continue;
    const submitted = body.intakeAnswers?.[line.id] ?? {};
    const answers: { name: string; type: string; answer: string; required: boolean }[] = [];
    for (const fm of forms) {
      const answer = String(submitted[fm.name] ?? "").trim();
      if (fm.required && !answer) throw new AppError(400, `"${line.service.name}": please provide "${fm.name}" before checkout.`);
      const type = (fm.type as string) ?? "TEXT";
      if (type === "FILE" && answer) {
        const filename = pendingUploadFilename(answer);
        const key = privateUploadKeyFromReference(answer, u.id);
        if (!filename || !key || key !== pendingUploadKey(u.id, filename) || !await privateObjectExists(key)) {
          throw new AppError(400, `"${line.service.name}": upload a valid file for "${fm.name}".`);
        }
      }
      answers.push({ name: fm.name, type, answer, required: !!fm.required });
    }
    intakeByLine.set(line.id, answers);
  }

  const committedLineIds: string[] = [];
  const result = await prisma.$transaction(async (tx) => {
    let subtotal = 0;
    let platformFee = 0;
    let taxAmount = 0;

    // Allocate invoice numbers uniquely within the transaction (multiple FIXED lines).
    const year = new Date().getFullYear();
    const invPrefix = `INV-${year}-`;
    let invSeq = await tx.invoice.count({ where: { number: { startsWith: invPrefix } } });

    for (const line of cart.lines) {
      const inst = line.institution;
      if (line.service.pricingMode === "FIXED" && line.buyerAmount != null) {
        // FIXED line: use discount-adjusted amounts (coupon + credits applied above).
        const adj = adjByLine.get(line.id);
        const lineSubtotal = adj ? adj.buyerAmount : line.buyerAmount;
        const linePlatformFee = adj ? adj.platformFeeAmount : (line.platformFeeAmount ?? 0);
        const lineProviderAmount = adj ? adj.providerAmount : (line.providerAmount ?? 0);
        const lineTax = Math.round(lineSubtotal * inst.taxRate);
        const lineTotal = lineSubtotal + lineTax;
        subtotal += lineSubtotal;
        platformFee += linePlatformFee;
        taxAmount += lineTax;

        invSeq += 1;
        const invoiceNumber = `${invPrefix}${String(invSeq).padStart(4, "0")}`;
        await tx.invoice.create({
          data: {
            number: invoiceNumber,
            orderId: line.id,
            institutionId: line.institutionId,
            subtotal: lineSubtotal,
            taxRate: inst.taxRate,
            taxAmount: lineTax,
            total: lineTotal,
            currency: inst.currency,
            status: "ISSUED",
          },
        });
        await tx.settlement.create({
          data: {
            orderId: line.id,
            grossAmount: lineTotal,
            takeRate: lineSubtotal > 0 ? linePlatformFee / lineSubtotal : 0,
            platformFee: linePlatformFee,
            netToProvider: lineProviderAmount,
            status: "PENDING",
          },
        });
        await tx.serviceOrder.update({
          where: { id: line.id },
          data: { status: "SAMPLE_AWAITED", quotedPrice: lineSubtotal, ...(intakeByLine.has(line.id) ? { intakeAnswers: intakeByLine.get(line.id) } : {}) },
        });
        await tx.orderEvent.create({
          data: { orderId: line.id, type: "status", message: "Order placed (fixed price); invoice issued", actor: u.id },
        });
        committedLineIds.push(line.id);
      } else {
        // QUOTE line: becomes an RFQ awaiting the provider's quote.
        await tx.serviceOrder.update({
          where: { id: line.id },
          data: { status: "QUOTE_REQUESTED", ...(intakeByLine.has(line.id) ? { intakeAnswers: intakeByLine.get(line.id) } : {}) },
        });
        await tx.orderEvent.create({
          data: { orderId: line.id, type: "status", message: "Quote requested", actor: u.id },
        });
      }
    }

    // Persist the buyer's declared samples (structured, config-driven at the UI).
    if (body.samples && body.samples.length > 0) {
      await tx.orderSample.createMany({
        data: body.samples.map((s) => ({
          orderId: cart.id,
          label: s.label,
          description: s.description ?? null,
          quantity: s.quantity ?? 1,
          condition: s.condition ?? null,
        })),
      });
    }

    // Record coupon redemption + wallet credit usage.
    if (applied.couponId) {
      await tx.couponRedemption.create({ data: { couponId: applied.couponId, orderId: cart.id, buyerId: u.id, amount: applied.couponDiscount } });
      await tx.coupon.update({ where: { id: applied.couponId }, data: { timesUsed: { increment: 1 } } });
    }
    for (const r of applied.creditRedemptions) {
      await tx.creditEntry.create({ data: { buyerId: u.id, type: "REDEEM", amount: -r.amount, funder: r.funder, institutionId: r.institutionId, orderId: cart.id, reason: `Applied to order ${cart.code}` } });
    }

    const total = subtotal + taxAmount;
    const placed = await tx.order.update({
      where: { id: cart.id },
      data: {
        status: "PLACED", subtotal, platformFee, taxAmount, total, shippingNote: body.shippingNote ?? null,
        discountAmount: applied.couponDiscount, creditApplied: applied.creditApplied, couponCode: applied.couponCode ?? null,
      },
      include: cartInclude,
    });
    return placed;
  });

  // FIXED lines are now committed → consume instrument capacity for each.
  for (const lineId of committedLineIds) {
    await reserveForOrder(lineId);
  }

  await prisma.auditLog.create({
    data: { userId: u.id, action: "checkout", entity: "Order", entityId: cart.id, meta: { lines: cart.lines.length } },
  });
  res.json({
    ...result,
    lines: result.lines.map(secureOrderFileUrls),
  });
});
