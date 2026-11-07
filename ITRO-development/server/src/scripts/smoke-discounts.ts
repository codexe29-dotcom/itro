/**
 * End-to-end smoke test for discounts + credits + bundles + checkout.
 * Mints real JWTs, drives the live HTTP API, asserts results, cleans up after itself.
 * Run with the dev server up: npx tsx src/scripts/smoke-discounts.ts
 */
import { prisma } from "../db";
import { signJwt } from "../lib/tokens";

const BASE = "http://localhost:4000/api";
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ✓ PASS" : "  ✗ FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};
async function api(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  const txt = await res.text();
  try { json = txt ? JSON.parse(txt) : null; } catch { json = txt; }
  return { status: res.status, json };
}

async function main() {
  const created = { couponId: "", bundleId: "", buyerId: "", orderIds: [] as string[], creditEntryIds: [] as string[] };
  let restoreDiscount: { serviceId: string; discountPct: number } | null = null;
  try {
    // ---- Setup: ADART provider admin + a buyer + two FIXED services ----
    const adart = await prisma.institution.findUnique({ where: { slug: "adart" } });
    if (!adart) throw new Error("ADART not found");
    const admin = await prisma.user.findFirst({ where: { institutionId: adart.id, role: { in: ["INSTITUTION_ADMIN", "LAB_MANAGER"] } } });
    if (!admin) throw new Error("No ADART admin user");
    let buyer = await prisma.user.findFirst({ where: { role: "INDUSTRY_BUYER" } });
    if (!buyer) {
      buyer = await prisma.user.create({ data: { role: "INDUSTRY_BUYER", name: "Smoke Buyer", email: `smoke+${Date.now()}@itro.test`, passwordHash: "x", orgName: "Smoke Test Co" } });
      created.buyerId = buyer.id;
    }
    const services = await prisma.service.findMany({ where: { institutionId: adart.id, pricingMode: "FIXED", isActive: true }, take: 3, select: { id: true, name: true, priceIndustry: true, discountPct: true, category: true } });
    if (services.length < 2) throw new Error("Need 2+ FIXED ADART services");

    const providerToken = signJwt({ id: admin.id, role: admin.role, institutionId: admin.institutionId } as any);
    const buyerToken = signJwt({ id: buyer.id, role: buyer.role, institutionId: null } as any);

    console.log("\n=== A. PROVIDER SETS UP DISCOUNTS ===");
    // 1) Coupon
    const code = `SMOKE${Date.now().toString().slice(-5)}`;
    let r = await api("POST", "/coupons", providerToken, { code, name: "Smoke 10%", kind: "PERCENT", value: 10 });
    check("Provider creates 10% coupon", r.status === 201 && r.json?.funder === "PROVIDER", `status ${r.status}`);
    created.couponId = r.json?.id;

    // 2) Service-level discount (20% on service[0])
    restoreDiscount = { serviceId: services[0].id, discountPct: services[0].discountPct };
    r = await api("PATCH", `/services/${services[0].id}`, providerToken, { discountPct: 20 });
    check("Provider sets 20% service discount", r.status === 200 && r.json?.discountPct === 20, `status ${r.status}`);

    // 3) Issue ₹3000 credit to buyer
    r = await api("POST", "/credits/issue", providerToken, { buyerEmail: buyer.email, amount: 3000, reason: "Smoke test" });
    check("Provider issues ₹3000 credit", r.status === 201 && r.json?.buyerBalance >= 3000, `balance ${r.json?.buyerBalance}`);

    // 4) Bundle of 2 services @ 15%
    r = await api("POST", "/bundles", providerToken, { name: `Smoke Bundle ${Date.now().toString().slice(-4)}`, discountPct: 15, serviceIds: [services[0].id, services[1].id] });
    const bundleOk = r.status === 201 && r.json?.quote?.savings > 0;
    check("Provider creates 15% bundle", bundleOk, `savings ${r.json?.quote?.savings}`);
    created.bundleId = r.json?.id;
    const bundleSlug = r.json?.slug;

    console.log("\n=== B. BUYER: SERVICE DISCOUNT + COUPON + CREDITS + CHECKOUT ===");
    // Clear any existing cart
    let cart = (await api("GET", "/cart", buyerToken)).json;
    for (const l of cart?.lines ?? []) await api("DELETE", `/cart/items/${l.id}`, buyerToken);

    // Wallet balance
    r = await api("GET", "/credits/me", buyerToken);
    check("Buyer wallet shows credits", r.status === 200 && r.json?.total >= 3000, `total ${r.json?.total}`);

    // Add the 20%-discounted service
    r = await api("POST", "/cart/items", buyerToken, { serviceId: services[0].id });
    const line = r.json?.lines?.[0];
    check("Add-to-cart applies service discount", !!line?.listPrice && line.listPrice > line.buyerAmount, `list ${line?.listPrice} > pay ${line?.buyerAmount}`);

    // Preview coupon + credits
    r = await api("POST", "/cart/preview-discount", buyerToken, { couponCode: code, useCredits: true });
    const pv = r.json;
    check("Preview applies coupon discount", pv?.discountAmount > 0 && pv?.couponCode === code, `discount ${pv?.discountAmount}`);
    check("Preview applies wallet credits", pv?.creditApplied > 0, `credit ${pv?.creditApplied}`);
    check("Preview total < gross", pv?.newSubtotal < pv?.grossSubtotal, `${pv?.newSubtotal} < ${pv?.grossSubtotal}`);

    // Checkout with coupon + credits
    r = await api("POST", "/cart/checkout", buyerToken, { couponCode: code, useCredits: true, samples: [{ label: "Smoke sample", quantity: 1 }] });
    const order = r.json;
    check("Checkout succeeds", r.status === 200 && order?.status === "PLACED", `status ${r.status}`);
    check("Order records coupon + discount", order?.couponCode === code && order?.discountAmount > 0, `discount ${order?.discountAmount}`);
    check("Order records credits applied", order?.creditApplied > 0, `credit ${order?.creditApplied}`);
    if (order?.id) created.orderIds.push(order.id);

    // Coupon usage incremented + credit REDEEM recorded
    const couponAfter = await prisma.coupon.findUnique({ where: { id: created.couponId } });
    check("Coupon timesUsed incremented", (couponAfter?.timesUsed ?? 0) === 1, `used ${couponAfter?.timesUsed}`);
    const redeem = await prisma.creditEntry.findFirst({ where: { buyerId: buyer.id, type: "REDEEM", orderId: order?.id } });
    check("Credit REDEEM ledger entry created", !!redeem && redeem.amount < 0, `amount ${redeem?.amount}`);

    console.log("\n=== C. BUYER: BUNDLE CHECKOUT ===");
    cart = (await api("GET", "/cart", buyerToken)).json;
    for (const l of cart?.lines ?? []) await api("DELETE", `/cart/items/${l.id}`, buyerToken);
    r = await api("POST", "/cart/bundle", buyerToken, { bundleSlug });
    const bl = r.json?.lines ?? [];
    check("Add-bundle creates 2 discounted lines", bl.length === 2 && bl.every((l: any) => l.listPrice > l.buyerAmount), `lines ${bl.length}`);
    r = await api("POST", "/cart/checkout", buyerToken, {});
    check("Bundle checkout succeeds", r.status === 200 && r.json?.status === "PLACED", `status ${r.status}`);
    if (r.json?.id) created.orderIds.push(r.json.id);

  } finally {
    // ---- Teardown ----
    console.log("\n=== TEARDOWN ===");
    for (const orderId of created.orderIds) {
      const lines = await prisma.serviceOrder.findMany({ where: { orderId }, select: { id: true } });
      for (const l of lines) {
        const invs = await prisma.invoice.findMany({ where: { orderId: l.id }, select: { id: true } });
        for (const iv of invs) await prisma.payment.deleteMany({ where: { invoiceId: iv.id } });
        await prisma.invoice.deleteMany({ where: { orderId: l.id } });
        await prisma.review.deleteMany({ where: { orderId: l.id } });
        await prisma.orderEvent.deleteMany({ where: { orderId: l.id } });
        await prisma.settlement.deleteMany({ where: { orderId: l.id } });
        await prisma.capacityReservation.deleteMany({ where: { serviceOrderId: l.id } });
        await prisma.serviceOrder.delete({ where: { id: l.id } });
      }
      await prisma.couponRedemption.deleteMany({ where: { orderId } });
      await prisma.creditEntry.deleteMany({ where: { orderId } });
      await prisma.orderSample.deleteMany({ where: { orderId } });
      await prisma.order.delete({ where: { id: orderId } });
    }
    if (created.couponId) await prisma.coupon.delete({ where: { id: created.couponId } }).catch(() => {});
    if (created.bundleId) await prisma.serviceBundle.delete({ where: { id: created.bundleId } }).catch(() => {});
    // Remove leftover ISSUE credits for this buyer created by the test
    if (restoreDiscount) await prisma.service.update({ where: { id: restoreDiscount.serviceId }, data: { discountPct: restoreDiscount.discountPct } });
    console.log("  cleaned up test orders, coupon, bundle; restored service discount");
    if (created.buyerId) {
      await prisma.creditEntry.deleteMany({ where: { buyerId: created.buyerId } });
      await prisma.order.deleteMany({ where: { buyerId: created.buyerId, status: "OPEN" } }).catch(() => {});
      await prisma.user.delete({ where: { id: created.buyerId } }).catch(() => {});
    }
    console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
    await prisma.$disconnect();
    process.exit(fail > 0 ? 1 : 0);
  }
}
main();
