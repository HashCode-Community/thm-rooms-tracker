import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API_TARGET = "http://127.0.0.1:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // L'API est jointe via le meme origine que le front. Consequence : aucun CORS
    // en developpement, et le dev reproduit la cible de production decidee en
    // reponse a D3 (rewrite `/api/*` -> api.<domaine>, cookie de session same-site).
    proxy: {
      "/health": { target: API_TARGET },
      "/api": { target: API_TARGET },
    },
  },
});
