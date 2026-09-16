/**
 * Controleur de contraste et de couleurs litterales.
 *
 * « Contraste AA » verifie a l'oeil n'est pas verifie. Ce script mesure, et sort
 * en code 1 des qu'une seule paire passe sous le seuil. Il est branche sur
 * `pnpm lint` et disponible seul par `pnpm contrast`.
 *
 * La logique vit dans `contrastes.ts` pour etre TESTABLE : un garde qu'on ne
 * peut exercer qu'en cassant le depot reel ne se verifie jamais vraiment.
 *
 * Cinq controles, et les deux derniers sont ceux qui en font un garde :
 *   1. le ratio WCAG de chaque paire declaree ;
 *   2. les couleurs imposees par les donnees, que la feuille ne regle pas ;
 *   3. la rampe de difficulte reste une rampe en niveaux de gris ;
 *   4. tout token employe est mesure par une paire ;
 *   5. aucune couleur n'est ecrite en clair hors du bloc de tokens.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  analyser,
  comparerBlocs,
  lireTokensDuBloc,
  type Paire,
  type Reglages,
  verifierThemeColor,
} from "./contrastes.js";

const RACINE = resolve(import.meta.dirname, "..");
const FEUILLE = resolve(RACINE, "src/styles.css");
const SOURCES = resolve(RACINE, "src");

const PAIRES: readonly Paire[] = [
  // --- texte sur les trois fonds ---
  { contexte: "texte principal sur la page", premierPlan: "--texte", arrierePlan: "--fond" },
  { contexte: "texte principal sur surface", premierPlan: "--texte", arrierePlan: "--fond-doux" },
  {
    contexte: "texte principal sur surface haute",
    premierPlan: "--texte",
    arrierePlan: "--fond-appuye",
  },
  { contexte: "texte secondaire sur la page", premierPlan: "--texte-doux", arrierePlan: "--fond" },
  {
    contexte: "texte secondaire sur surface",
    premierPlan: "--texte-doux",
    arrierePlan: "--fond-doux",
  },
  {
    contexte: "texte secondaire sur surface haute",
    premierPlan: "--texte-doux",
    arrierePlan: "--fond-appuye",
  },
  // Texte desactive : WCAG exempte les commandes inactives, mais il doit rester
  // LISIBLE, pas invisible. Seuil abaisse, jamais supprime.
  {
    contexte: "texte desactive sur la page",
    premierPlan: "--texte-eteint",
    arrierePlan: "--fond",
    grand: true,
  },
  {
    contexte: "texte desactive sur surface",
    premierPlan: "--texte-eteint",
    arrierePlan: "--fond-doux",
    grand: true,
  },

  // --- liens ---
  { contexte: "lien sur la page", premierPlan: "--lien", arrierePlan: "--fond" },
  { contexte: "lien sur surface", premierPlan: "--lien", arrierePlan: "--fond-doux" },
  { contexte: "lien sur surface haute", premierPlan: "--lien", arrierePlan: "--fond-appuye" },
  { contexte: "lien survole sur la page", premierPlan: "--lien-survol", arrierePlan: "--fond" },
  { contexte: "lien visite sur la page", premierPlan: "--lien-visite", arrierePlan: "--fond" },
  { contexte: "lien visite sur surface", premierPlan: "--lien-visite", arrierePlan: "--fond-doux" },

  // --- bordures porteuses de sens ---
  {
    contexte: "bordure marquee sur la page",
    premierPlan: "--bord-fort",
    arrierePlan: "--fond",
    grand: true,
  },
  {
    contexte: "bordure marquee sur surface",
    premierPlan: "--bord-fort",
    arrierePlan: "--fond-doux",
    grand: true,
  },
  {
    contexte: "anneau de focus sur la page",
    premierPlan: "--focus",
    arrierePlan: "--fond",
    grand: true,
  },
  {
    contexte: "anneau de focus sur surface haute",
    premierPlan: "--focus",
    arrierePlan: "--fond-appuye",
    grand: true,
  },

  // --- difficulte : la couleur accompagne le LIBELLE, donc seuil texte ---
  {
    contexte: "difficulte info (hors rampe)",
    premierPlan: "--diff-info",
    arrierePlan: "--fond-appuye",
  },
  { contexte: "difficulte facile", premierPlan: "--diff-easy", arrierePlan: "--fond-appuye" },
  { contexte: "difficulte moyenne", premierPlan: "--diff-medium", arrierePlan: "--fond-appuye" },
  { contexte: "difficulte difficile", premierPlan: "--diff-hard", arrierePlan: "--fond-appuye" },
  { contexte: "difficulte insane", premierPlan: "--diff-insane", arrierePlan: "--fond-appuye" },

  // --- etats ---
  { contexte: "succes sur sa surface", premierPlan: "--succes", arrierePlan: "--succes-fond" },
  { contexte: "succes sur la page", premierPlan: "--succes", arrierePlan: "--fond" },
  { contexte: "alerte sur sa surface", premierPlan: "--alerte", arrierePlan: "--alerte-fond" },
  { contexte: "alerte sur la page", premierPlan: "--alerte", arrierePlan: "--fond" },
  { contexte: "erreur sur sa surface", premierPlan: "--erreur", arrierePlan: "--erreur-fond" },
  { contexte: "erreur sur la page", premierPlan: "--erreur", arrierePlan: "--fond" },

  // --- inversions : la paire inverse est une paire ---
  { contexte: "lien sortant survole", premierPlan: "--fond", arrierePlan: "--lien" },
  // Le bouton principal porte le fond de l'accent, pas seulement sa bordure :
  // le texte pose dessus est donc celui de la page, a l'envers.
  { contexte: "bouton principal", premierPlan: "--fond", arrierePlan: "--lien" },
  { contexte: "bouton principal survole", premierPlan: "--fond", arrierePlan: "--lien-survol" },
  { contexte: "erreur inversee au survol", premierPlan: "--erreur-fond", arrierePlan: "--erreur" },
  // Le lien d'evitement est le PREMIER element focalisable de chaque page. Il
  // peignait `#fff` sur `var(--texte)` : invisible des que `--texte` est devenu
  // clair. La paire est declaree pour que sa mesure existe.
  { contexte: "lien d'evitement au focus", premierPlan: "--texte", arrierePlan: "--fond-appuye" },
];

const REGLAGES: Reglages = {
  paires: PAIRES,
  /**
   * Couleurs d'equipe, servies par l'API et NON reglables par la feuille. Elles
   * vivent dans `seed-reference.ts`, et sont verifiees ici parce qu'elles sont
   * affichees ici : une couleur qui vient de la base reste une couleur employee
   * dans l'interface.
   */
  couleursExternes: [
    ["equipe Red", "#b3261e"],
    ["equipe Blue", "#1b5e9e"],
    ["equipe Purple", "#6b3fa0"],
    ["equipe inconnue (repli)", "#555555"],
  ],
  surCouleursExternes: "--sur-couleur-imposee",
  rampe: ["--diff-easy", "--diff-medium", "--diff-hard", "--diff-insane"],
  /**
   * Marques, pas arriere-plans : ces tokens sont peints en `background` sur des
   * traits de deux pixels — l'epine du chemin, vide en `--bord-fort` et remplie
   * en `--succes` jusqu'au point ou l'utilisateur en est. Rien ne s'ecrit
   * dessus, donc aucune paire ne peut les mesurer comme des fonds.
   */
  marques: ["--bord-fort", "--succes"],
  seuilTexte: 4.5,
  seuilGrand: 3,
  seuilGris: 8,
};

function fichiersSources(dossier: string): Array<{ chemin: string; contenu: string }> {
  const trouves: Array<{ chemin: string; contenu: string }> = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const complet = join(dossier, entree.name);
    if (entree.isDirectory()) {
      trouves.push(...fichiersSources(complet));
      continue;
    }
    if (!/\.(tsx?|css)$/.test(entree.name)) continue;
    if (complet === FEUILLE) continue; // analysee a part, avec son bloc de tokens
    trouves.push({ chemin: relative(RACINE, complet), contenu: readFileSync(complet, "utf8") });
  }
  return trouves;
}

const css = readFileSync(FEUILLE, "utf8");
const html = readFileSync(resolve(RACINE, "index.html"), "utf8");
const composants = fichiersSources(SOURCES);

/**
 * LES TROIS BLOCS DE TOKENS.
 *
 * `:root` porte le sombre. Le clair est ecrit deux fois, CSS ne permettant pas
 * de reunir un selecteur ordinaire et un selecteur sous requete de media.
 */
const SOMBRE = ":root";
const CLAIR_SYSTEME = ':root:not([data-theme="dark"])';
const CLAIR_CHOISI = ':root[data-theme="light"]';

const palettes = [
  { nom: "sombre", tokens: lireTokensDuBloc(css, SOMBRE) },
  { nom: "clair", tokens: lireTokensDuBloc(css, CLAIR_CHOISI) },
] as const;

console.log("\nContrastes — apps/web/src/styles.css");
console.log(
  `${PAIRES.length} paires x ${palettes.length} themes = ${PAIRES.length * palettes.length} mesures\n`,
);

const echecs: string[] = [];
let litteraux = 0;

for (const palette of palettes) {
  // Les litteraux et les emplois ne dependent pas du theme : on ne les compte
  // qu'une fois, sur la premiere palette.
  const premier = palette === palettes[0];
  const rapport = analyser(css, REGLAGES, premier ? composants : [], palette.tokens, palette.nom);
  echecs.push(...rapport.echecs);
  if (premier) litteraux = rapport.litteraux.length;

  console.log(`  THEME ${palette.nom.toUpperCase()}`);
  for (const mesure of rapport.mesures) {
    console.log(
      `     ${mesure.passe ? "OK  " : "ECHEC"} ${mesure.ratio.toFixed(2).padStart(6)}:1  ` +
        `(seuil ${mesure.seuil})  ${mesure.contexte}`,
    );
  }
  console.log("     rampe :");
  for (const { nom, clarte } of rapport.clartes) {
    console.log(`       ${nom.padEnd(15)} L* ${clarte.toFixed(1).padStart(5)}`);
  }
  console.log(
    `       ecart minimal ${rapport.ecartMinimal.toFixed(1)} (minimum ${REGLAGES.seuilGris})`,
  );
  console.log("");
}

console.log("  Couleurs imposees par les donnees, identiques dans les deux themes");
{
  const rapport = analyser(css, REGLAGES, [], palettes[0].tokens, "");
  for (const externe of rapport.externes) {
    console.log(
      `     ${externe.passe ? "OK  " : "ECHEC"} ${externe.ratio.toFixed(2).padStart(6)}:1  ` +
        `${externe.nom}  ${externe.couleur}`,
    );
  }
}

// Les deux ecritures du theme clair doivent etre identiques : la duplication
// est imposee par CSS, la derive ne l'est pas.
echecs.push(
  ...comparerBlocs(
    lireTokensDuBloc(css, CLAIR_SYSTEME),
    lireTokensDuBloc(css, CLAIR_CHOISI),
    "le clair sous preference systeme",
    "le clair choisi explicitement",
  ),
);

// `theme-color` : une balise par theme, chacune egale au `--fond` du sien.
for (const palette of palettes) {
  const fond = palette.tokens.get("--fond") ?? "";
  const derive = verifierThemeColor(html, fond, palette.nom);
  if (derive !== null) echecs.push(derive);
}

console.log("\n  Aucun token n'echappe a la mesure");
console.log("  Aucune couleur ecrite en clair hors d'une declaration de token");
console.log(`     ${litteraux} litteral(aux) trouve(s)`);
console.log("  Les deux ecritures du theme clair sont identiques");
console.log("  `theme-color` accorde a `--fond`, dans les deux themes");

if (echecs.length > 0) {
  console.error(`
ECHEC — ${echecs.length} probleme(s) :
`);
  for (const echec of echecs) console.error(`  - ${echec}`);
  console.error("");
  process.exit(1);
}

console.log("\nOK — les deux palettes tiennent, rampes monotones, rien en clair.\n");
