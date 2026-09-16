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
import { analyser, analyserYaml } from "./langue.js";

const RACINE = resolve(import.meta.dirname, "..");
const DEPOT = resolve(RACINE, "../..");

/**
 * Fichiers hors de `apps/web` qui portent du texte AFFICHE.
 *
 * Les libelles de difficulte et d'equipe ne sont pas ecrits dans le front : ils
 * viennent de la base, peuplee par `seed-reference.ts`. Le controle ne les
 * voyait donc pas, et « Intermediaire » et « Extreme » sont restes les trois
 * derniers mots non accentues du site pendant toute la refonte. Un controle qui
 * ne regarde pas la ou le texte est ecrit ne controle rien.
 */
/** Contenu editorial des parcours : la source, avant la base. */
const CONTENU = "data/roadmap/tracks";

const HORS_WEB = [
  "packages/shared/src/roadmap.ts",
  "packages/shared/src/api-queries.ts",
  "packages/shared/src/api-responses.ts",
  "apps/api/src/db/seed-reference.ts",
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
  ...HORS_WEB.map((chemin) => resolve(DEPOT, chemin)),
];

const parcours = readdirSync(resolve(DEPOT, CONTENU))
  .filter((nom) => nom.endsWith(".yaml"))
  .map((nom) => resolve(DEPOT, CONTENU, nom));

let total = 0;
const compter = (fichier: string, signalements: ReturnType<typeof analyser>): void => {
  for (const { ligne, texte, formes, genre } of signalements) {
    total += 1;
    const court = texte.length > 80 ? `${texte.slice(0, 80)}…` : texte;
    console.error(
      `${relative(DEPOT, fichier)}:${ligne} [${genre}] ${formes.join(", ")} :: ${court}`,
    );
  }
};

for (const fichier of fichiers) compter(fichier, analyser(readFileSync(fichier, "utf8")));
for (const fichier of parcours) compter(fichier, analyserYaml(readFileSync(fichier, "utf8")));

if (total > 0) {
  console.error(`
ECHEC — ${total} probleme${total > 1 ? "s" : ""} de langue.`);
  process.exit(1);
}

console.log(`OK — ${fichiers.length + parcours.length} fichiers, tout est accentue et vouvoie.`);
