"use client";

import { useEffect } from "react";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useToast } from "@/hooks/use-toast";
import { Wifi, WifiOff } from "lucide-react";

export function NetworkStatusIndicator() {
  const { isOnline } = useNetworkStatus();
  const { toast } = useToast();

  useEffect(() => {
    if (!isOnline) {
      toast({
        title: "Offline Mode",
        description:
          "You are currently offline. All changes will be saved locally and synced when connection returns.",
        variant: "default",
        duration: 5000,
      });
    } else {
      // Only show "back online" toast if we were previously offline
      // Check if this is not the initial load
      const wasOffline = sessionStorage.getItem("wasOffline");
      if (wasOffline === "true") {
        toast({
          title: "Back Online",
          description: "Connection restored. Syncing your changes...",
          duration: 3000,
        });
      }
      sessionStorage.removeItem("wasOffline");
    }

    // Store offline status for next online event
    if (!isOnline) {
      sessionStorage.setItem("wasOffline", "true");
    }
  }, [isOnline, toast]);

  return (
    <div className="fixed top-4 right-4 z-50">
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg ${
          isOnline
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-orange-50 text-orange-700 border border-orange-200 animate-pulse"
        }`}
      >
        {isOnline ? (
          <>
            <Wifi className="h-4 w-4" />
            <span className="text-sm font-medium">Online</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            <span className="text-sm font-medium">Offline</span>
          </>
        )}
      </div>
    </div>
  );
}
