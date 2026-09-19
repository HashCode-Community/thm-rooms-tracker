import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { router } from "./router.js";
import "./styles.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Element #root introuvable dans index.html");
}

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
