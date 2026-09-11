import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Les tests d'API ont besoin de `DATABASE_URL`. Contrairement aux scripts, Vitest
 * ne passe pas par `node --env-file`, d'ou ce chargement explicite du `.env` de la
 * racine. `process.loadEnvFile` est natif depuis Node 20.12, aucune dependance.
 *
 * S'il n'y a pas de `.env`, on ne fait rien : c'est `assertDatabaseReady` qui
 * echouera, avec la commande a taper. Un test ne se saute jamais en silence.
 */
const envFile = resolve(import.meta.dirname, "../../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // La sonde d'inference et la fixture empoisonnee ne s'executent jamais :
    // elles sont verifiees par `pnpm typecheck` et `pnpm typecheck:guard`.
    exclude: ["tests/**/*.probe.ts", "tests/fixtures/**"],
    environment: "node",
  },
});
