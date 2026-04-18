/**
 * Client-side password hashing utilities for non-auth (User role) accounts.
 * Uses SHA-256 with a per-user salt via the Web Crypto API (no external dependencies).
 */

/** Generate a random hex salt string */
export function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Hash a password with the given salt using SHA-256 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const saltedPassword = `${salt}:${password}`;
  const msgBuffer = new TextEncoder().encode(saltedPassword);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Verify a password against a stored hash and salt */
export async function verifyPassword(
  password: string,
  salt: string,
  storedHash: string,
): Promise<boolean> {
  const inputHash = await hashPassword(password, salt);
  return inputHash === storedHash;
}
