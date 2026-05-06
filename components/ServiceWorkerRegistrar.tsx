"use client";

import { useEffect } from "react";

/**
 * Registers the service worker on the client. The SW is required for browsers
 * to consider the app "installable" and to provide an offline fallback.
 * The registration is silent — failures are logged but don't surface to users.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Don't register in non-prod to avoid stale caches during dev. Comment out
    // this guard if you want to test offline behavior locally.
    // if (process.env.NODE_ENV !== "production") return;

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) =>
          // eslint-disable-next-line no-console
          console.warn("[sw] registration failed:", err)
        );
    };

    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad);
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  return null;
}
