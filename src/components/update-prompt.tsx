"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { forceAppUpdate } from "@/lib/force-update";

// Version baked into this bundle at build time (see next.config.ts -> env).
const CURRENT_VERSION = process.env.NEXT_PUBLIC_BUILD_VERSION ?? "dev";
// How often to check the server for a newer build.
const CHECK_INTERVAL_MS = 60 * 1000;

/**
 * Polls /api/version and, when the live build differs from the one running in
 * the browser, shows a dialog inviting the user to update. Accepting clears the
 * cache, unregisters the service worker and reloads (see forceAppUpdate).
 */
export default function UpdatePrompt() {
  const [open, setOpen] = useState(false);

  const checkVersion = useCallback(async () => {
    // Skip locally / when no version was baked in (dev builds).
    if (CURRENT_VERSION === "dev") return;
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { version?: string };
      if (data.version && data.version !== CURRENT_VERSION) {
        setOpen(true);
      }
    } catch {
      // Offline or transient network error — ignore and retry on next tick.
    }
  }, []);

  useEffect(() => {
    // Strip the cache-busting param left by forceAppUpdate so the URL stays clean.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("_u")) {
        url.searchParams.delete("_u");
        window.history.replaceState(null, "", url.toString());
      }
    }
    checkVersion(); // check immediately on mount
    const intervalId = setInterval(checkVersion, CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") checkVersion();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", checkVersion);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", checkVersion);
    };
  }, [checkVersion]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Update available</AlertDialogTitle>
          <AlertDialogDescription>
            The app was just updated. Click “Update now” to load the latest
            version. Your work is saved — this only refreshes the app.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Later</AlertDialogCancel>
          <AlertDialogAction onClick={() => forceAppUpdate()}>
            Update now
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
