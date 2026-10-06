import { roundToQuarterHour } from "@/lib/calculations";

// Lunch (30 min) is only taken after 5 worked hours, so it is added to the clock
// span only when the worked time is more than 5 hours.
export function workedToSpan(worked: number): number {
  return worked > 5 ? worked + 0.5 : worked;
}

export function spanToWorked(span: number): number {
  return span > 5 ? span - 0.5 : span;
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

export function hoursFromClock(clockIn: string, clockOut: string): number | null {
  const start = timeToMinutes(clockIn ?? "");
  const end = timeToMinutes(clockOut ?? "");
  if (start === null || end === null || end <= start) return null;
  return roundToQuarterHour(spanToWorked((end - start) / 60));
}

export function clockOutFromHours(clockIn: string, hours: number): string | null {
  const start = timeToMinutes(clockIn ?? "");
  if (start === null || !(hours > 0)) return null;
  return minutesToTime(start + Math.round(workedToSpan(hours) * 60));
}

export function combineDateAndTime(date: Date, time: string): Date | null {
  const minutes = timeToMinutes(time ?? "");
  if (minutes === null) return null;
  const result = new Date(date);
  result.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return result;
}

type TimedEntry = { clockIn?: string; clockOut?: string; hours?: string };

// Keeps clock-in, clock-out and worked hours consistent after one of them changes.
export function recalcEntry<T extends TimedEntry>(
  entry: T,
  changed: "clockIn" | "clockOut" | "hours",
): T {
  if (changed === "clockOut" || (changed === "clockIn" && entry.clockOut)) {
    const worked = hoursFromClock(entry.clockIn ?? "", entry.clockOut ?? "");
    return worked === null ? entry : { ...entry, hours: String(worked) };
  }
  if (changed === "hours" || (changed === "clockIn" && entry.hours)) {
    const out = clockOutFromHours(entry.clockIn ?? "", Number(entry.hours));
    return out === null ? entry : { ...entry, clockOut: out };
  }
  return entry;
}

export function hoursOrTimesValid(clockIn?: string, clockOut?: string): boolean {
  return hoursFromClock(clockIn ?? "", clockOut ?? "") !== null;
}
