"use client";

import { registerServiceWorker } from "@/lib/utils/performance";
import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Register service worker
    registerServiceWorker("/sw.js");

    // Handle service worker updates
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        // Reload the page when a new service worker takes control
        window.location.reload();
      });

      // Listen for service worker messages
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "SW_UPDATE_AVAILABLE") {
          // Show update notification to user
          if (confirm("A new version is available. Would you like to update?")) {
            event.ports?.[0]?.postMessage({ type: "SKIP_WAITING" });
          }
        }
      });
    }

    // Add resource hints for better performance
    const addResourceHints = () => {
      if (typeof window !== "undefined") {
        // DNS prefetch for external domains
        const dnsPrefetchDomains = ["fonts.googleapis.com", "fonts.gstatic.com"];

        dnsPrefetchDomains.forEach((domain) => {
          const link = document.createElement("link");
          link.rel = "dns-prefetch";
          link.href = `//${domain}`;
          document.head.appendChild(link);
        });

        // Preconnect to critical domains
        const preconnectDomains = ["https://fonts.googleapis.com"];

        preconnectDomains.forEach((domain) => {
          const link = document.createElement("link");
          link.rel = "preconnect";
          link.href = domain;
          link.crossOrigin = "anonymous";
          document.head.appendChild(link);
        });
      }
    };

    addResourceHints();
  }, []);

  return null;
}
