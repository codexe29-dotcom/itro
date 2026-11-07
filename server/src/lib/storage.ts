import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createReadStream } from "node:fs";
import { lstat, mkdir, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { env } from "../env";

export type StorageVisibility = "public" | "private";
export const PRIVATE_REFERENCE_PREFIX = "storage://private/";

const publicDirectory = path.resolve(env.storageLocalRoot, "public-uploads");
const privateDirectory = path.resolve(env.storageLocalRoot, "uploads");

let client: S3Client | undefined;

function s3Client(): S3Client {
  if (!client) {
    if (env.storageDriver !== "s3") throw new Error("S3 client requested while STORAGE_DRIVER is not 's3'.");
    client = new S3Client({
      region: env.s3Region,
      endpoint: env.s3Endpoint,
      forcePathStyle: Boolean(env.s3Endpoint),
      credentials: {
        accessKeyId: env.s3AccessKeyId,
        secretAccessKey: env.s3SecretAccessKey,
      },
    });
  }
  return client;
}

function safeKey(key: string): string {
  const normalized = key.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Invalid storage object key.");
  }
  return normalized;
}

function directoryFor(visibility: StorageVisibility): string {
  return visibility === "public" ? publicDirectory : privateDirectory;
}

function localPath(visibility: StorageVisibility, key: string): string {
  const directory = directoryFor(visibility);
  const target = path.resolve(directory, ...safeKey(key).split("/"));
  if (!target.startsWith(`${directory}${path.sep}`)) throw new Error("Storage object key is outside its configured directory.");
  return target;
}

function bucketKey(visibility: StorageVisibility, key: string): string {
  return `${visibility}/${safeKey(key)}`;
}

function encodedPath(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

export function privateObjectReference(key: string): string {
  return `${PRIVATE_REFERENCE_PREFIX}${safeKey(key)}`;
}

export function privateObjectKeyFromReference(reference: string | null | undefined): string | null {
  if (!reference) return null;
  if (!reference.startsWith(PRIVATE_REFERENCE_PREFIX)) return null;
  try {
    return safeKey(reference.slice(PRIVATE_REFERENCE_PREFIX.length));
  } catch {
    return null;
  }
}

export async function putObject(input: {
  visibility: StorageVisibility;
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  const key = safeKey(input.key);
  if (env.storageDriver === "s3") {
    await s3Client().send(new PutObjectCommand({
      Bucket: env.s3BucketName,
      Key: bucketKey(input.visibility, key),
      Body: input.body,
      ContentLength: input.body.byteLength,
      ContentType: input.contentType,
      ...(input.visibility === "public" ? { CacheControl: "public, max-age=31536000, immutable" } : {}),
    }));
    return;
  }

  const filePath = localPath(input.visibility, key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, input.body, { flag: "wx" });
}

export function publicObjectUrl(key: string): string {
  const normalized = safeKey(key);
  if (env.storageDriver === "local") return `/uploads/${encodedPath(normalized)}`;
  if (env.storagePublicBaseUrl) {
    return `${env.storagePublicBaseUrl}/${encodedPath(bucketKey("public", normalized))}`;
  }
  return `https://${env.s3BucketName}.s3.${env.s3Region}.amazonaws.com/${encodedPath(bucketKey("public", normalized))}`;
}

export async function privateObjectExists(key: string): Promise<boolean> {
  const normalized = safeKey(key);
  if (env.storageDriver === "s3") {
    try {
      await s3Client().send(new HeadObjectCommand({
        Bucket: env.s3BucketName,
        Key: bucketKey("private", normalized),
      }));
      return true;
    } catch (error) {
      if (error instanceof Error && "name" in error && error.name === "NotFound") return false;
      if (error instanceof Error && "$metadata" in error &&
          typeof error.$metadata === "object" && error.$metadata !== null &&
          "httpStatusCode" in error.$metadata && error.$metadata.httpStatusCode === 404) return false;
      throw error;
    }
  }

  try {
    const info = await lstat(localPath("private", normalized));
    return info.isFile() && !info.isSymbolicLink();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

export async function openPrivateObject(key: string): Promise<Readable> {
  const normalized = safeKey(key);
  if (env.storageDriver === "local") {
    const filePath = localPath("private", normalized);
    const info = await lstat(filePath);
    if (!info.isFile() || info.isSymbolicLink()) {
      const error = new Error("Private file not found.") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    }
    return createReadStream(filePath);
  }

  const result = await s3Client().send(new GetObjectCommand({
    Bucket: env.s3BucketName,
    Key: bucketKey("private", normalized),
  }));
  if (!result.Body) {
    const error = new Error("Private file not found.") as NodeJS.ErrnoException;
    error.code = "ENOENT";
    throw error;
  }
  if (result.Body instanceof Readable) return result.Body;
  const webStream = result.Body.transformToWebStream();
  return Readable.from((async function* () {
    const reader = webStream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        yield Buffer.from(value);
      }
    } finally {
      reader.releaseLock();
    }
  })());
}

export async function createPrivateDownloadUrl(
  key: string,
  filename: string,
  expiresInSeconds = 300,
): Promise<string> {
  if (env.storageDriver !== "s3") {
    throw new Error("Presigned URLs are available only when STORAGE_DRIVER=s3.");
  }
  const safeFilename = filename.replace(/[\r\n"\\]/g, "_");
  return getSignedUrl(
    s3Client(),
    new GetObjectCommand({
      Bucket: env.s3BucketName,
      Key: bucketKey("private", key),
      ResponseContentType: "application/octet-stream",
      ResponseContentDisposition: `attachment; filename="${safeFilename}"`,
      ResponseCacheControl: "private, no-store",
    }),
    { expiresIn: expiresInSeconds },
  );
}
