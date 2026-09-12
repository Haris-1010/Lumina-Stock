"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    async function configureWorker() {
      if (process.env.NODE_ENV !== "production") {
        const registrations = await navigator.serviceWorker.getRegistrations();
        const isLuminaWorker = (worker: ServiceWorker | null) =>
          worker && new URL(worker.scriptURL).pathname === "/sw.js";
        const controlled = isLuminaWorker(navigator.serviceWorker.controller);
        await Promise.all(registrations.filter((registration) =>
          [registration.active, registration.waiting, registration.installing].some(isLuminaWorker)
        ).map((registration) => registration.unregister()));
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.filter((key) => key.startsWith("lumina-")).map((key) => caches.delete(key)));
        }
        // A reload releases the old controller and fetches matching HTML and JavaScript.
        if (controlled) window.location.reload();
        return;
      }
      await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
    }

    configureWorker().catch((error) => console.error("Service worker setup failed:", error));
  }, []);

  return null;
}
