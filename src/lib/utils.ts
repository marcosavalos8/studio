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
