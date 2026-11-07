import { createHash } from "node:crypto";
import path from "node:path";
import { privateObjectKeyFromReference } from "./storage";

export function pendingUploadKey(userId: string, filename: string): string {
  const ownerDirectory = createHash("sha256").update(userId).digest("hex");
  return `pending/${ownerDirectory}/${path.basename(filename)}`;
}

export function pendingUploadFilename(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const storageKey = privateObjectKeyFromReference(value);
    if (storageKey?.startsWith("pending/")) {
      const filename = path.posix.basename(storageKey);
      return /^[a-f0-9]{32}(?:\.[a-z0-9]{1,32})?$/i.test(filename) ? filename : null;
    }
    const pathname = new URL(value, "http://uploads.invalid").pathname;
    if (!/^\/uploads\/pending\/[^/]+$/.test(pathname)) return null;
    const filename = path.basename(pathname);
    return /^[a-f0-9]{32}(?:\.[a-z0-9]{1,32})?$/i.test(filename) ? filename : null;
  } catch {
    return null;
  }
}

export function uploadFilenameFromUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const storageKey = privateObjectKeyFromReference(value);
    if (storageKey) {
      const filename = path.posix.basename(storageKey);
      return /^[a-f0-9]{32}(?:\.[a-z0-9]{1,32})?$/i.test(filename) ? filename : null;
    }
    const pathname = new URL(value, "http://uploads.invalid").pathname;
    if (
      !/(?:^|\/)uploads\/(?:pending\/)?[^/]+$/.test(pathname) &&
      !/\/api\/orders\/[^/]+\/files\/[^/]+$/.test(pathname)
    ) return null;
    const filename = path.basename(pathname);
    return /^[a-f0-9]{32}(?:\.[a-z0-9]{1,32})?$/i.test(filename) ? filename : null;
  } catch {
    return null;
  }
}

export function privateUploadKeyFromReference(
  value: string | null | undefined,
  buyerId: string,
): string | null {
  const storageKey = privateObjectKeyFromReference(value);
  if (storageKey) return storageKey;
  const filename = uploadFilenameFromUrl(value);
  if (!filename) return null;
  if (pendingUploadFilename(value)) return pendingUploadKey(buyerId, filename);
  try {
    if (value && /\/api\/orders\/[^/]+\/files\/[^/]+$/.test(new URL(value, "http://uploads.invalid").pathname)) {
      return null;
    }
  } catch {
    return null;
  }
  return filename;
}
