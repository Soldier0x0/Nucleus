import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyStoredTheme } from "./platform/theme";
import { installSyncBridge } from "./sync/server";
import "./styles.css";

applyStoredTheme();
installSyncBridge();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
