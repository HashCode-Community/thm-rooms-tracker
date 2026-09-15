/**
 * Analyse de la couleur : contrastes, clarte percue, litteraux.
 *
 * Separe du script en ligne de commande pour etre TESTABLE. Un garde qu'on ne
 * peut exercer que sur le depot reel ne se verifie qu'en cassant le depot reel ;
 * ici, un test lui donne une feuille de style fabriquee et exige qu'il tombe.
 */

// --- Couleur ---------------------------------------------------------------

export type Rgb = readonly [number, number, number];

export function parseHex(valeur: string): Rgb {
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

export function luminance([r, v, b]: Rgb): number {
  return 0.2126 * lineaire(r) + 0.7152 * lineaire(v) + 0.0722 * lineaire(b);
}

export function ratio(premierPlan: Rgb, arrierePlan: Rgb): number {
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
export function clartePercue(couleur: Rgb): number {
  const y = luminance(couleur);
  const seuil = (6 / 29) ** 3;
  const f = y > seuil ? Math.cbrt(y) : y / (3 * (6 / 29) ** 2) + 4 / 29;
  return 116 * f - 16;
}

// --- Lecture de la feuille -------------------------------------------------

/** Retire les commentaires CSS et JS : la prose n'est pas du style. */
export function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");
}

export function lireTokens(css: string): Map<string, string> {
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
export function lireEmplois(css: string): {
  premierPlan: Set<string>;
  arrierePlan: Set<string>;
} {
  const premierPlan = new Set<string>();
  const arrierePlan = new Set<string>();

  for (const ligne of sansCommentaires(css).split("\n")) {
    const propriete = /^\s*([a-z-]+)\s*:\s*var\((--[a-z0-9-]+)\)/.exec(ligne);
    const nom = propriete?.[1];
    const token = propriete?.[2];
    if (nom === undefined || token === undefined) continue;
    if (nom === "color") premierPlan.add(token);
    if (nom === "background" || nom === "background-color") arrierePlan.add(token);
  }
  return { premierPlan, arrierePlan };
}

// --- Couleurs litterales ---------------------------------------------------

/**
 * Toute facon d'ecrire une couleur autrement qu'en la nommant.
 *
 * `white-space` et `border-black` ne doivent pas remonter : les bornes excluent
 * le tiret, des deux cotes.
 */
const LITTERAL = /#[0-9a-fA-F]{3,8}\b|(?<![\w-])(?:white|black)(?![\w-])|\b(?:rgba?|hsla?)\s*\(/g;

export type Litteral = Readonly<{ fichier: string; ligne: number; texte: string }>;

/**
 * Couleurs ecrites en clair AILLEURS que dans le bloc `:root`.
 *
 * POURQUOI CE CONTROLE EXISTE. Le passage au theme sombre a revele deux regles
 * qui peignaient `#fff` sur une couleur devenue claire : le lien d'evitement,
 * premier element focalisable de chaque page, et le lien sortant survole. Les
 * deux ont ete trouves EN REGARDANT. Personne ne pouvait dire s'il y en avait
 * deux ou onze. Une couleur litterale echappe par construction au controleur de
 * contraste, qui lit des tokens : elle doit donc etre interdite, pas surveillee.
 */
export function trouverLitteraux(
  fichiers: ReadonlyArray<{ chemin: string; contenu: string }>,
): Litteral[] {
  const trouves: Litteral[] = [];

  for (const { chemin, contenu } of fichiers) {
    const nettoye = sansCommentaires(contenu);
    const lignes = nettoye.split("\n");

    // Le bloc `:root` est le SEUL endroit ou une couleur s'ecrit en clair.
    const debutRoot = lignes.findIndex((l) => l.includes(":root {"));
    const finRoot =
      debutRoot === -1 ? -1 : lignes.findIndex((l, i) => i > debutRoot && l.trim() === "}");

    for (const [index, ligne] of lignes.entries()) {
      if (debutRoot !== -1 && index >= debutRoot && index <= finRoot) continue;
      for (const trouve of ligne.matchAll(LITTERAL)) {
        trouves.push({ fichier: chemin, ligne: index + 1, texte: trouve[0] });
      }
    }
  }
  return trouves;
}

// --- Verdict ---------------------------------------------------------------

export type Paire = Readonly<{
  contexte: string;
  premierPlan: string;
  arrierePlan: string;
  /** Seuil abaisse a 3:1 : texte large, ou bordure porteuse de sens. */
  grand?: boolean;
}>;

export type Reglages = Readonly<{
  paires: readonly Paire[];
  /** Couleurs imposees par les donnees, hors feuille de style. */
  couleursExternes: ReadonlyArray<readonly [string, string]>;
  /** Token de la couleur portee sur ces couleurs externes. */
  surCouleursExternes: string;
  /**
   * La rampe de difficulte, du plus clair au plus sombre.
   *
   * `info` n'y figure PAS : ce n'est pas un cran. Mesure sur le dataset, 18
   * rooms sur 714 soit 2,5 %, contre 364 easy et 262 medium. Placer `info` a une
   * extremite de la rampe reviendrait a affirmer visuellement qu'une room
   * d'information est plus facile qu'une `easy`. Elle est d'une autre nature,
   * et c'est justement celle qu'un debutant doit reperer comme « lecture, pas
   * exercice ». Son contour la distingue, pas sa place dans une echelle.
   */
  rampe: readonly string[];
  /**
   * Tokens peints en `background` qui sont des MARQUES, pas des arriere-plans.
   *
   * Le trait du parcours est un fond de deux pixels de large, c'est-a-dire une
   * marque posee sur la page. Tout autre token employe en fond doit etre declare
   * comme arriere-plan d'une paire : sans cette exigence, peindre `--texte` en
   * fond et poser `--fond` dessus passerait le controle sans qu'aucune paire ne
   * mesure quoi que ce soit.
   */
  marques: readonly string[];
  seuilTexte: number;
  seuilGrand: number;
  seuilGris: number;
}>;

export type Rapport = Readonly<{
  mesures: ReadonlyArray<{ contexte: string; ratio: number; seuil: number; passe: boolean }>;
  externes: ReadonlyArray<{ nom: string; couleur: string; ratio: number; passe: boolean }>;
  clartes: ReadonlyArray<{ nom: string; clarte: number }>;
  ecartMinimal: number;
  litteraux: readonly Litteral[];
  echecs: readonly string[];
}>;

export function analyser(
  css: string,
  reglages: Reglages,
  fichiersComposants: ReadonlyArray<{ chemin: string; contenu: string }> = [],
): Rapport {
  const tokens = lireTokens(css);
  const echecs: string[] = [];

  const resoudre = (nom: string): Rgb => {
    const valeur = tokens.get(nom);
    if (valeur === undefined) throw new Error(`Token absent de :root : ${nom}`);
    return parseHex(valeur);
  };

  // 1. paires declarees
  const mesures = reglages.paires.map((paire) => {
    const seuil = paire.grand === true ? reglages.seuilGrand : reglages.seuilTexte;
    const mesure = ratio(resoudre(paire.premierPlan), resoudre(paire.arrierePlan));
    const passe = mesure >= seuil;
    if (!passe) {
      echecs.push(
        `${paire.contexte} : ${mesure.toFixed(2)}:1, seuil ${seuil}:1 ` +
          `(${paire.premierPlan} sur ${paire.arrierePlan})`,
      );
    }
    return { contexte: paire.contexte, ratio: mesure, seuil, passe };
  });

  // 2. couleurs imposees par les donnees
  const surExterne = resoudre(reglages.surCouleursExternes);
  const externes = reglages.couleursExternes.map(([nom, couleur]) => {
    const mesure = ratio(surExterne, parseHex(couleur));
    const passe = mesure >= reglages.seuilTexte;
    if (!passe) {
      echecs.push(`${nom} : ${mesure.toFixed(2)}:1 sur ${couleur}, seuil ${reglages.seuilTexte}:1`);
    }
    return { nom, couleur, ratio: mesure, passe };
  });

  // 3. la rampe reste une rampe en niveaux de gris
  const clartes = reglages.rampe.map((nom) => ({ nom, clarte: clartePercue(resoudre(nom)) }));
  let ecartMinimal = Number.POSITIVE_INFINITY;
  for (const [index, gauche] of clartes.entries()) {
    const droite = clartes[index + 1];
    if (droite === undefined) continue;
    const ecart = gauche.clarte - droite.clarte;
    ecartMinimal = Math.min(ecartMinimal, Math.abs(ecart));
    if (ecart <= 0) {
      echecs.push(
        `la rampe n'est plus monotone entre ${gauche.nom} et ${droite.nom} : ` +
          `${gauche.clarte.toFixed(1)} puis ${droite.clarte.toFixed(1)}`,
      );
    } else if (ecart < reglages.seuilGris) {
      echecs.push(
        `${gauche.nom} et ${droite.nom} se confondent en niveaux de gris : ` +
          `ecart de clarte ${ecart.toFixed(1)}, minimum ${reglages.seuilGris}`,
      );
    }
  }

  // 4. aucun token n'echappe a la mesure
  const emplois = lireEmplois(css);
  // Le token porte sur les couleurs imposees est mesure au controle 2, contre
  // ces couleurs-la. Lui inventer une paire contre un fond de la feuille
  // donnerait un ratio vrai et sans rapport avec ce qu'on voit a l'ecran.
  const declaresPartout = new Set([
    ...reglages.paires.flatMap((p) => [p.premierPlan, p.arrierePlan]),
    reglages.surCouleursExternes,
  ]);
  const declaresFond = new Set([...reglages.paires.map((p) => p.arrierePlan), ...reglages.marques]);

  for (const token of [...emplois.premierPlan].sort()) {
    if (!tokens.has(token)) continue;
    if (!declaresPartout.has(token)) {
      echecs.push(`${token} est employe comme \`color:\` mais n'est mesure par aucune paire`);
    }
  }
  for (const token of [...emplois.arrierePlan].sort()) {
    if (!tokens.has(token)) continue;
    if (!declaresFond.has(token)) {
      echecs.push(`${token} est peint en fond sans qu'aucune paire ne mesure ce qui s'y pose`);
    }
  }

  // 5. aucune couleur litterale hors du bloc de tokens
  const litteraux = trouverLitteraux([
    { chemin: "styles.css", contenu: css },
    ...fichiersComposants,
  ]);
  for (const litteral of litteraux) {
    echecs.push(
      `couleur ecrite en clair : ${litteral.texte} (${litteral.fichier}:${litteral.ligne})`,
    );
  }

  return { mesures, externes, clartes, ecartMinimal, litteraux, echecs };
}
