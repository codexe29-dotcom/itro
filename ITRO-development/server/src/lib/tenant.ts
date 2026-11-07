import type { AuthUser } from "../middleware/auth";
import { AppError } from "../http";

/**
 * Resolve the institution a request must be scoped to.
 * - SUPER_ADMIN may optionally pass an institutionId (query/body) to scope; otherwise unscoped (returns undefined).
 * - Everyone else is locked to their own institutionId (never trust client input).
 */
export function scopedInstitutionId(user: AuthUser, requested?: string): string | undefined {
  if (user.role === "SUPER_ADMIN") {
    return requested || undefined;
  }
  if (!user.institutionId) {
    throw new AppError(403, "User is not associated with an institution");
  }
  return user.institutionId;
}

/** Require a concrete institution id for the acting (non-super) user. */
export function requireInstitutionId(user: AuthUser): string {
  if (user.institutionId) return user.institutionId;
  throw new AppError(403, "User is not associated with an institution");
}
