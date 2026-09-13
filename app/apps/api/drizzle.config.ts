import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

// drizzle-kit est invoque par son binaire, pas par `node --env-file`. On charge
// donc le .env ici, via l'API native de Node 24. Un seul .env, a la racine du
// depot, partage par docker-compose et par l'API : pas de duplication a maintenir.
//
// `import.meta.dirname` est inutilisable : drizzle-kit compile cette config en
// CJS avec esbuild avant de l'evaluer. On remonte donc depuis le repertoire
// courant jusqu'a trouver le .env.
function findEnvFile(from: string): string | null {
  let current = resolve(from);
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolve(current, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

const envPath = findEnvFile(process.cwd());
if (envPath) {
  process.loadEnvFile(envPath);
}

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    `DATABASE_URL absent et aucun .env lisible en ${envPath}.\n` +
      "Copier `.env.example` en `.env` a la racine du depot.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: { url },
  // Les migrations sont relues avant d'etre jouees : jamais de `push` direct sur
  // une base, meme locale. On veut un fichier SQL versionne, pas un diff implicite.
  strict: true,
  verbose: true,
});
