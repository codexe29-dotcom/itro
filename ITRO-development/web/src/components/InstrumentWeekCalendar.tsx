import { useMemo, useState } from "react";
import {
  addDays, startOfWeek, format, isSameDay, parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import type { Booking, MaintenanceWindow, CapacityReservationRow } from "@/lib/types";
import { Button } from "@/components/ui";

interface Props {
  bookings: Booking[];
  maintenanceWindows: MaintenanceWindow[];
  reservations: CapacityReservationRow[];
}

type Kind = "booking" | "reservation" | "maintenance";

interface CalEntry {
  id: string;
  kind: Kind;
  label: string;
  sub?: string;
  start: Date;
  end?: Date;
  allDay?: boolean;
}

const KIND_STYLE: Record<Kind, string> = {
  // Blue palette only - differentiate by fill/weight, not hue.
  booking: "border-brand-300 bg-brand-50 text-brand-700",
  reservation: "border-brand-600 bg-brand-600 text-white",
  maintenance: "border-surface-border bg-surface-muted text-ink-soft",
};
const KIND_LABEL: Record<Kind, string> = {
  booking: "Booking",
  reservation: "Reserved",
  maintenance: "Maintenance",
};

/** A dependency-light 7-day week calendar (date-fns + CSS grid). */
export default function InstrumentWeekCalendar({ bookings, maintenanceWindows, reservations }: Props) {
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const weekStart = useMemo(() => startOfWeek(anchor, { weekStartsOn: 1 }), [anchor]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const entries = useMemo<CalEntry[]>(() => {
    const out: CalEntry[] = [];
    for (const b of bookings) {
      if (b.status === "CANCELLED" || b.status === "REJECTED") continue;
      out.push({
        id: `b-${b.id}`, kind: "booking",
        label: b.user?.name || b.purpose || "Booking",
        sub: `${format(parseISO(b.startAt), "HH:mm")}–${format(parseISO(b.endAt), "HH:mm")} · ${b.status}`,
        start: parseISO(b.startAt), end: parseISO(b.endAt),
      });
    }
    for (const r of reservations) {
      if (r.status !== "HELD") continue;
      if (r.bookingId) continue; // shown via its booking
      const label = r.serviceOrder?.service?.name || r.serviceOrder?.code || "Reserved";
      if (r.startAt) {
        out.push({
          id: `r-${r.id}`, kind: "reservation", label,
          sub: `${format(parseISO(r.startAt), "HH:mm")}${r.endAt ? "–" + format(parseISO(r.endAt), "HH:mm") : ""}`,
          start: parseISO(r.startAt), end: r.endAt ? parseISO(r.endAt) : undefined,
        });
      } else if (r.date) {
        out.push({
          id: `r-${r.id}`, kind: "reservation", label,
          sub: `${r.units} unit${r.units === 1 ? "" : "s"}`,
          start: parseISO(r.date), allDay: true,
        });
      }
    }
    for (const m of maintenanceWindows) {
      out.push({
        id: `m-${m.id}`, kind: "maintenance",
        label: m.reason || "Maintenance",
        sub: `${format(parseISO(m.startAt), "dd MMM HH:mm")} → ${format(parseISO(m.endAt), "dd MMM HH:mm")}`,
        start: parseISO(m.startAt), end: parseISO(m.endAt),
      });
    }
    return out;
  }, [bookings, reservations, maintenanceWindows]);

  function entriesForDay(day: Date): CalEntry[] {
    return entries
      .filter((e) => {
        if (e.end) {
          // Spanning entry (e.g. multi-day maintenance): show on any covered day.
          return day >= startOfDayLocal(e.start) && day <= e.end;
        }
        return isSameDay(e.start, day);
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-brand-600" />
          <span className="text-sm font-medium text-ink">
            {format(weekStart, "dd MMM")} – {format(addDays(weekStart, 6), "dd MMM yyyy")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" className="btn-sm" onClick={() => setAnchor(addDays(weekStart, -7))} aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="secondary" className="btn-sm" onClick={() => setAnchor(new Date())}>Today</Button>
          <Button variant="ghost" className="btn-sm" onClick={() => setAnchor(addDays(weekStart, 7))} aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dayEntries = entriesForDay(day);
          const today = isSameDay(day, new Date());
          return (
            <div key={day.toISOString()} className="min-h-[7rem] rounded-lg border border-surface-border p-1.5">
              <div className={`mb-1 text-center text-[11px] font-semibold ${today ? "text-brand-700" : "text-ink-muted"}`}>
                {format(day, "EEE")}
                <span className={`ml-1 ${today ? "text-brand-700" : "text-ink-faint"}`}>{format(day, "dd")}</span>
              </div>
              <div className="space-y-1">
                {dayEntries.length === 0 ? (
                  <p className="text-center text-[10px] text-ink-faint">-</p>
                ) : (
                  dayEntries.map((e) => (
                    <div key={e.id + day.toISOString()} className={`rounded border px-1.5 py-1 text-[10px] leading-tight ${KIND_STYLE[e.kind]}`}>
                      <p className="truncate font-medium">{e.label}</p>
                      {e.sub && <p className="truncate opacity-90">{e.sub}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-ink-muted">
        {(["reservation", "booking", "maintenance"] as Kind[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded border ${KIND_STYLE[k]}`} /> {KIND_LABEL[k]}
          </span>
        ))}
      </div>
    </div>
  );
}

function startOfDayLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
