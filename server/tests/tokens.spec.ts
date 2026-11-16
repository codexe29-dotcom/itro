import { describe, expect, it } from "vitest";
import {
  hashPassword,
  comparePassword,
  signJwt,
  verifyJwt,
  type JwtPayload,
} from "../src/lib/tokens";

describe("Authentication & Token Cryptography", () => {
  it("hashes passwords securely with bcrypt", async () => {
    const raw = "SecurePassword@2026";
    const hash = await hashPassword(raw);

    expect(hash).not.toBe(raw);
    expect(hash).toMatch(/^\$2[aby]\$\d+\$/);
    expect(await comparePassword(raw, hash)).toBe(true);
    expect(await comparePassword("WrongPassword", hash)).toBe(false);
  });

  it("signs and verifies valid JWTs with payload integrity", () => {
    const payload: JwtPayload = {
      id: "usr_test_12345",
      role: "INDUSTRY_BUYER",
      institutionId: null,
      tokenVersion: 1,
    };

    const token = signJwt(payload);
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);

    const decoded = verifyJwt(token);
    expect(decoded.id).toBe(payload.id);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.institutionId).toBe(null);
    expect(decoded.tokenVersion).toBe(1);
  });

  it("rejects tampered or forged tokens", () => {
    const payload: JwtPayload = {
      id: "usr_test_12345",
      role: "INDUSTRY_BUYER",
      institutionId: null,
      tokenVersion: 1,
    };
    const token = signJwt(payload);
    const parts = token.split(".");
    // Tamper with payload
    const tampered = `${parts[0]}.eyJyZXBsYWNlZCI6InRydWUifQ.${parts[2]}`;

    expect(() => verifyJwt(tampered)).toThrow();
  });
});
