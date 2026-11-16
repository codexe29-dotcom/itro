import { describe, expect, it } from "vitest";
import {
  pendingUploadKey,
  pendingUploadFilename,
  uploadFilenameFromUrl,
} from "../src/lib/uploads";

describe("Upload Key Isolation & Filename Sanitization", () => {
  it("isolates pending upload keys by hashing the userId", () => {
    const userA = "usr_alpha";
    const userB = "usr_beta";
    const filename = "1234567890abcdef1234567890abcdef.pdf";

    const keyA = pendingUploadKey(userA, filename);
    const keyB = pendingUploadKey(userB, filename);

    expect(keyA).toMatch(/^pending\/[a-f0-9]{64}\/1234567890abcdef1234567890abcdef\.pdf$/);
    expect(keyB).toMatch(/^pending\/[a-f0-9]{64}\/1234567890abcdef1234567890abcdef\.pdf$/);
    expect(keyA).not.toBe(keyB);
  });

  it("extracts and validates hex filenames from urls", () => {
    const validUrl = "/uploads/pending/1234567890abcdef1234567890abcdef.pdf";
    expect(pendingUploadFilename(validUrl)).toBe("1234567890abcdef1234567890abcdef.pdf");

    const invalidName = "/uploads/pending/my_cool_script.sh";
    expect(pendingUploadFilename(invalidName)).toBeNull();

    const traversalName = "/uploads/pending/../../secret.txt";
    expect(pendingUploadFilename(traversalName)).toBeNull();
  });

  it("extracts valid filenames from order file download paths", () => {
    const orderFileUrl = "http://localhost:4000/api/orders/ord-1/files/abcdef1234567890abcdef1234567890.pdf";
    expect(uploadFilenameFromUrl(orderFileUrl)).toBe("abcdef1234567890abcdef1234567890.pdf");
  });
});
