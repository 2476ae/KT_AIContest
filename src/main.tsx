import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { registerConfiguredAiProvider } from "./services/registerAiProvider";
import "./styles.css";

registerConfiguredAiProvider();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
