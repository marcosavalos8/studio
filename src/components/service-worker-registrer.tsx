"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register(
            "/service-worker.js",
            {
              scope: "/", // Asegurar que cubra toda la app
            }
          );

          console.log("✅ SW registered successfully:", registration);

          // Manejar actualizaciones
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (
                  newWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  console.log("🔄 New SW available, reloading...");
                  window.location.reload();
                }
              });
            }
          });

          // Verificar actualizaciones periódicamente
          setInterval(() => {
            registration.update();
          }, 60000); // Cada minuto
        } catch (error) {
          console.error("❌ SW registration failed:", error);
        }
      };

      // Registrar cuando la página esté completamente cargada
      if (document.readyState === "complete") {
        registerSW();
      } else {
        window.addEventListener("load", registerSW);
      }

      // Manejar cambios de conectividad
      window.addEventListener("online", () => {
        console.log("🌐 Back online");
      });

      window.addEventListener("offline", () => {
        console.log("🔌 Gone offline");
      });
    }
  }, []);

  return null;
}
