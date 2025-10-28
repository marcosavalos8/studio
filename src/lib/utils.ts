import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { startOfWeek, endOfWeek, subWeeks } from "date-fns"
import type { DateRange } from "react-day-picker"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts a Date object that may be in UTC to local timezone at midnight.
 * This is useful for date pickers that return UTC dates but we want to work with local dates.
 * @param date - The date to convert (may be undefined)
 * @returns A new Date object in local timezone, or undefined if input was undefined
 */
export function toLocalMidnight(date: Date | undefined): Date | undefined {
  if (!date) return undefined;
  
  // Extract the year, month, and day from the date object
  // These methods return values in UTC when the date is created with UTC methods
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  
  // Create a new date in local timezone at midnight
  return new Date(year, month, day, 0, 0, 0, 0);
}

/**
 * Parses a date string (YYYY-MM-DD) as a local date, not UTC.
 * This prevents timezone offset issues where dates can appear as one day earlier.
 * @param dateString - Date string in format YYYY-MM-DD
 * @returns A Date object in local timezone at midnight
 */
export function parseLocalDate(dateString: string): Date {
  // Split the date string to avoid UTC interpretation
  const [year, month, day] = dateString.split('-').map(Number);
  // Create date in local timezone (month is 0-indexed)
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Parses a date string that may be in YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss format as local time.
 * This ensures consistent date parsing across the application.
 * @param dateString - Date string in YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss format
 * @returns A Date object in local timezone
 */
export function parseLocalDateOrDateTime(dateString: string): Date {
  if (dateString.includes('T')) {
    // DateTime format: YYYY-MM-DDTHH:mm:ss
    // Parse as local time by splitting and constructing Date
    const [datePart, timePart] = dateString.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes, seconds] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes, seconds || 0, 0);
  } else {
    // Date only format: YYYY-MM-DD
    return parseLocalDate(dateString);
  }
}

/**
 * Generates a week date range (Monday to Sunday) for a given number of weeks ago.
 * Used for quick week selection in payroll and invoicing.
 * @param weeksAgo - Number of weeks in the past (0 = current week, 1 = last week, etc.)
 * @returns A DateRange object with from/to dates in local timezone
 */
export function getWeekRange(weeksAgo: number = 0): DateRange {
  const today = new Date();
  const targetDate = subWeeks(today, weeksAgo);
  const weekStart = startOfWeek(targetDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(targetDate, { weekStartsOn: 1 }); // Sunday
  return {
    from: toLocalMidnight(weekStart),
    to: toLocalMidnight(weekEnd),
  };
}

