"use client";

/**
 * Clears every browser cache (PWA / Workbox caches), unregisters all service
 * workers, and reloads the page from the network so the latest build is loaded.
 *
 * Shared by the automatic "update available" prompt and the manual button in
 * Settings, so both behave exactly the same.
 */
export async function forceAppUpdate(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    // 1. Delete all Cache Storage entries (Workbox/next-pwa caches)
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    // 2. Unregister every service worker so a fresh one registers on reload
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
  } catch (err) {
    // Even if cleanup fails, still reload — a normal reload is better than nothing
    console.warn("forceAppUpdate cleanup failed, reloading anyway:", err);
  } finally {
    // 3. Hard reload from the network
    window.location.reload();
  }
}
