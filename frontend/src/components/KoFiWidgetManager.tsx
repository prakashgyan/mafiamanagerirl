import { useEffect } from "react";
import { useLocation } from "react-router-dom";

declare global {
  interface Window {
    kofiWidgetOverlay?: {
      draw: (
        username: string,
        options: Record<string, string>
      ) => void;
    };
    __kofiWidgetOverlayLoaded?: boolean;
  }
}

const KOFI_SCRIPT_SRC = "https://storage.ko-fi.com/cdn/scripts/overlay-widget.js";

const ensureKoFiScript = () => {
  if (document.querySelector('script[data-ko-fi-overlay="true"]')) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = KOFI_SCRIPT_SRC;
    script.async = true;
    script.dataset.koFiOverlay = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Ko-fi widget script"));
    document.body.appendChild(script);
  });
};

const hideWidget = () => {
  const overlay = document.getElementById("kofi-widget-overlay");
  if (overlay) {
    overlay.style.display = "none";
  }
};

const showWidget = () => {
  const overlay = document.getElementById("kofi-widget-overlay");
  if (overlay) {
    overlay.style.removeProperty("display");
  }
};

const drawWidget = () => {
  if (!window.kofiWidgetOverlay) {
    return;
  }

  if (!window.__kofiWidgetOverlayLoaded) {
    window.kofiWidgetOverlay.draw("mafiadesk", {
      type: "floating-chat",
      "floating-chat.donateButton.text": "Support me",
      "floating-chat.donateButton.background-color": "#794bc4",
      "floating-chat.donateButton.text-color": "#fff",
    });
    window.__kofiWidgetOverlayLoaded = true;
  }

  showWidget();
};

const KoFiWidgetManager = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/") {
      hideWidget();
      return;
    }

    let cancelled = false;

    ensureKoFiScript()
      .then(() => {
        if (!cancelled) {
          drawWidget();
        }
      })
      .catch(() => {
        // Swallow script load errors to avoid breaking the app UI.
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  return null;
};

export default KoFiWidgetManager;
