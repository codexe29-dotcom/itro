import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db";
import { AppError } from "../http";
import { currentUser } from "../middleware/auth";
import {
  privateUploadKeyFromReference,
  uploadFilenameFromUrl,
} from "../lib/uploads";
import { env } from "../env";
import {
  createPrivateDownloadUrl,
  openPrivateObject,
  privateObjectExists,
} from "../lib/storage";

function downloadUrl(orderId: string, filename: string): string {
  const apiUrl = env.publicApiUrl.replace(/\/+$/, "");
  return `${apiUrl}/api/orders/${encodeURIComponent(orderId)}/files/${encodeURIComponent(filename)}`;
}

export function secureOrderFileUrls<T extends {
  id: string;
  reportUrl?: string | null;
  intakeAnswers?: unknown;
  documents?: Array<{ id: string; url: string }>;
}>(order: T) {
  const intakeAnswers = Array.isArray(order.intakeAnswers)
    ? order.intakeAnswers.map((answer) => {
        if (!answer || typeof answer !== "object" || !("answer" in answer)) return answer;
        const fileUrl = uploadFilenameFromUrl(
          typeof answer.answer === "string" ? answer.answer : null,
        );
        return fileUrl ? { ...answer, answer: downloadUrl(order.id, fileUrl) } : answer;
      })
    : order.intakeAnswers;

  const reportFilename = uploadFilenameFromUrl(order.reportUrl);
  return {
    ...order,
    reportUrl: reportFilename ? downloadUrl(order.id, reportFilename) : order.reportUrl,
    intakeAnswers,
    documents: order.documents?.map((document) => {
      const filename = uploadFilenameFromUrl(document.url);
      return filename ? { ...document, url: downloadUrl(order.id, filename) } : document;
    }),
  };
}

export async function downloadOrderFile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = currentUser(req);
  const order = await prisma.serviceOrder.findUnique({
    where: { id: req.params.id },
    select: {
      buyerId: true,
      institutionId: true,
      reportUrl: true,
      intakeAnswers: true,
      documents: { select: { url: true } },
    },
  });

  if (!order) throw new AppError(404, "Order not found");

  const isBuyer = order.buyerId === user.id;
  const isProvider = ["INSTITUTION_ADMIN", "LAB_MANAGER", "OPERATOR"].includes(user.role);
  const isInstitution =
    isProvider &&
    order.institutionId === user.institutionId;
  if (user.role !== "SUPER_ADMIN" && !isBuyer && !isInstitution) {
    throw new AppError(403, "Cannot access files for this order");
  }

  const filename = path.basename(req.params.filename);
  if (!/^[a-f0-9]{32}(?:\.[a-z0-9]{1,32})?$/i.test(filename)) {
    throw new AppError(404, "File not found");
  }
  const referencedFiles = [
    order.reportUrl,
    ...order.documents.map((document) => document.url),
    ...(Array.isArray(order.intakeAnswers)
      ? order.intakeAnswers.flatMap((answer) =>
          answer && typeof answer === "object" && "answer" in answer && typeof answer.answer === "string"
            ? [answer.answer]
            : [],
        )
      : []),
  ];
  const objectKey = referencedFiles
    .map((reference) => privateUploadKeyFromReference(reference, order.buyerId))
    .find((key) => key && path.posix.basename(key) === filename);
  if (!objectKey || !referencedFiles.some((url) => uploadFilenameFromUrl(url) === filename)) {
    throw new AppError(404, "File not found");
  }

  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!await privateObjectExists(objectKey)) throw new AppError(404, "File not found");
  if (env.storageDriver === "s3") {
    const signedUrl = await createPrivateDownloadUrl(objectKey, filename);
    res.redirect(302, signedUrl);
    return;
  }

  res.type("application/octet-stream").attachment(filename);
  const file = await openPrivateObject(objectKey);
  file.on("error", (error) => {
    if (res.headersSent) {
      res.destroy(error);
      return;
    }
    next(error);
  });
  file.pipe(res);
}
