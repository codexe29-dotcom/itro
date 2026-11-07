import { Router } from "express";
import { prisma } from "../db";
import { AppError, paginate, pageResult, strParam } from "../http";
import { requireAuth, requireRole, currentUser } from "../middleware/auth";

export const settlementsRouter = Router();

// GET /settlements — SUPER_ADMIN: all settlements (+order, +institution)
settlementsRouter.get("/", requireAuth, requireRole(), async (req, res) => {
  const u = currentUser(req);
  if (u.role !== "SUPER_ADMIN") throw new AppError(403, "Platform admins only");
  const p = paginate(req.query);
  const where: any = {};
  const status = strParam(req.query, "status");
  if (status) where.status = status;

  const [data, total] = await Promise.all([
    prisma.settlement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: p.skip,
      take: p.take,
      include: {
        order: {
          select: {
            id: true,
            code: true,
            status: true,
            institution: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    }),
    prisma.settlement.count({ where }),
  ]);
  res.json(pageResult(data, total, p));
});

// POST /settlements/:id/release — SUPER_ADMIN -> RELEASED
settlementsRouter.post("/:id/release", requireAuth, requireRole(), async (req, res) => {
  const u = currentUser(req);
  if (u.role !== "SUPER_ADMIN") throw new AppError(403, "Platform admins only");
  const settlement = await prisma.settlement.findUnique({ where: { id: req.params.id } });
  if (!settlement) throw new AppError(404, "Settlement not found");
  if (settlement.status === "RELEASED") throw new AppError(409, "Settlement already released");
  const updated = await prisma.settlement.update({
    where: { id: settlement.id },
    data: { status: "RELEASED", releasedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: { userId: u.id, action: "release", entity: "Settlement", entityId: settlement.id },
  });
  res.json(updated);
});
