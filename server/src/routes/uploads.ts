import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import { AppError } from "../http";
import { requireAuth, requireRole } from "../middleware/auth";
import { putObject, publicObjectUrl } from "../lib/storage";

export const uploadsRouter = Router();

const PUBLIC_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
]);
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // ~15MB
  fileFilter: (_req, file, cb) => {
    if (PUBLIC_IMAGE_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, "Only JPEG, PNG, GIF, WebP, or AVIF images are allowed"));
    }
  },
});

// POST /uploads — public image upload. Private documents use the order document endpoint.
uploadsRouter.post(
  "/uploads",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "LAB_MANAGER"),
  upload.single("file"),
  async (req, res) => {
    if (!req.file) throw new AppError(400, "No file uploaded (field name must be 'file')");
    const extension = IMAGE_EXTENSIONS[req.file.mimetype];
    if (!extension) throw new AppError(400, "Unsupported image type");
    const key = `images/${crypto.randomBytes(16).toString("hex")}${extension}`;
    await putObject({
      visibility: "public",
      key,
      body: req.file.buffer,
      contentType: req.file.mimetype,
    });
    const url = publicObjectUrl(key);
    res.status(201).json({ url });
  }
);
