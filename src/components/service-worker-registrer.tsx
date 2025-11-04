"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/service-worker.js")
          .then((registration) => {
            console.log("✅ SW registered:", registration);

            // Verificar actualizaciones
            registration.addEventListener("updatefound", () => {
              console.log("🔄 SW update found");
            });
          })
          .catch((error) => {
            console.error("❌ SW registration failed:", error);
          });

        // Escuchar cuando el SW toma control
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          console.log("🎛️ SW controller changed");
        });
      });
    }
  }, []);

  return null;
}
