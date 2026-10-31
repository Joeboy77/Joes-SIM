"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Registers the service worker (production builds only), and offers to reload when a new
 * version is ready. Nothing changes until the learner chooses, so no work is interrupted.
 */
export function OfflineSupport() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const reloadRequested = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    // The first install also changes the controller; only a reload the learner asked for counts.
    const onControllerChange = () => {
      if (!reloadRequested.current) return;
      reloadRequested.current = false;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // A new version can already be waiting, or arrive while the page is open.
        const watch = (worker: ServiceWorker | null) => {
          if (!worker) return;
          const check = () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller)
              setWaiting(worker);
          };
          check();
          worker.addEventListener("statechange", check);
        };
        watch(registration.waiting);
        registration.addEventListener("updatefound", () => watch(registration.installing));
        const onVisible = () => {
          if (document.visibilityState === "visible")
            void registration.update().catch(() => undefined);
        };
        document.addEventListener("visibilitychange", onVisible);
      })
      .catch(() => undefined);

    return () =>
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  if (!waiting) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md flex-wrap items-center justify-between gap-3 rounded-lg border border-border-strong bg-surface p-3 shadow-lg"
    >
      <p className="text-sm">A new version of Joe&apos;s SIM is ready. Your work is kept.</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setWaiting(null)}
          className="min-h-11 rounded-md border border-border-strong px-3 text-sm"
        >
          Later
        </button>
        <button
          type="button"
          onClick={() => {
            reloadRequested.current = true;
            waiting.postMessage({ type: "SKIP_WAITING" });
          }}
          className="min-h-11 rounded-md bg-accent px-3 text-sm font-bold text-on-accent"
        >
          Reload
        </button>
      </div>
    </div>
  );
}
