/**
 * Controleur d'accents des textes affiches.
 *
 * Sort en code 1 des qu'un texte d'interface porte une forme non accentuee
 * connue. Branche sur `pnpm lint`, disponible seul par `pnpm accents`.
 *
 * PERIMETRE. Tout `apps/web/src`, plus les fichiers de `packages/shared` dont le
 * texte finit a l'ecran — et eux seuls : `CONTRACT_NOTES` et les notes d'audit
 * du paquet partage sont de la documentation interne, ecrite sans accents comme
 * les commentaires. Les inclure ferait sortir le controle a chaque execution,
 * c'est-a-dire ne servirait plus a rien.
 *
 * La logique est dans `accents.ts`, exercee par `tests/accents.test.ts`.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { analyser } from "./accents.js";

const RACINE = resolve(import.meta.dirname, "..");
const DEPOT = resolve(RACINE, "../..");

/** Fichiers du paquet partage qui portent du texte affiche a l'ecran. */
const PARTAGES = [
  "packages/shared/src/roadmap.ts",
  "packages/shared/src/api-queries.ts",
  "packages/shared/src/api-responses.ts",
];

function sources(racine: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(racine, { withFileTypes: true })) {
    const chemin = join(racine, entree.name);
    if (entree.isDirectory()) trouves.push(...sources(chemin));
    else if (/\.tsx?$/.test(entree.name) && !/\.test\.tsx?$/.test(entree.name)) {
      trouves.push(chemin);
    }
  }
  return trouves;
}

const fichiers = [
  ...sources(resolve(RACINE, "src")),
  ...PARTAGES.map((chemin) => resolve(DEPOT, chemin)),
];

let total = 0;
for (const fichier of fichiers) {
  const signalements = analyser(readFileSync(fichier, "utf8"));
  for (const { ligne, texte, formes } of signalements) {
    total += 1;
    const court = texte.length > 88 ? `${texte.slice(0, 88)}…` : texte;
    console.error(`${relative(DEPOT, fichier)}:${ligne} — ${formes.join(", ")} :: ${court}`);
  }
}

if (total > 0) {
  console.error(
    `\nECHEC — ${total} texte${total > 1 ? "s" : ""} affiche${total > 1 ? "s" : ""} sans accent.`,
  );
  process.exit(1);
}

console.log(`OK — ${fichiers.length} fichiers, aucun texte affiche sans accent.`);
