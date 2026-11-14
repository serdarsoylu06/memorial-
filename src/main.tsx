import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import App from "./App";
import { useAppStore } from "./store/useAppStore";
import "./index.css";

// Tema, ilk çizimden önce uygulanır; yoksa açılışta bir an yanlış tema görünür.
document.documentElement.dataset.theme = useAppStore.getState().settings.ui.theme;

async function start() {
  if (import.meta.env.VITE_DEMO) {
    const { installDemo } = await import("./demo/mockIpc");
    installDemo();
  }

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

void start();
