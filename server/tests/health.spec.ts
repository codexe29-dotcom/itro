import { describe, expect, it } from "vitest";
import { databaseFailureReason } from "../src/db";

describe("Database Health Diagnostics & Error Sanitization", () => {
  it("sanitizes credential rejection without leaking user/password details", () => {
    const reason = databaseFailureReason("P1000");
    expect(reason).toBe("The database rejected the configured credentials.");
    expect(reason).not.toContain("password");
    expect(reason).not.toContain("postgres://");
  });

  it("sanitizes unreachable network errors", () => {
    const reason = databaseFailureReason("P1001");
    expect(reason).toContain("The database server could not be reached");
  });

  it("sanitizes malformed database URL error", () => {
    const reason = databaseFailureReason("P1013");
    expect(reason).toContain("The database URL is malformed");
  });

  it("returns generic safe fallback for unknown errors", () => {
    const reason = databaseFailureReason("P9999");
    expect(reason).toBe("The database query failed. Check the API logs and database configuration.");
  });
});
