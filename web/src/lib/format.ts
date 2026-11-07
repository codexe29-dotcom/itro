import { format, formatDistanceToNow } from "date-fns";

export function money(amount?: number | null, currency = "INR") {
  if (amount == null) return "-";
  const locale = currency === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency", currency, maximumFractionDigits: 0,
  }).format(amount);
}

export function dateShort(d?: string | Date | null) {
  if (!d) return "-";
  return format(new Date(d), "dd MMM yyyy");
}
export function dateTime(d?: string | Date | null) {
  if (!d) return "-";
  return format(new Date(d), "dd MMM yyyy, HH:mm");
}
export function fromNow(d?: string | Date | null) {
  if (!d) return "-";
  return formatDistanceToNow(new Date(d), { addSuffix: true });
}

export function initials(name?: string) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

const ORDER_LABEL: Record<string, string> = {
  DRAFT: "Draft", QUOTE_REQUESTED: "Quote requested", QUOTED: "Quoted",
  ACCEPTED: "Accepted", NDA_PENDING: "NDA pending", SAMPLE_AWAITED: "Sample awaited",
  IN_PROGRESS: "In progress", REPORT_READY: "Report ready", COMPLETED: "Completed", CANCELLED: "Cancelled",
};
export const orderLabel = (s: string) => ORDER_LABEL[s] ?? s;

export function statusTone(status: string): "gray" | "brand" | "success" | "warning" | "danger" | "info" {
  const map: Record<string, "gray" | "brand" | "success" | "warning" | "danger" | "info"> = {
    DRAFT: "gray", QUOTE_REQUESTED: "info", QUOTED: "brand", ACCEPTED: "brand",
    NDA_PENDING: "warning", SAMPLE_AWAITED: "warning", IN_PROGRESS: "info",
    REPORT_READY: "brand", COMPLETED: "success", CANCELLED: "danger",
    AVAILABLE: "success", BOOKED: "warning", MAINTENANCE: "warning", OFFLINE: "danger",
    PENDING: "warning", APPROVED: "success", REJECTED: "danger",
    PAID: "success", ISSUED: "info", OVERDUE: "danger", VOID: "gray",
    SUCCESS: "success", FAILED: "danger", RELEASED: "success", ON_HOLD: "warning",
  };
  return map[status] ?? "gray";
}
