import type { Request, Response, NextFunction } from "express";
import type { Role } from "@prisma/client";
import { AppError } from "../http";
import { verifyJwt, type JwtPayload } from "../lib/tokens";
import { prisma } from "../db";

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
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const cookie = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("rix_session="));
  const token = cookie?.slice("rix_session=".length);

  if (!token) {
    throw new AppError(401, "Authentication required");
  }

  let payload: JwtPayload;
  try {
    payload = verifyJwt(token);
  } catch {
    throw new AppError(401, "Invalid or expired token");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, role: true, institutionId: true, isActive: true, authTokenVersion: true },
  });
  if (!user?.isActive || user.authTokenVersion !== payload.tokenVersion) {
    throw new AppError(401, "Invalid or expired token");
  }
  req.user = {
    id: user.id,
    role: user.role,
    institutionId: user.institutionId,
  };
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
