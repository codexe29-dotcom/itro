import { describe, expect, it, vi } from "vitest";
import { requireRole, type AuthUser } from "../src/middleware/auth";
import { AppError } from "../src/http";
import type { Request, Response, NextFunction } from "express";

describe("Role-Based Access Control (RBAC) Middleware", () => {
  const mockRes = {} as Response;

  it("throws 401 when request is unauthenticated", () => {
    const req = {} as Request;
    const next = vi.fn() as NextFunction;
    const guard = requireRole("INDUSTRY_BUYER");

    expect(() => guard(req, mockRes, next)).toThrow(AppError);
    expect(() => guard(req, mockRes, next)).toThrowError("Authentication required");
    expect(next).not.toHaveBeenCalled();
  });

  it("allows SUPER_ADMIN across any role-restricted boundary", () => {
    const req = {
      user: { id: "usr_admin", role: "SUPER_ADMIN", institutionId: null } as AuthUser,
    } as Request;
    const next = vi.fn() as NextFunction;
    const guard = requireRole("INSTITUTION_ADMIN");

    guard(req, mockRes, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("allows matching roles to proceed", () => {
    const req = {
      user: { id: "usr_buyer", role: "INDUSTRY_BUYER", institutionId: null } as AuthUser,
    } as Request;
    const next = vi.fn() as NextFunction;
    const guard = requireRole("INDUSTRY_BUYER");

    guard(req, mockRes, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("rejects non-matching roles with 403 Insufficient permissions", () => {
    const req = {
      user: { id: "usr_buyer", role: "INDUSTRY_BUYER", institutionId: null } as AuthUser,
    } as Request;
    const next = vi.fn() as NextFunction;
    const guard = requireRole("INSTITUTION_ADMIN", "LAB_MANAGER");

    expect(() => guard(req, mockRes, next)).toThrow(AppError);
    expect(() => guard(req, mockRes, next)).toThrowError("Insufficient permissions");
    expect(next).not.toHaveBeenCalled();
  });
});
