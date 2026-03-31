import React from "react";
import ReactDOM from "react-dom/client";
import { AppShell } from "./app-shell";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>,
);
