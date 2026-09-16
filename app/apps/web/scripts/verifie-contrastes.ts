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
 *   1. le ratio WCAG de chaque paire declaree, transparence aplatie ;
 *   2. les couleurs imposees par les donnees, que la feuille ne regle pas ;
 *   3. la clarte percue des teintes de difficulte, rapportee sans condition ;
 *   4. tout token employe est mesure par une paire ;
 *   5. aucune couleur n'est ecrite en clair hors d'une declaration de token.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  analyser,
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
  // Petits textes : ce gris tient le seuil de texte courant sur la page. Il est
  // mesure comme tel, pas au rabais.
  { contexte: "petit texte sur la page", premierPlan: "--texte-eteint", arrierePlan: "--fond" },
  {
    contexte: "petit texte sur surface",
    premierPlan: "--texte-eteint",
    arrierePlan: "--fond-doux",
  },
  // DECORATIF, ET SEULEMENT AU-DESSUS DE 18 PX. La charte le dit, le seuil le
  // dit aussi : 3:1, celui du grand texte. Un emploi sous 18 px serait une
  // faute que ce seuil ne rattraperait pas — d'ou la regle ecrite dans la
  // feuille a cote du jeton.
  {
    contexte: "gris decoratif (>= 18 px) sur la page",
    premierPlan: "--texte-decoratif",
    arrierePlan: "--fond",
    grand: true,
  },

  // --- liens : blancs, jamais bleus ni violets ---
  { contexte: "lien sur la page", premierPlan: "--lien", arrierePlan: "--fond" },
  { contexte: "lien sur surface", premierPlan: "--lien", arrierePlan: "--fond-doux" },
  { contexte: "lien sur surface haute", premierPlan: "--lien", arrierePlan: "--fond-appuye" },

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

  // --- accent : action, etat actif, progression ---
  { contexte: "accent sur la page", premierPlan: "--accent", arrierePlan: "--fond" },
  { contexte: "accent sur surface", premierPlan: "--accent", arrierePlan: "--fond-doux" },
  // Le texte pose sur un aplat lime est noir, jamais blanc. La paire inverse est
  // une paire : c'est elle qu'on lit sur le bouton principal.
  { contexte: "texte sur aplat accent", premierPlan: "--sur-accent", arrierePlan: "--accent" },
  {
    contexte: "texte sur aplat accent survole",
    premierPlan: "--sur-accent",
    arrierePlan: "--accent-survol",
  },

  // --- difficulte : texte plein sur fond a 12 %, sur les deux surfaces ---
  // Le fond du badge est translucide : il est aplati sur la carte, puis sur la
  // page. Mesurer la teinte pleine a sa place donnerait un ratio qui ne
  // s'affiche nulle part.
  {
    contexte: "difficulte info sur carte",
    premierPlan: "--diff-info",
    arrierePlan: "--diff-info-fond",
    base: "--fond-doux",
  },
  {
    contexte: "difficulte info sur la page",
    premierPlan: "--diff-info",
    arrierePlan: "--diff-info-fond",
  },
  {
    contexte: "difficulte facile sur carte",
    premierPlan: "--diff-easy",
    arrierePlan: "--diff-easy-fond",
    base: "--fond-doux",
  },
  {
    contexte: "difficulte facile sur la page",
    premierPlan: "--diff-easy",
    arrierePlan: "--diff-easy-fond",
  },
  {
    contexte: "difficulte intermediaire sur carte",
    premierPlan: "--diff-medium",
    arrierePlan: "--diff-medium-fond",
    base: "--fond-doux",
  },
  {
    contexte: "difficulte intermediaire sur la page",
    premierPlan: "--diff-medium",
    arrierePlan: "--diff-medium-fond",
  },
  {
    contexte: "difficulte difficile sur carte",
    premierPlan: "--diff-hard",
    arrierePlan: "--diff-hard-fond",
    base: "--fond-doux",
  },
  {
    contexte: "difficulte difficile sur la page",
    premierPlan: "--diff-hard",
    arrierePlan: "--diff-hard-fond",
  },
  {
    contexte: "difficulte extreme sur carte",
    premierPlan: "--diff-insane",
    arrierePlan: "--diff-insane-fond",
    base: "--fond-doux",
  },
  {
    contexte: "difficulte extreme sur la page",
    premierPlan: "--diff-insane",
    arrierePlan: "--diff-insane-fond",
  },
  // --- etats ---
  { contexte: "succes sur sa surface", premierPlan: "--succes", arrierePlan: "--succes-fond" },
  { contexte: "succes sur la page", premierPlan: "--succes", arrierePlan: "--fond" },
  { contexte: "alerte sur sa surface", premierPlan: "--alerte", arrierePlan: "--alerte-fond" },
  { contexte: "alerte sur la page", premierPlan: "--alerte", arrierePlan: "--fond" },
  { contexte: "erreur sur sa surface", premierPlan: "--erreur", arrierePlan: "--erreur-fond" },
  { contexte: "erreur sur la page", premierPlan: "--erreur", arrierePlan: "--fond" },
  {
    contexte: "texte sur aplat erreur",
    premierPlan: "--sur-erreur",
    arrierePlan: "--erreur",
  },
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
  surCouleursExternes: "--texte",
  opaciteExterne: 0.12,
  fondExterne: "--fond-doux",
  teintes: ["--diff-info", "--diff-easy", "--diff-medium", "--diff-hard", "--diff-insane"],
  /**
   * Marques, pas arriere-plans : ces tokens sont peints en `background` sur des
   * traits de deux ou trois pixels — l'epine du chemin, vide en `--bord-fort` et
   * remplie en `--succes` jusqu'au point ou l'utilisateur en est, et le fil des
   * cartes de parcours. Rien ne s'ecrit dessus, donc aucune paire ne peut les
   * mesurer comme des fonds.
   */
  marques: ["--bord-fort", "--succes", "--accent"],
  seuilTexte: 4.5,
  seuilGrand: 3,
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

const tokens = lireTokensDuBloc(css, ":root");

console.log("\nContrastes — apps/web/src/styles.css");
console.log(`${PAIRES.length} paires, theme sombre unique\n`);

const rapport = analyser(css, REGLAGES, composants, tokens);
const echecs = [...rapport.echecs];

for (const mesure of rapport.mesures) {
  console.log(
    `  ${mesure.passe ? "OK  " : "ECHEC"} ${mesure.ratio.toFixed(2).padStart(6)}:1  ` +
      `(seuil ${mesure.seuil})  ${mesure.contexte}`,
  );
}

console.log("\n  Couleurs imposees par les donnees");
for (const externe of rapport.externes) {
  console.log(
    `  ${externe.passe ? "OK  " : "ECHEC"} ${externe.ratio.toFixed(2).padStart(6)}:1  ` +
      `${externe.nom}  ${externe.couleur}`,
  );
}

/*
 * CE QUE LA CHARTE FAIT PERDRE, ECRIT ICI PLUTOT QUE TU.
 *
 * Les cinq crans formaient avant une rampe de clarte monotone : un lecteur qui
 * ne percoit pas les teintes lisait quand meme cinq gris distincts. Le codage
 * par teinte de la charte rapproche certaines clartes. Le libelle ecrit en
 * toutes lettres sur chaque badge reste, lui, le porteur de l'information — ce
 * que WCAG 1.4.1 exige ; l'ecart de gris etait un supplement que la charte ne
 * garde pas. Les clartes sont donc affichees, sans condition de reussite.
 */
console.log("\n  Clarte percue des teintes de difficulte (rapportee, non bloquante)");
for (const { nom, clarte } of rapport.clartes) {
  console.log(`     ${nom.padEnd(16)} L* ${clarte.toFixed(1).padStart(5)}`);
}

// `theme-color` : une seule balise, egale au `--fond`.
{
  const fond = tokens.get("--fond") ?? "";
  const valeur = fond.startsWith("var(")
    ? (tokens.get(/var\(\s*(--[a-z0-9-]+)\s*\)/.exec(fond)?.[1] ?? "") ?? "")
    : fond;
  const derive = verifierThemeColor(html, valeur);
  if (derive !== null) echecs.push(derive);
}

console.log("\n  Aucun token n'echappe a la mesure");
console.log("  Aucune couleur ecrite en clair hors d'une declaration de token");
console.log(`     ${rapport.litteraux.length} litteral(aux) trouve(s)`);
console.log("  `theme-color` accorde a `--fond`");

if (echecs.length > 0) {
  console.error(`
ECHEC — ${echecs.length} probleme(s) :
`);
  for (const echec of echecs) console.error(`  - ${echec}`);
  console.error("");
  process.exit(1);
}

console.log("\nOK — la palette tient, rien en clair.\n");
