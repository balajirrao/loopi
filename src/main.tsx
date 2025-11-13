import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
const SERVICE_WORKER_HEARTBEAT_MS = 1000 * 60 * 30;

const requestSkipWaiting = (worker?: ServiceWorker | null) => {
  worker?.postMessage({ type: "SKIP_WAITING" });
};

const monitorInstallingWorker = (worker: ServiceWorker | null) => {
  if (!worker) {
    return;
  }

  worker.addEventListener("statechange", () => {
    if (worker.state === "installed" && navigator.serviceWorker.controller) {
      requestSkipWaiting(worker);
    }
  });
};

const bootstrapServiceWorker = () => {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`/sw.js?v=${APP_VERSION}`)
      .then((registration) => {
        requestSkipWaiting(registration.waiting);
        monitorInstallingWorker(registration.installing);

        registration.addEventListener("updatefound", () => {
          monitorInstallingWorker(registration.installing);
        });

        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) {
            return;
          }
          refreshing = true;
          window.location.reload();
        });

        setInterval(() => {
          registration.update().catch(() => {
            // swallow errors so registration persists
          });
        }, SERVICE_WORKER_HEARTBEAT_MS);
      })
      .catch(() => {
        // noop: SW optional during local dev
      });
  });
};

bootstrapServiceWorker();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
