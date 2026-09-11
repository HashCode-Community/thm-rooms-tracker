import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // La sonde d'inference et la fixture empoisonnee ne s'executent jamais :
    // elles sont verifiees par `pnpm typecheck` et `pnpm typecheck:guard`.
    exclude: ["tests/**/*.probe.ts", "tests/fixtures/**"],
    environment: "node",
  },
});
