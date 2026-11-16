import { describe, expect, it } from "vitest";
import { money, dateShort, initials, statusTone, orderLabel } from "../src/lib/format";

describe("Frontend Formatters & Presentation Logic", () => {
  it("formats Indian Rupee currency correctly with symbol and zero decimals", () => {
    const formatted = money(50000, "INR");
    expect(formatted).toContain("50,000");
    expect(formatted).toMatch(/₹|INR/);
  });

  it("handles null or zero amounts cleanly", () => {
    expect(money(null)).toBe("-");
    expect(money(undefined)).toBe("-");
    expect(money(0, "INR")).toContain("0");
  });

  it("formats dates in short readable standard", () => {
    const d = new Date("2026-11-15T00:00:00Z");
    const formatted = dateShort(d);
    expect(formatted).toMatch(/15 Nov 2026/);
    expect(dateShort(null)).toBe("-");
  });

  it("extracts initials from full names", () => {
    expect(initials("Murali Krishna")).toBe("MK");
    expect(initials("Single")).toBe("S");
    expect(initials("")).toBe("?");
  });

  it("maps order and payment lifecycle statuses to appropriate UI tones", () => {
    expect(statusTone("COMPLETED")).toBe("success");
    expect(statusTone("PAID")).toBe("success");
    expect(statusTone("CANCELLED")).toBe("danger");
    expect(statusTone("OVERDUE")).toBe("danger");
    expect(statusTone("IN_PROGRESS")).toBe("info");
    expect(statusTone("SAMPLE_AWAITED")).toBe("warning");
  });

  it("maps internal status enums to human readable labels", () => {
    expect(orderLabel("QUOTE_REQUESTED")).toBe("Quote requested");
    expect(orderLabel("SAMPLE_AWAITED")).toBe("Sample awaited");
    expect(orderLabel("COMPLETED")).toBe("Completed");
  });
});
