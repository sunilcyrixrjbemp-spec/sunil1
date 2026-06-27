import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";
import "./styles/animations.css";
import { tokenPersistence } from "./utils/persistence";
import { initMedianIntegration } from "./utils/median";
import { initCapacitor } from "./utils/capacitor";

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
