"use client";

import { registerServiceWorker } from "@/lib/utils/performance";
import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    registerServiceWorker("/sw.js");

    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });

      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "SW_UPDATE_AVAILABLE") {
          if (confirm("A new version is available. Would you like to update?")) {
            event.ports?.[0]?.postMessage({ type: "SKIP_WAITING" });
          }
        }
      });
    }

    const addResourceHints = () => {
      if (typeof window !== "undefined") {
        const dnsPrefetchDomains = ["fonts.googleapis.com", "fonts.gstatic.com"];

        dnsPrefetchDomains.forEach((domain) => {
          const link = document.createElement("link");
          link.rel = "dns-prefetch";
          link.href = `//${domain}`;
          document.head.appendChild(link);
        });

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
