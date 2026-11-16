import { describe, expect, it } from "vitest";
import {
  privateObjectReference,
  privateObjectKeyFromReference,
  publicObjectUrl,
  PRIVATE_REFERENCE_PREFIX,
} from "../src/lib/storage";

describe("Storage Abstraction & Path Traversal Protections", () => {
  it("formats and parses private object references correctly", () => {
    const key = "orders/ord_123/report.pdf";
    const ref = privateObjectReference(key);

    expect(ref).toBe(`${PRIVATE_REFERENCE_PREFIX}${key}`);
    expect(privateObjectKeyFromReference(ref)).toBe(key);
  });

  it("handles null or invalid references gracefully", () => {
    expect(privateObjectKeyFromReference(null)).toBeNull();
    expect(privateObjectKeyFromReference("")).toBeNull();
    expect(privateObjectKeyFromReference("https://example.com/file.pdf")).toBeNull();
  });

  it("prevents directory traversal in reference keys", () => {
    const malicious = `${PRIVATE_REFERENCE_PREFIX}../../etc/passwd`;
    expect(privateObjectKeyFromReference(malicious)).toBeNull();
  });

  it("generates correct public object URLs", () => {
    const key = "images/logo.png";
    const url = publicObjectUrl(key);
    expect(url).toContain(encodeURIComponent("images/logo.png").replace(/%2F/g, "/"));
  });
});
