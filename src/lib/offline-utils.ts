/**
 * Utility functions for offline functionality
 */

/**
 * Adds an offline indicator message to a toast description
 * @param baseMessage - The base message to display
 * @param isOnline - Whether the user is currently online
 * @returns The message with offline indicator appended if offline
 */
export const addOfflineIndicator = (baseMessage: string, isOnline: boolean): string => {
  return isOnline ? baseMessage : `${baseMessage} (Saved locally - will sync when online)`;
};
