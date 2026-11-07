import type { OrderEvent } from "@/lib/types";
import { dateTime } from "@/lib/format";
import { CircleDot } from "lucide-react";

export default function OrderTimeline({ events }: { events?: OrderEvent[] }) {
  if (!events || events.length === 0) {
    return <p className="text-sm text-ink-muted">No activity yet.</p>;
  }
  const sorted = [...events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  return (
    <ol className="relative ml-2 border-l border-surface-border">
      {sorted.map((ev) => (
        <li key={ev.id} className="mb-5 ml-5 last:mb-0">
          <span className="absolute -left-[7px] flex h-3.5 w-3.5 items-center justify-center">
            <CircleDot className="h-3.5 w-3.5 text-brand-500" />
          </span>
          <p className="text-sm font-medium text-ink">{ev.message}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {dateTime(ev.createdAt)}
            {ev.actor && <span> · {ev.actor}</span>}
          </p>
        </li>
      ))}
    </ol>
  );
}
