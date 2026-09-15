/**
 * Controleur de contraste.
 *
 * « Contraste AA » verifie a l'oeil n'est pas verifie. Ce script calcule le
 * ratio WCAG 2.1 de chaque paire premier-plan / arriere-plan reellement employee
 * dans l'interface, et sort en code 1 des qu'une seule passe sous le seuil.
 *
 * Il fait trois choses, et la troisieme est celle qui en fait un garde :
 *
 *   1. il mesure les paires DECLAREES ci-dessous ;
 *   2. il verifie que les cinq couleurs de difficulte restent distinctes une fois
 *      ramenees en niveaux de gris — la teinte seule exclut environ 8 % des
 *      hommes, et un lecteur daltonien doit pouvoir separer « facile » de
 *      « difficile » ;
 *   3. il verifie que TOUT token employe comme `color:` ou `background:` dans la
 *      feuille de style apparait dans au moins une paire declaree. Sans ce
 *      controle, la liste ci-dessous serait une liste qu'on oublie de mettre a
 *      jour, c'est-a-dire le defaut corrige par ADR-0004 sous une autre forme.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RACINE = resolve(import.meta.dirname, "..");
const FEUILLE = resolve(RACINE, "src/styles.css");

/** Seuils WCAG 2.1 niveau AA. */
const SEUIL_TEXTE = 4.5;
/** Texte large (>= 18,66px gras ou 24px) et bordures porteuses de sens. */
const SEUIL_GRAND = 3;
/** Ecart minimal de clarte percue entre deux couleurs de difficulte. */
const SEUIL_GRIS = 8;

type Paire = Readonly<{
  contexte: string;
  premierPlan: string;
  arrierePlan: string;
  /** Seuil abaisse a 3:1 : texte large, ou bordure porteuse de sens. */
  grand?: boolean;
}>;

/**
 * Les paires reellement employees.
 *
 * Une paire absente d'ici et presente dans la feuille fait echouer le controle 3,
 * donc cette liste ne peut pas se desynchroniser sans que ca se voie.
 */
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
  // Texte desactive : seuil abaisse, WCAG exempte les commandes inactives. Il
  // doit rester LISIBLE, pas invisible — d'ou un seuil quand meme applique.
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

  // --- difficulte : la couleur porte le LIBELLE, donc seuil texte ---
  { contexte: "difficulte info", premierPlan: "--diff-info", arrierePlan: "--fond-appuye" },
  { contexte: "difficulte facile", premierPlan: "--diff-easy", arrierePlan: "--fond-appuye" },
  { contexte: "difficulte moyenne", premierPlan: "--diff-medium", arrierePlan: "--fond-appuye" },
  { contexte: "difficulte difficile", premierPlan: "--diff-hard", arrierePlan: "--fond-appuye" },
  { contexte: "difficulte insane", premierPlan: "--diff-insane", arrierePlan: "--fond-appuye" },

  // --- etats : couleur sur sa propre surface, et sur la page ---
  { contexte: "succes sur sa surface", premierPlan: "--succes", arrierePlan: "--succes-fond" },
  { contexte: "succes sur la page", premierPlan: "--succes", arrierePlan: "--fond" },
  { contexte: "alerte sur sa surface", premierPlan: "--alerte", arrierePlan: "--alerte-fond" },
  { contexte: "alerte sur la page", premierPlan: "--alerte", arrierePlan: "--fond" },
  { contexte: "erreur sur sa surface", premierPlan: "--erreur", arrierePlan: "--erreur-fond" },
  { contexte: "erreur sur la page", premierPlan: "--erreur", arrierePlan: "--fond" },
  // --- inversions au survol : la paire inverse compte comme une paire ---
  { contexte: "lien sortant survole", premierPlan: "--fond", arrierePlan: "--lien" },
  {
    contexte: "trait du parcours",
    premierPlan: "--bord-fort",
    arrierePlan: "--fond",
    grand: true,
  },
  // L'indicateur replie s'inverse au survol : la paire inverse compte aussi.
  {
    contexte: "erreur inversee au survol",
    premierPlan: "--erreur-fond",
    arrierePlan: "--erreur",
  },
];

/**
 * Couleurs d'equipe, servies par l'API et NON reglables par la feuille de style.
 *
 * Elles portent du texte blanc et vivent dans `seed-reference.ts`. Elles sont
 * verifiees ici parce qu'elles sont affichees ici : une couleur qui vient de la
 * base reste une couleur employee dans l'interface.
 */
const COULEURS_EQUIPE: ReadonlyArray<readonly [string, string]> = [
  ["equipe Red", "#b3261e"],
  ["equipe Blue", "#1b5e9e"],
  ["equipe Purple", "#6b3fa0"],
  ["equipe inconnue (repli)", "#555555"],
];

const BLANC = "#ffffff";

// --- Couleur ---------------------------------------------------------------

type Rgb = readonly [number, number, number];

function parseHex(valeur: string): Rgb {
  const nettoye = valeur.trim().replace("#", "");
  const etendu =
    nettoye.length === 3
      ? nettoye
          .split("")
          .map((c) => c + c)
          .join("")
      : nettoye;
  if (!/^[0-9a-fA-F]{6}$/.test(etendu)) throw new Error(`Couleur illisible : ${valeur}`);
  const n = Number.parseInt(etendu, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Composante lineaire, formule WCAG 2.1. */
function lineaire(composante: number): number {
  const c = composante / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance([r, v, b]: Rgb): number {
  return 0.2126 * lineaire(r) + 0.7152 * lineaire(v) + 0.0722 * lineaire(b);
}

function ratio(premierPlan: Rgb, arrierePlan: Rgb): number {
  const a = luminance(premierPlan);
  const b = luminance(arrierePlan);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Clarte percue, L* de CIELAB.
 *
 * C'est la grandeur que preserve un rendu en niveaux de gris : deux couleurs de
 * L* proches deviennent le meme gris, quelles que soient leurs teintes.
 */
function clartePercue(couleur: Rgb): number {
  const y = luminance(couleur);
  const seuil = (6 / 29) ** 3;
  const f = y > seuil ? Math.cbrt(y) : y / (3 * (6 / 29) ** 2) + 4 / 29;
  return 116 * f - 16;
}

// --- Lecture des tokens ----------------------------------------------------

function lireTokens(css: string): Map<string, string> {
  const debut = css.indexOf(":root {");
  const fin = css.indexOf("}", debut);
  if (debut < 0 || fin < 0) throw new Error("Bloc :root introuvable");
  const bloc = css.slice(debut, fin);

  const tokens = new Map<string, string>();
  for (const ligne of bloc.split("\n")) {
    const trouve = /^\s*(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/.exec(ligne);
    if (trouve?.[1] !== undefined && trouve[2] !== undefined) tokens.set(trouve[1], trouve[2]);
  }
  return tokens;
}

/** Tokens employes comme `color:` et comme fond, dans TOUTE la feuille. */
function lireEmplois(css: string): { premierPlan: Set<string>; arrierePlan: Set<string> } {
  const premierPlan = new Set<string>();
  const arrierePlan = new Set<string>();

  for (const ligne of css.split("\n")) {
    const propriete = /^\s*([a-z-]+)\s*:\s*var\((--[a-z0-9-]+)\)/.exec(ligne);
    const nom = propriete?.[1];
    const token = propriete?.[2];
    if (nom === undefined || token === undefined) continue;
    if (nom === "color") premierPlan.add(token);
    if (nom === "background" || nom === "background-color") arrierePlan.add(token);
  }
  return { premierPlan, arrierePlan };
}

// --- Controles -------------------------------------------------------------

const css = readFileSync(FEUILLE, "utf8");
const tokens = lireTokens(css);
const echecs: string[] = [];

console.log(`\nContrastes — ${FEUILLE.replace(RACINE, "apps/web")}`);
console.log(`${tokens.size} tokens de couleur, ${PAIRES.length} paires declarees\n`);

const resoudre = (nom: string): Rgb => {
  const valeur = tokens.get(nom);
  if (valeur === undefined) throw new Error(`Token absent de :root : ${nom}`);
  return parseHex(valeur);
};

console.log("  1. Paires premier-plan / arriere-plan");
for (const paire of PAIRES) {
  const seuil = paire.grand === true ? SEUIL_GRAND : SEUIL_TEXTE;
  const mesure = ratio(resoudre(paire.premierPlan), resoudre(paire.arrierePlan));
  const passe = mesure >= seuil;
  if (!passe) {
    echecs.push(
      `${paire.contexte} : ${mesure.toFixed(2)}:1, seuil ${seuil}:1 ` +
        `(${paire.premierPlan} sur ${paire.arrierePlan})`,
    );
  }
  console.log(
    `     ${passe ? "OK  " : "ECHEC"} ${mesure.toFixed(2).padStart(6)}:1  ` +
      `(seuil ${seuil})  ${paire.contexte}`,
  );
}

console.log("\n  2. Couleurs d'equipe, texte blanc (servies par l'API)");
for (const [nom, couleur] of COULEURS_EQUIPE) {
  const mesure = ratio(parseHex(BLANC), parseHex(couleur));
  const passe = mesure >= SEUIL_TEXTE;
  if (!passe) echecs.push(`${nom} : ${mesure.toFixed(2)}:1 sur ${couleur}, seuil ${SEUIL_TEXTE}:1`);
  console.log(
    `     ${passe ? "OK  " : "ECHEC"} ${mesure.toFixed(2).padStart(6)}:1  ${nom}  ${couleur}`,
  );
}

console.log("\n  3. Difficultes distinctes en niveaux de gris");
const DIFFICULTES = ["--diff-info", "--diff-easy", "--diff-medium", "--diff-hard", "--diff-insane"];
const clartes = DIFFICULTES.map((nom) => ({ nom, clarte: clartePercue(resoudre(nom)) }));
for (const { nom, clarte } of clartes) {
  console.log(`     ${nom.padEnd(15)} L* ${clarte.toFixed(1).padStart(5)}`);
}
for (const [index, gauche] of clartes.entries()) {
  for (const droite of clartes.slice(index + 1)) {
    const ecart = Math.abs(gauche.clarte - droite.clarte);
    if (ecart < SEUIL_GRIS) {
      echecs.push(
        `${gauche.nom} et ${droite.nom} se confondent en niveaux de gris : ` +
          `ecart de clarte ${ecart.toFixed(1)}, minimum ${SEUIL_GRIS}`,
      );
    }
  }
}
const ecartMinimal = Math.min(
  ...clartes.flatMap((gauche, index) =>
    clartes.slice(index + 1).map((droite) => Math.abs(gauche.clarte - droite.clarte)),
  ),
);
console.log(`     ecart minimal ${ecartMinimal.toFixed(1)} (minimum ${SEUIL_GRIS})`);

console.log("\n  4. Aucun token n'echappe au controle");
const emplois = lireEmplois(css);
/**
 * Appartenance a l'UNION des deux cotes, pas au cote correspondant.
 *
 * Une couleur peinte en `background` n'est pas toujours un arriere-plan : le
 * trait du parcours est un fond de 2 pixels de large, c'est-a-dire une marque
 * posee SUR la page. Exiger qu'il soit declare comme arriere-plan obligerait a
 * inventer une paire ou rien ne s'ecrit. Ce que ce controle doit garantir est
 * qu'aucun token n'echappe a la mesure — c'est la paire declaree, plus haut, qui
 * decide dans quel sens le ratio est calcule.
 */
const declares = new Set(PAIRES.flatMap((p) => [p.premierPlan, p.arrierePlan]));

for (const [propriete, employes] of [
  ["`color:`", emplois.premierPlan],
  ["fond", emplois.arrierePlan],
] as const) {
  for (const token of [...employes].sort()) {
    if (!tokens.has(token)) continue; // token non colorimetrique (--rayon, --pas)
    if (!declares.has(token)) {
      echecs.push(`${token} est employe comme ${propriete} mais n'est mesure par aucune paire`);
    }
  }
}
console.log(
  `     ${emplois.premierPlan.size} tokens en premier plan, ` +
    `${emplois.arrierePlan.size} en arriere-plan, tous couverts`,
);

// --- Verdict ---------------------------------------------------------------

if (echecs.length > 0) {
  console.error(`\nECHEC — ${echecs.length} probleme(s) de contraste :\n`);
  for (const echec of echecs) console.error(`  - ${echec}`);
  console.error("");
  process.exit(1);
}

console.log("\nOK — toutes les paires employees atteignent leur seuil.\n");
