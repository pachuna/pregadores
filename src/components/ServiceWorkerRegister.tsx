"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().catch(() => {
            // melhor esforço em dev
          });
        });
      });

      if ("caches" in window) {
        caches.keys().then((keys) => {
          keys
            .filter((key) => key.startsWith("pregadores-"))
            .forEach((key) => {
              caches.delete(key).catch(() => {
                // melhor esforço em dev
              });
            });
        });
      }

      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        // SW não crítico — falha silenciosa
      });
  }, []);

  return null;
}
