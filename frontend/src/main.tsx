import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";
import "./styles/animations.css";
import { tokenPersistence } from "./utils/persistence";
import { initMedianIntegration } from "./utils/median";
import { initCapacitor } from "./utils/capacitor";

// Auto-recover from dynamic import chunk load failures (e.g. after remote code updates/deployments)
const handleChunkError = (error: any) => {
  const errorStr = String(error);
  if (
    errorStr.includes("Failed to fetch dynamically imported module") ||
    errorStr.includes("Importing a module script failed") ||
    errorStr.includes("ChunkLoadError")
  ) {
    console.warn("Dynamic import failure detected. Reloading application to sync assets...");
    const now = Date.now();
    const lastReload = sessionStorage.getItem("last_chunk_reload");
    if (!lastReload || now - parseInt(lastReload) > 8000) {
      sessionStorage.setItem("last_chunk_reload", now.toString());
      window.location.reload();
    }
  }
};

window.addEventListener("error", (e) => handleChunkError(e.error || e.message), true);
window.addEventListener("unhandledrejection", (e) => handleChunkError(e.reason));

const root = ReactDOM.createRoot(document.getElementById("root")!);

// Initialize Median.co WebView bridge (if running in Median app)
initMedianIntegration();

// Initialize Capacitor native features (if running as native Android/iOS app)
initCapacitor();

// Restore session from cookie/IndexedDB/Median Native Storage before mounting the App
tokenPersistence.restore().finally(() => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});

// On mobile WebView, localStorage can be cleared when the app is backgrounded and killed.
// When the user returns, restore the token from cookie or IndexedDB fallbacks.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !localStorage.getItem("access_token")) {
    tokenPersistence.restore();
  }
});
