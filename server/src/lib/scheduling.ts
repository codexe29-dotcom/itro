// Capacity & scheduling engine — pure, unit-testable functions.
//
// Everything works in a facility-local "wall clock" using the server's local
// timezone as a stand-in (the seeded facilities are Asia/Kolkata and the dev DB
// runs in the same zone). Times in openingHours are "HH:mm" wall-clock strings.
//
// Two capacity models per instrument:
//   TIME_SLOT  — discrete slots of `slotMinutes`, each with `concurrency` capacity.
//   THROUGHPUT — a daily bucket of `throughputPerDay` units.

import { prisma } from "../db";

const MS_DAY = 24 * 60 * 60 * 1000;
const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export interface OpeningHoursDay {
  open: string; // "09:00"
  close: string; // "18:00"
}
export type OpeningHours = Partial<Record<(typeof WEEKDAY_KEYS)[number], OpeningHoursDay | null>>;

export interface Interval {
  start: Date;
  end: Date;
}

// ------------------------------------------------------------------
// Small date helpers (local wall clock).
// ------------------------------------------------------------------
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function atTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map((x) => Number.parseInt(x, 10));
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h || 0, m || 0, 0, 0);
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && a.end > b.start;
}

// Default opening hours when a facility has none configured: Mon–Fri 09:00–17:00.
const DEFAULT_HOURS: OpeningHours = {
  mon: { open: "09:00", close: "17:00" },
  tue: { open: "09:00", close: "17:00" },
  wed: { open: "09:00", close: "17:00" },
  thu: { open: "09:00", close: "17:00" },
  fri: { open: "09:00", close: "17:00" },
  sat: null,
  sun: null,
};

export interface FacilityLike {
  openingHours?: unknown;
  holidays?: { date: Date | string }[];
}

export interface MaintenanceLike {
  startAt: Date | string;
  endAt: Date | string;
}

function asHours(raw: unknown): OpeningHours {
  if (!raw || typeof raw !== "object") return DEFAULT_HOURS;
  return raw as OpeningHours;
}

/** True when `date` is a facility holiday (matched by calendar day). */
function isHoliday(facility: FacilityLike, date: Date): boolean {
  const key = dateKey(date);
  return (facility.holidays ?? []).some((h) => dateKey(new Date(h.date)) === key);
}

/**
 * The open time interval(s) for a facility on `date`:
 *   openingHours for that weekday, MINUS holidays (closed all day)
 *   MINUS overlapping maintenance windows.
 * Returns [] when the day is closed / fully blocked.
 */
export function workingIntervals(
  facility: FacilityLike,
  date: Date,
  maintenance: MaintenanceLike[] = []
): Interval[] {
  const day = startOfDay(date);
  if (isHoliday(facility, day)) return [];

  const hours = asHours(facility.openingHours);
  const spec = hours[WEEKDAY_KEYS[day.getDay()]];
  if (!spec || !spec.open || !spec.close) return [];

  const open = atTime(day, spec.open);
  const close = atTime(day, spec.close);
  if (close <= open) return [];

  // Subtract maintenance windows overlapping this day.
  let intervals: Interval[] = [{ start: open, end: close }];
  for (const mw of maintenance) {
    const mStart = new Date(mw.startAt);
    const mEnd = new Date(mw.endAt);
    const next: Interval[] = [];
    for (const iv of intervals) {
      if (!overlaps(iv, { start: mStart, end: mEnd })) {
        next.push(iv);
        continue;
      }
      // Left remainder
      if (mStart > iv.start) next.push({ start: iv.start, end: mStart < iv.end ? mStart : iv.end });
      // Right remainder
      if (mEnd < iv.end) next.push({ start: mEnd > iv.start ? mEnd : iv.start, end: iv.end });
    }
    intervals = next.filter((iv) => iv.end > iv.start);
  }
  return intervals;
}

// ------------------------------------------------------------------
// Instrument + busy inputs
// ------------------------------------------------------------------
export interface InstrumentLike {
  id: string;
  capacityType: string; // TIME_SLOT | THROUGHPUT
  concurrency: number;
  throughputPerDay: number | null;
  slotMinutes: number;
  setupMinutes: number;
  leadTimeDays: number;
  status: string;
}

export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface DayUnits {
  // dateKey -> units already consumed that day (THROUGHPUT reservations + throughput bookings)
  [key: string]: number;
}

export interface Slot {
  start: string; // "HH:mm"
  end: string; // "HH:mm"
  startAt: string; // ISO
  endAt: string; // ISO
  capacity: number;
  remaining: number;
  available: boolean;
}

export interface DaySlots {
  date: string;
  weekday: string;
  closed: boolean;
  slots: Slot[];
}

export interface ThroughputDay {
  date: string;
  weekday: string;
  closed: boolean;
  capacity: number;
  used: number;
  remaining: number;
}

const WEEKDAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function leadTimeFloor(now: Date, leadTimeDays: number): Date {
  if (leadTimeDays <= 0) return now;
  return startOfDay(new Date(now.getTime() + leadTimeDays * MS_DAY));
}

/**
 * TIME_SLOT availability grid for an instrument across `days` calendar days.
 * Each slot's capacity = concurrency; overlapping busy intervals subtract from it.
 * A `setupMinutes` buffer is applied around each busy interval.
 */
export function timeSlotGrid(params: {
  instrument: InstrumentLike;
  facility: FacilityLike;
  maintenance: MaintenanceLike[];
  busy: BusyInterval[]; // bookings (APPROVED/PENDING) + HELD time-slot reservations
  from: Date;
  days: number;
  now?: Date;
}): { days: DaySlots[]; nextAvailable: string | null } {
  const { instrument, facility, maintenance, busy } = params;
  const now = params.now ?? new Date();
  const offline = instrument.status === "MAINTENANCE" || instrument.status === "OFFLINE";
  const earliest = leadTimeFloor(now, instrument.leadTimeDays);
  const setupMs = instrument.setupMinutes * 60 * 1000;
  const slotMs = Math.max(15, instrument.slotMinutes) * 60 * 1000;

  // Pre-expand busy intervals by the setup buffer on both sides.
  const buffered = busy.map((b) => ({
    start: new Date(b.start.getTime() - setupMs),
    end: new Date(b.end.getTime() + setupMs),
  }));

  const out: DaySlots[] = [];
  let nextAvailable: string | null = null;
  const cursor = startOfDay(params.from);

  for (let i = 0; i < params.days; i++) {
    const intervals = offline ? [] : workingIntervals(facility, cursor, maintenance);
    const slots: Slot[] = [];
    for (const iv of intervals) {
      for (let s = iv.start.getTime(); s + slotMs <= iv.end.getTime() + 1; s += slotMs) {
        const slotStart = new Date(s);
        const slotEnd = new Date(s + slotMs);
        let used = 0;
        for (const b of buffered) {
          if (slotStart < b.end && slotEnd > b.start) used += 1;
        }
        const remaining = Math.max(0, instrument.concurrency - used);
        const inFuture = slotEnd > now && slotStart >= earliest;
        const available = remaining > 0 && inFuture;
        if (available && nextAvailable === null) nextAvailable = slotStart.toISOString();
        slots.push({
          start: fmtTime(slotStart),
          end: fmtTime(slotEnd),
          startAt: slotStart.toISOString(),
          endAt: slotEnd.toISOString(),
          capacity: instrument.concurrency,
          remaining,
          available,
        });
      }
    }
    out.push({
      date: dateKey(cursor),
      weekday: WEEKDAY_LABEL[cursor.getDay()],
      closed: intervals.length === 0,
      slots,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return { days: out, nextAvailable };
}

/**
 * THROUGHPUT availability across `days` days: per open day, capacity =
 * throughputPerDay; HELD units (reservations + throughput bookings) subtract.
 */
export function throughputGrid(params: {
  instrument: InstrumentLike;
  facility: FacilityLike;
  maintenance: MaintenanceLike[];
  usedByDay: DayUnits;
  from: Date;
  days: number;
  now?: Date;
}): { days: ThroughputDay[]; nextAvailable: string | null } {
  const { instrument, facility, maintenance, usedByDay } = params;
  const now = params.now ?? new Date();
  const offline = instrument.status === "MAINTENANCE" || instrument.status === "OFFLINE";
  const earliest = leadTimeFloor(now, instrument.leadTimeDays);
  const capacity = instrument.throughputPerDay ?? 0;

  const out: ThroughputDay[] = [];
  let nextAvailable: string | null = null;
  const cursor = startOfDay(params.from);

  for (let i = 0; i < params.days; i++) {
    const intervals = offline ? [] : workingIntervals(facility, cursor, maintenance);
    const closed = intervals.length === 0;
    const key = dateKey(cursor);
    const used = usedByDay[key] ?? 0;
    const remaining = closed ? 0 : Math.max(0, capacity - used);
    const bookable = !closed && cursor >= startOfDay(earliest) && cursor >= startOfDay(now);
    if (remaining > 0 && bookable && nextAvailable === null) {
      nextAvailable = intervals[0]?.start.toISOString() ?? cursor.toISOString();
    }
    out.push({
      date: key,
      weekday: WEEKDAY_LABEL[cursor.getDay()],
      closed,
      capacity,
      used,
      remaining,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return { days: out, nextAvailable };
}

function fmtTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Add N working days (skips closed days & holidays) to a start date. */
export function addWorkingDays(
  facility: FacilityLike,
  maintenance: MaintenanceLike[],
  start: Date,
  workingDays: number
): Date {
  if (workingDays <= 0) return start;
  const cursor = startOfDay(start);
  let counted = 0;
  // Cap iterations to avoid runaway loops on fully-closed facilities.
  for (let guard = 0; guard < 366 && counted < workingDays; guard++) {
    cursor.setDate(cursor.getDate() + 1);
    if (workingIntervals(facility, cursor, maintenance).length > 0) counted += 1;
  }
  return cursor;
}

// ------------------------------------------------------------------
// DB-backed helpers: load busy inputs & run the engine for a service.
// ------------------------------------------------------------------

const HORIZON_DAYS = 90;

export interface FullInstrument extends InstrumentLike {
  facilityId: string;
}

/** Load facility (+holidays) and maintenance windows relevant to a horizon. */
async function loadContext(instrument: { id: string; facilityId: string }, from: Date, to: Date) {
  const [facility, maintenance] = await Promise.all([
    prisma.facility.findUnique({
      where: { id: instrument.facilityId },
      include: { holidays: true },
    }),
    prisma.maintenanceWindow.findMany({
      where: { instrumentId: instrument.id, endAt: { gt: from }, startAt: { lt: to } },
    }),
  ]);
  return { facility, maintenance };
}

/** Busy TIME_SLOT intervals: APPROVED/PENDING bookings + HELD time-slot reservations. */
async function loadBusyIntervals(instrumentId: string, from: Date, to: Date): Promise<BusyInterval[]> {
  const [bookings, reservations] = await Promise.all([
    prisma.booking.findMany({
      where: {
        instrumentId,
        status: { in: ["APPROVED", "PENDING"] },
        endAt: { gt: from },
        startAt: { lt: to },
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.capacityReservation.findMany({
      where: {
        instrumentId,
        status: "HELD",
        startAt: { not: null },
        endAt: { gt: from },
        // Booking-linked reservations are already counted via the booking query.
        bookingId: null,
      },
      select: { startAt: true, endAt: true },
    }),
  ]);
  const out: BusyInterval[] = [];
  for (const b of bookings) out.push({ start: b.startAt, end: b.endAt });
  for (const r of reservations) {
    if (r.startAt && r.endAt) out.push({ start: r.startAt, end: r.endAt });
  }
  return out;
}

/** Units consumed per day: HELD throughput reservations + APPROVED/PENDING bookings (1 unit/day touched). */
async function loadUsedByDay(instrumentId: string, from: Date, to: Date): Promise<DayUnits> {
  const [reservations, bookings] = await Promise.all([
    prisma.capacityReservation.findMany({
      where: { instrumentId, status: "HELD", date: { not: null, gte: startOfDay(from), lt: to } },
      select: { date: true, units: true },
    }),
    prisma.booking.findMany({
      where: {
        instrumentId,
        status: { in: ["APPROVED", "PENDING"] },
        endAt: { gt: from },
        startAt: { lt: to },
      },
      select: { startAt: true },
    }),
  ]);
  const map: DayUnits = {};
  for (const r of reservations) {
    if (!r.date) continue;
    const k = dateKey(new Date(r.date));
    map[k] = (map[k] ?? 0) + r.units;
  }
  for (const b of bookings) {
    const k = dateKey(new Date(b.startAt));
    map[k] = (map[k] ?? 0) + 1;
  }
  return map;
}

export interface AvailabilityResult {
  instrumentId: string | null;
  capacityType: string | null;
  nextAvailable: string | null;
  slotMinutes?: number;
  concurrency?: number;
  throughputPerDay?: number | null;
  inMaintenanceNow?: boolean;
  days: DaySlots[] | ThroughputDay[];
}

/** Full availability for an instrument over `days` days, engine-driven. */
export async function instrumentAvailability(
  instrument: FullInstrument,
  days = 10,
  now = new Date()
): Promise<AvailabilityResult> {
  const from = startOfDay(now);
  const to = new Date(from.getTime() + (days + 2) * MS_DAY);
  const { facility, maintenance } = await loadContext(instrument, from, to);
  const facilityLike: FacilityLike = facility
    ? { openingHours: facility.openingHours, holidays: facility.holidays }
    : {};

  const inMaintenanceNow =
    instrument.status === "MAINTENANCE" ||
    instrument.status === "OFFLINE" ||
    maintenance.some((m) => new Date(m.startAt) <= now && new Date(m.endAt) > now);

  if (instrument.capacityType === "THROUGHPUT") {
    const usedByDay = await loadUsedByDay(instrument.id, from, to);
    const grid = throughputGrid({ instrument, facility: facilityLike, maintenance, usedByDay, from, days, now });
    return {
      instrumentId: instrument.id,
      capacityType: "THROUGHPUT",
      nextAvailable: grid.nextAvailable,
      throughputPerDay: instrument.throughputPerDay,
      inMaintenanceNow,
      days: grid.days,
    };
  }

  const busy = await loadBusyIntervals(instrument.id, from, to);
  const grid = timeSlotGrid({ instrument, facility: facilityLike, maintenance, busy, from, days, now });
  return {
    instrumentId: instrument.id,
    capacityType: "TIME_SLOT",
    nextAvailable: grid.nextAvailable,
    slotMinutes: instrument.slotMinutes,
    concurrency: instrument.concurrency,
    inMaintenanceNow,
    days: grid.days,
  };
}

export interface ScheduleEstimate {
  nextAvailableStart: string | null;
  estimatedCompletion: string | null;
  queueDepth: number;
}

/**
 * Estimate the schedule a buyer would actually get for a service:
 *   nextAvailableStart — earliest bookable moment from the engine (accounts for
 *                        current backlog / holds / maintenance / lead time).
 *   estimatedCompletion — nextAvailableStart + `turnaroundDays` processing days
 *                        counted as WORKING days (queue wait + processing).
 *   queueDepth — count of active (HELD) reservations ahead in the queue.
 */
export async function estimateSchedule(
  service: { instrumentId: string | null; turnaroundDays: number },
  now = new Date()
): Promise<ScheduleEstimate> {
  if (!service.instrumentId) {
    // No linked instrument: fall back to a simple now + turnaround estimate.
    const completion = new Date(now.getTime() + service.turnaroundDays * MS_DAY);
    return { nextAvailableStart: null, estimatedCompletion: completion.toISOString(), queueDepth: 0 };
  }

  const instrument = await prisma.instrument.findUnique({
    where: { id: service.instrumentId },
    select: {
      id: true,
      facilityId: true,
      capacityType: true,
      concurrency: true,
      throughputPerDay: true,
      slotMinutes: true,
      setupMinutes: true,
      leadTimeDays: true,
      status: true,
    },
  });
  if (!instrument) {
    const completion = new Date(now.getTime() + service.turnaroundDays * MS_DAY);
    return { nextAvailableStart: null, estimatedCompletion: completion.toISOString(), queueDepth: 0 };
  }

  const from = startOfDay(now);
  const to = new Date(from.getTime() + HORIZON_DAYS * MS_DAY);
  const { facility, maintenance } = await loadContext(instrument, from, to);
  const facilityLike: FacilityLike = facility
    ? { openingHours: facility.openingHours, holidays: facility.holidays }
    : {};

  const avail = await instrumentAvailability(instrument, HORIZON_DAYS, now);
  const nextStart = avail.nextAvailable ? new Date(avail.nextAvailable) : null;

  const queueDepth = await prisma.capacityReservation.count({
    where: { instrumentId: instrument.id, status: "HELD" },
  });

  let estimatedCompletion: string | null = null;
  if (nextStart) {
    const done = addWorkingDays(facilityLike, maintenance, nextStart, service.turnaroundDays);
    estimatedCompletion = done.toISOString();
  }

  return {
    nextAvailableStart: nextStart ? nextStart.toISOString() : null,
    estimatedCompletion,
    queueDepth,
  };
}

// ------------------------------------------------------------------
// Reservation placement (capacity consumption for orders/bookings).
// ------------------------------------------------------------------

export interface ReservationPlacement {
  startAt: Date | null;
  endAt: Date | null;
  date: Date | null;
  units: number;
}

/**
 * Find where a new job should be reserved on an instrument.
 * TIME_SLOT → the next available slot (start/end).
 * THROUGHPUT → the earliest day with remaining units (date, 1 unit).
 * If nothing is free in the horizon, returns the earliest open day/slot anyway
 * (never hard-fails — overbooking is reflected as a later nextAvailableStart).
 */
export async function findReservationPlacement(
  instrument: FullInstrument,
  now = new Date()
): Promise<ReservationPlacement> {
  const avail = await instrumentAvailability(instrument, HORIZON_DAYS, now);

  if (instrument.capacityType === "THROUGHPUT") {
    const days = avail.days as ThroughputDay[];
    const open = days.find((d) => !d.closed && d.remaining > 0) ?? days.find((d) => !d.closed);
    const date = open ? startOfDay(new Date(open.date + "T00:00:00")) : startOfDay(now);
    return { startAt: null, endAt: null, date, units: 1 };
  }

  const days = avail.days as DaySlots[];
  for (const d of days) {
    const slot = d.slots.find((s) => s.available);
    if (slot) {
      return { startAt: new Date(slot.startAt), endAt: new Date(slot.endAt), date: null, units: 1 };
    }
  }
  // Fallback: first slot of the first open day, or now.
  for (const d of days) {
    if (d.slots.length > 0) {
      const s = d.slots[0];
      return { startAt: new Date(s.startAt), endAt: new Date(s.endAt), date: null, units: 1 };
    }
  }
  return { startAt: now, endAt: new Date(now.getTime() + instrument.slotMinutes * 60 * 1000), date: null, units: 1 };
}

/**
 * Create a HELD reservation for a service order line, consuming capacity.
 * Idempotent-ish: if an active reservation already exists for this order+instrument, reuse it.
 */
export async function reserveForOrder(serviceOrderId: string, now = new Date()) {
  const order = await prisma.serviceOrder.findUnique({
    where: { id: serviceOrderId },
    include: { service: { select: { instrumentId: true } } },
  });
  if (!order || !order.service.instrumentId) return null;

  const existing = await prisma.capacityReservation.findFirst({
    where: { serviceOrderId, status: "HELD" },
  });
  if (existing) return existing;

  const instrument = await prisma.instrument.findUnique({
    where: { id: order.service.instrumentId },
    select: {
      id: true, facilityId: true, capacityType: true, concurrency: true,
      throughputPerDay: true, slotMinutes: true, setupMinutes: true,
      leadTimeDays: true, status: true,
    },
  });
  if (!instrument) return null;

  const placement = await findReservationPlacement(instrument, now);
  return prisma.capacityReservation.create({
    data: {
      instrumentId: instrument.id,
      serviceOrderId,
      startAt: placement.startAt,
      endAt: placement.endAt,
      date: placement.date,
      units: placement.units,
      status: "HELD",
    },
  });
}

/** Release all HELD reservations for an order (completion / cancellation / dispute). */
export async function releaseForOrder(serviceOrderId: string) {
  await prisma.capacityReservation.updateMany({
    where: { serviceOrderId, status: "HELD" },
    data: { status: "RELEASED" },
  });
}
