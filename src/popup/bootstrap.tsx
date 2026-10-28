import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { configureExtensionSurface } from "@petercoxhatesbridges/extension-ui";
import { App } from "./App";
configureExtensionSurface("popup");
const root = document.getElementById("root");
if (!root) throw new Error("CleanIn popup root is missing");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
