/**
 * Utility functions for handling Firestore Timestamp objects
 * that may come from cache as Date objects or ISO strings
 */

/**
 * Helper function to convert Firestore Timestamp, Date, or ISO string to Date object
 * This is needed because cached data converts Timestamps to Date objects or ISO strings
 */
export function toDate(value: any): Date {
  if (!value) return new Date();
  
  // If it's already a Date object, return it
  if (value instanceof Date) return value;
  
  // If it's a Firestore Timestamp with toDate method, call it
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  
  // If it's a string (ISO date from cache), parse it
  if (typeof value === 'string') {
    return new Date(value);
  }
  
  // If it's an object with seconds/nanoseconds (Firestore Timestamp format)
  if (value && typeof value === 'object' && 'seconds' in value) {
    return new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1000000);
  }
  
  // Fallback - try to create a Date from whatever we have
  return new Date(value);
}
