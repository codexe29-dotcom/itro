import type { Request, Response, NextFunction } from "express";
import type { Role } from "@prisma/client";
import { AppError } from "../http";
import { verifyJwt } from "../lib/tokens";

export interface AuthUser {
  id: string;
  role: Role;
  institutionId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** Verify the Bearer JWT and attach req.user. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new AppError(401, "Authentication required");
  }
  const token = header.slice("Bearer ".length).trim();
  try {
    const payload = verifyJwt(token);
    req.user = {
      id: payload.id,
      role: payload.role,
      institutionId: payload.institutionId ?? null,
    };
  } catch {
    throw new AppError(401, "Invalid or expired token");
  }
  next();
}

/** Restrict a route to the given roles. SUPER_ADMIN is always allowed. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new AppError(401, "Authentication required");
    if (req.user.role === "SUPER_ADMIN") return next();
    if (!roles.includes(req.user.role)) {
      throw new AppError(403, "Insufficient permissions");
    }
    next();
  };
}

/** Convenience: throws unless a user is present. Returns the user. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new AppError(401, "Authentication required");
  return req.user;
}
