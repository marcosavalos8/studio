"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function ServiceWorkerRegister() {
  const [isReady, setIsReady] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register(
            "/service-worker.js",
            {
              scope: "/",
              updateViaCache: "none", // Evitar cache del SW mismo
            }
          );

          console.log("✅ SW registered successfully");

          // Verificar si está controlando la página
          if (navigator.serviceWorker.controller) {
            console.log("🎛️ SW is controlling the page");
            setIsReady(true);
          }

          // Escuchar cuando tome control
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            console.log("🎛️ SW took control");
            setIsReady(true);
          });

          // Manejar actualizaciones
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed") {
                  if (navigator.serviceWorker.controller) {
                    // Nueva versión disponible
                    toast({
                      title: "App Update Available",
                      description: "A new version is ready. Restart to update.",
                      action: (
                        <button
                          onClick={() => window.location.reload()}
                          className="text-sm bg-primary text-primary-foreground px-3 py-1 rounded"
                        >
                          Update
                        </button>
                      ),
                    });
                  } else {
                    // Primera instalación
                    console.log("🎉 App is ready for offline use");
                    setIsReady(true);
                  }
                }
              });
            }
          });

          // Verificar actualizaciones cada 5 minutos
          setInterval(() => {
            registration.update();
          }, 5 * 60 * 1000);

        } catch (error) {
          console.error("❌ SW registration failed:", error);
        }
      };

      // Registrar cuando todo esté listo
      if (document.readyState === "complete") {
        registerSW();
      } else {
        window.addEventListener("load", registerSW);
      }

      // Debug de conectividad
      const handleOnline = () => {
        console.log("🌐 Back online");
        toast({
          title: "Back Online",
          description: "Internet connection restored.",
        });
      };

      const handleOffline = () => {
        console.log("🔌 Gone offline - App Shell should work");
        toast({
          title: "Offline Mode",
          description: "You can continue using cached features.",
          variant: "destructive",
        });
      };

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, [toast]);

  return null;
}
