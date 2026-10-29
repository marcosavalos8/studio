import { roundToQuarterHour } from "@/lib/calculations";

// Whether a 30 min unpaid lunch is added to/removed from the clock span.
// When hasLunch is explicitly known (the row's "Lunch Break" checkbox was
// set because the Past Records form's Lunch In field is in use), that
// always wins, regardless of how many hours were worked. Otherwise this
// falls back to the old assumption — a break only after 5 worked hours —
// so existing behavior is unchanged when the Lunch feature isn't in play.
export function workedToSpan(worked: number, hasLunch?: boolean): number {
  const takesBreak = hasLunch ?? worked > 5;
  return takesBreak ? worked + 0.5 : worked;
}

export function spanToWorked(span: number, hasLunch?: boolean): number {
  const takesBreak = hasLunch ?? span > 5;
  return takesBreak ? span - 0.5 : span;
}

function timeToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesToTime(totalMinutes: number): string {
  const minutes = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function hoursFromClock(
  clockIn: string,
  clockOut: string,
  hasLunch?: boolean,
): number | null {
  const start = timeToMinutes(clockIn ?? "");
  const end = timeToMinutes(clockOut ?? "");
  if (start === null || end === null || end <= start) return null;
  return roundToQuarterHour(spanToWorked((end - start) / 60, hasLunch));
}

export function clockOutFromHours(
  clockIn: string,
  hours: number,
  hasLunch?: boolean,
): string | null {
  const start = timeToMinutes(clockIn ?? "");
  if (start === null || !(hours > 0)) return null;
  return minutesToTime(start + Math.round(workedToSpan(hours, hasLunch) * 60));
}

export function combineDateAndTime(date: Date, time: string): Date | null {
  const minutes = timeToMinutes(time ?? "");
  if (minutes === null) return null;
  const result = new Date(date);
  result.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return result;
}

type TimedEntry = {
  clockIn?: string;
  clockOut?: string;
  hours?: string;
  lunchBreak?: boolean;
};

// Keeps clock-in, clock-out and worked hours consistent after one of them changes.
export function recalcEntry<T extends TimedEntry>(
  entry: T,
  changed: "clockIn" | "clockOut" | "hours",
): T {
  if (changed === "clockOut" || (changed === "clockIn" && entry.clockOut)) {
    const worked = hoursFromClock(
      entry.clockIn ?? "",
      entry.clockOut ?? "",
      entry.lunchBreak,
    );
    return worked === null ? entry : { ...entry, hours: String(worked) };
  }
  if (changed === "hours" || (changed === "clockIn" && entry.hours)) {
    const out = clockOutFromHours(
      entry.clockIn ?? "",
      Number(entry.hours),
      entry.lunchBreak,
    );
    return out === null ? entry : { ...entry, clockOut: out };
  }
  return entry;
}

export function hoursOrTimesValid(clockIn?: string, clockOut?: string): boolean {
  return hoursFromClock(clockIn ?? "", clockOut ?? "") !== null;
}
