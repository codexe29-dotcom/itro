import type { Request } from "express";

/** Application error carrying an HTTP status code. */
export class AppError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.details = details;
  }
}

export interface Pagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  q?: string;
}

/** Parse ?page & ?pageSize & ?q from a request query. */
export function paginate(query: Request["query"]): Pagination {
  let page = Number.parseInt(String(query.page ?? "1"), 10);
  let pageSize = Number.parseInt(String(query.pageSize ?? "20"), 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = 20;
  if (pageSize > 100) pageSize = 100;
  const qRaw = query.q;
  const q = typeof qRaw === "string" && qRaw.trim() !== "" ? qRaw.trim() : undefined;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize, q };
}

export function pageResult<T>(data: T[], total: number, p: Pagination) {
  return { data, total, page: p.page, pageSize: p.pageSize };
}

/** Read a single string query param. */
export function strParam(query: Request["query"], key: string): string | undefined {
  const v = query[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

/** Read a single numeric query param. */
export function numParam(query: Request["query"], key: string): number | undefined {
  const v = strParam(query, key);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}
