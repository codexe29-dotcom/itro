import { describe, expect, it } from "vitest";
import { env } from "../src/env";

describe("Environment & Production Readiness Configuration", () => {
  it("loads default platform configuration", () => {
    expect(env.platformName).toBeTruthy();
    expect(env.platformDefaultCurrency).toBe("INR");
    expect(typeof env.port).toBe("number");
  });

  it("ensures CORS origin is properly configured and does not allow wildcard in production", () => {
    if (env.nodeEnv === "production") {
      expect(env.corsOrigin).not.toBe("*");
    }
    expect(env.corsOrigin.length).toBeGreaterThan(0);
  });

  it("verifies JWT expiration format", () => {
    expect(env.jwtExpiresIn).toMatch(/^\d+[smhdwy]$/);
  });
});
