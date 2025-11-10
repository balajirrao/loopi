import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // trigger update checks periodically
        setInterval(() => {
          registration.update().catch(() => {
            // swallow errors so registration persists
          });
        }, 1000 * 60 * 30);
      })
      .catch(() => {
        // noop: SW optional during local dev
      });
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
