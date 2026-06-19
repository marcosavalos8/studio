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
    // 1. Unregister every service worker FIRST so it stops intercepting the
    //    upcoming navigation (an unregistered SW still controls the current
    //    page until it unloads, which is why a plain reload served stale assets).
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    // 2. Delete all Cache Storage entries (Workbox/next-pwa caches)
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (err) {
    // Even if cleanup fails, still reload — a normal reload is better than nothing
    console.warn("forceAppUpdate cleanup failed, reloading anyway:", err);
  } finally {
    // 3. Navigate to a cache-busted URL so the document (and therefore the new
    //    hashed JS/CSS it references) is fetched fresh from the network,
    //    bypassing the HTTP cache, the back-forward cache and any lingering SW.
    const url = new URL(window.location.href);
    url.searchParams.set("_u", Date.now().toString());
    window.location.replace(url.toString());
  }
}
