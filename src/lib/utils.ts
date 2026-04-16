import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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
 * Returns a human-readable relative time string in Spanish.
 * e.g. "hace 2 días", "hace 1 hora", "hace 3 semanas"
 */
export function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSecs < 60) return "hace un momento";
  if (diffMins < 60) return diffMins === 1 ? "hace 1 minuto" : `hace ${diffMins} minutos`;
  if (diffHours < 24) return diffHours === 1 ? "hace 1 hora" : `hace ${diffHours} horas`;
  if (diffDays < 7) return diffDays === 1 ? "hace 1 día" : `hace ${diffDays} días`;
  if (diffWeeks < 5) return diffWeeks === 1 ? "hace 1 semana" : `hace ${diffWeeks} semanas`;
  return diffMonths === 1 ? "hace 1 mes" : `hace ${diffMonths} meses`;
}
