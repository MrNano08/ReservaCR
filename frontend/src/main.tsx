/// <reference types="vite/client" />

import "./i18n/config";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Global bootstrap: route changes and React StrictMode must not insert another widget.
const userWayAccountId = import.meta.env.VITE_USERWAY_ACCOUNT_ID?.trim();
if (userWayAccountId) {
  if (
    !document.getElementById("userway-widget-script") &&
    !document.querySelector('script[src="https://cdn.userway.org/widget.js"]')
  ) {
    const script = document.createElement("script");
    script.id = "userway-widget-script";
    script.src = "https://cdn.userway.org/widget.js";
    script.async = true;
    script.setAttribute("data-account", userWayAccountId);
    // The shared layout provides the single custom trigger on every route.
    script.setAttribute("data-trigger", "userway-widget-trigger");
    script.addEventListener(
      "error",
      () => {
        if (import.meta.env.DEV)
          console.warn("[UserWay] No se pudo cargar el widget de accesibilidad.");
      },
      { once: true },
    );
    document.head.appendChild(script);
  }
} else if (import.meta.env.DEV) {
  console.warn("[UserWay] Widget desactivado: falta VITE_USERWAY_ACCOUNT_ID.");
}
