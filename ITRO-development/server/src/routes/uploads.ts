import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { AppError } from "../http";
import { requireAuth, requireRole, currentUser } from "../middleware/auth";

export const uploadsRouter = Router();

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
// Ensure the upload directory exists — on a fresh production host it won't, and
// multer's diskStorage throws ENOENT on every upload if the folder is missing.
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    const name = crypto.randomBytes(16).toString("hex") + ext;
    cb(null, name);
  },
});

// Allowed non-image document mime types.
const DOC_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/plain",
]);

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // ~15MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || DOC_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, "Only image or document files (PDF, Word, Excel, text) are allowed"));
    }
  },
});

// POST /uploads — real file upload (images and documents). Field name: "file".
uploadsRouter.post(
  "/uploads",
  requireAuth,
  requireRole("INSTITUTION_ADMIN", "LAB_MANAGER"),
  upload.single("file"),
  async (req, res) => {
    const u = currentUser(req);
    if (!req.file) throw new AppError(400, "No file uploaded (field name must be 'file')");
    // Relative path — resolves against the page origin, so it works on any host
    // (dev via Vite proxy, prod via nginx /uploads proxy). Absolute localhost URLs
    // break on mixed-content HTTPS pages and on any host other than the uploader's.
    const url = `/uploads/${req.file.filename}`;
    void u;
    res.status(201).json({ url });
  }
);
