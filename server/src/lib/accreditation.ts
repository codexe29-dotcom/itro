export type AccreditationStatus = "ACTIVE" | "EXPIRING" | "EXPIRED" | "UNKNOWN";

/** Live status from the expiry date: expiring window is 60 days. */
export function accreditationStatus(expiresAt: Date | null | undefined): AccreditationStatus {
  if (!expiresAt) return "UNKNOWN";
  const now = Date.now();
  const t = expiresAt.getTime();
  if (t < now) return "EXPIRED";
  if (t - now <= 60 * 24 * 60 * 60 * 1000) return "EXPIRING";
  return "ACTIVE";
}

interface RawAccreditation {
  id: string; body: string; certNumber: string | null; scope: string[];
  issuedAt: Date | null; expiresAt: Date | null; verifyUrl: string | null;
}

export function shapeAccreditation(a: RawAccreditation) {
  return {
    id: a.id,
    body: a.body,
    certNumber: a.certNumber,
    scope: a.scope,
    issuedAt: a.issuedAt,
    expiresAt: a.expiresAt,
    verifyUrl: a.verifyUrl,
    status: accreditationStatus(a.expiresAt),
  };
}
