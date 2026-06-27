import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";
import "./styles/animations.css";
import { tokenPersistence } from "./utils/persistence";

const root = ReactDOM.createRoot(document.getElementById("root")!);

// Restore session from cookie/IndexedDB fallbacks asynchronously before mounting the App
tokenPersistence.restore().finally(() => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
