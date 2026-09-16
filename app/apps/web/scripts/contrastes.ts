/**
 * Analyse de la couleur : contrastes, clarte percue, litteraux.
 *
 * Separe du script en ligne de commande pour etre TESTABLE. Un garde qu'on ne
 * peut exercer que sur le depot reel ne se verifie qu'en cassant le depot reel ;
 * ici, un test lui donne une feuille de style fabriquee et exige qu'il tombe.
 */

// --- Couleur ---------------------------------------------------------------

export type Rgb = readonly [number, number, number];
/** Une couleur avec son canal alpha, dans [0, 1]. */
export type Rgba = readonly [number, number, number, number];

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

/**
 * Lit les deux ecritures employees par la charte : `#hex` et `rgb(r g b / a)`.
 *
 * LA TRANSPARENCE N'EST PAS UN DETAIL D'ECRITURE. Les fonds de difficulte sont
 * a 12 % et les bordures a 25 % : mesurer la couleur pleine a leur place
 * donnerait un ratio qui n'existe nulle part a l'ecran. Elle est donc lue, puis
 * aplatie sur le fond reel avant toute mesure.
 */
export function parseCouleur(valeur: string): Rgba {
  const texte = valeur.trim();
  if (texte.startsWith("#")) {
    const [r, v, b] = parseHex(texte);
    return [r, v, b, 1];
  }
  const fonction = /^rgba?\(([^)]+)\)$/.exec(texte);
  if (fonction?.[1] === undefined) throw new Error(`Couleur illisible : ${valeur}`);
  const morceaux = fonction[1].split("/");
  const canaux = (morceaux[0] ?? "")
    .trim()
    .split(/[\s,]+/)
    .filter((part) => part !== "")
    .map(Number);
  const alpha = morceaux[1] === undefined ? 1 : Number(morceaux[1].trim());
  const [r, v, b] = canaux;
  if (r === undefined || v === undefined || b === undefined || canaux.some(Number.isNaN)) {
    throw new Error(`Couleur illisible : ${valeur}`);
  }
  return [r, v, b, Number.isNaN(alpha) ? 1 : alpha];
}

/** Pose une couleur translucide sur un fond opaque et rend le resultat visible. */
export function aplatir(couleur: Rgba, fond: Rgb): Rgb {
  const [r, v, b, a] = couleur;
  if (a >= 1) return [r, v, b];
  return [
    Math.round(r * a + fond[0] * (1 - a)),
    Math.round(v * a + fond[1] * (1 - a)),
    Math.round(b * a + fond[2] * (1 - a)),
  ];
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

/**
 * Tokens declares dans UN bloc, designe par son selecteur.
 *
 * La valeur est gardee TELLE QUELLE, y compris quand c'est un `var(--autre)` :
 * la feuille a deux etages, la charte et les roles, et c'est la chaine complete
 * qui dit quelle couleur est reellement peinte. `resoudreCouleur` la suit.
 */
export function lireTokensDuBloc(css: string, selecteur: string): Map<string, string> {
  const debut = css.indexOf(`${selecteur} {`);
  if (debut < 0) throw new Error(`Bloc introuvable : ${selecteur}`);

  // Fin du bloc : la premiere accolade fermante en debut de ligne a partir du
  // selecteur. Les declarations sont toutes indentees, donc sans ambiguite.
  const lignes = sansCommentaires(css.slice(debut)).split("\n");
  const tokens = new Map<string, string>();
  for (const ligne of lignes.slice(1)) {
    if (/^\s{0,2}\}/.test(ligne)) break;
    const trouve = /^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/.exec(ligne);
    if (trouve?.[1] !== undefined && trouve[2] !== undefined) {
      tokens.set(trouve[1], trouve[2].trim());
    }
  }
  if (tokens.size === 0) throw new Error(`Aucun token dans ${selecteur}`);
  return tokens;
}

/** La palette de la feuille, c'est-a-dire le bloc `:root`. */
export function lireTokens(css: string): Map<string, string> {
  return lireTokensDuBloc(css, ":root");
}

/**
 * Suit la chaine de `var()` jusqu'a une couleur ecrite.
 *
 * Un jeton de role pointe sur un jeton de charte, qui porte la valeur. Sans
 * cette resolution, le controleur ne mesurerait que des noms — et un role
 * branche sur le mauvais jeton passerait sans bruit.
 */
export function resoudreCouleur(tokens: ReadonlyMap<string, string>, nom: string): Rgba {
  let valeur = tokens.get(nom);
  if (valeur === undefined) throw new Error(`Token absent de la palette : ${nom}`);

  for (let saut = 0; saut < 8; saut += 1) {
    const reference = /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(valeur);
    if (reference?.[1] === undefined) return parseCouleur(valeur);
    const suivante = tokens.get(reference[1]);
    if (suivante === undefined) {
      throw new Error(`${nom} renvoie a ${reference[1]}, qui n'existe pas`);
    }
    valeur = suivante;
  }
  throw new Error(`Chaine de var() trop profonde depuis ${nom}`);
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
 * Couleurs ecrites en clair ailleurs que dans une declaration de token.
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
    const lignes = sansCommentaires(contenu).split("\n");

    for (const [index, ligne] of lignes.entries()) {
      // UNE DECLARATION DE TOKEN EST LE SEUL ENDROIT LEGITIME, ou qu'elle soit.
      //
      // Ce qui compte n'a jamais ete l'endroit mais la FORME : une couleur
      // nommee est declaree, une couleur anonyme est un litteral. La regle
      // couvre donc toutes les ecritures d'une valeur de token — `#hex` comme
      // `rgb(r g b / a)`, que la charte emploie pour ses fonds a 12 %.
      if (/^\s*--[a-z0-9-]+\s*:/.test(ligne)) continue;

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
  /**
   * Fond opaque sous un arriere-plan translucide.
   *
   * Un badge de difficulte pose son fond a 12 % sur une carte, qui est elle-meme
   * posee sur la page. Sans ce troisieme terme, la mesure porterait sur une
   * couleur qui ne s'affiche nulle part.
   */
  base?: string;
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
   * Opacite a laquelle ces couleurs sont reellement peintes, et fond qui les
   * recoit. Les badges d'equipe suivent l'idiome de la charte : teinte a 12 %
   * sur la carte, libelle en blanc. Mesurer le blanc sur la couleur PLEINE
   * donnerait un ratio qui ne s'affiche plus nulle part.
   */
  opaciteExterne: number;
  fondExterne: string;
  /**
   * Teintes dont la clarte percue est RAPPORTEE, sans condition de reussite.
   *
   * Le controle exigeait avant que les cinq crans de difficulte forment une
   * rampe monotone en L*, pour rester separables en niveaux de gris. La charte
   * les code desormais par la TEINTE : cyan, ambre, orange, rouge. Cette
   * exigence tomberait a chaque execution, et la faire tomber reviendrait a
   * refuser la charte.
   *
   * Ce qui garantit la lisibilite sans la couleur n'est donc plus l'ecart de
   * clarte mais le LIBELLE, ecrit en toutes lettres sur chaque badge — c'est ce
   * que demande WCAG 1.4.1, l'ecart de gris etait un supplement. Les clartes
   * restent mesurees et affichees : la perte doit se voir, pas disparaitre avec
   * le controle qui la mesurait.
   */
  teintes: readonly string[];
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
}>;

export type Rapport = Readonly<{
  mesures: ReadonlyArray<{ contexte: string; ratio: number; seuil: number; passe: boolean }>;
  externes: ReadonlyArray<{ nom: string; couleur: string; ratio: number; passe: boolean }>;
  clartes: ReadonlyArray<{ nom: string; clarte: number }>;
  litteraux: readonly Litteral[];
  echecs: readonly string[];
}>;

/**
 * `theme-color` doit dire la meme chose que `--fond`.
 *
 * La balise colore la barre d'adresse du navigateur mobile, AVANT que la
 * feuille de style arrive : elle ne peut donc pas employer `var(--fond)`, elle
 * porte la valeur en clair. Deux ecritures de la meme couleur derivent, et
 * celle-ci deriverait en silence — personne ne relit un `<head>`. On les
 * compare.
 *
 * Une seule balise depuis que le theme est unique : celle qui portait
 * `prefers-color-scheme: light` n'a plus de theme a decrire.
 */
export function verifierThemeColor(html: string, fond: string): string | null {
  // `String.raw` : dans un gabarit ordinaire, `\s` n'est pas une sequence
  // d'echappement valide et se reduit a `s`. Le motif ne correspondrait alors
  // jamais, et le garde se tairait — exactement ce qu'un garde ne doit pas faire.
  const motif = /<meta\s+name="theme-color"\s+content="(#[0-9a-fA-F]{3,8})"\s*\/?>/;
  const trouve = motif.exec(html);
  if (trouve?.[1] === undefined) {
    return "index.html ne declare pas de `theme-color` : la barre d'adresse mobile ne suivra pas la page";
  }
  const declare = trouve[1].toLowerCase();
  if (declare !== fond.toLowerCase()) {
    return `theme-color vaut ${declare} alors que --fond vaut ${fond}`;
  }
  return null;
}

export function analyser(
  css: string,
  reglages: Reglages,
  fichiersComposants: ReadonlyArray<{ chemin: string; contenu: string }> = [],
  tokens: ReadonlyMap<string, string> = lireTokens(css),
): Rapport {
  const echecs: string[] = [];

  /** La couleur peinte a l'ecran : chaine de `var()` suivie, alpha aplati. */
  const peinte = (nom: string, sous: string): Rgb => {
    const base = aplatir(resoudreCouleur(tokens, sous), [0, 0, 0]);
    return aplatir(resoudreCouleur(tokens, nom), base);
  };

  // 1. paires declarees
  const mesures = reglages.paires.map((paire) => {
    const seuil = paire.grand === true ? reglages.seuilGrand : reglages.seuilTexte;
    const base = paire.base ?? "--fond";
    const fond = peinte(paire.arrierePlan, base);
    const avant = aplatir(resoudreCouleur(tokens, paire.premierPlan), fond);
    const mesure = ratio(avant, fond);
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
  const fondExterne = aplatir(resoudreCouleur(tokens, reglages.fondExterne), [0, 0, 0]);
  const surExterne = aplatir(resoudreCouleur(tokens, reglages.surCouleursExternes), fondExterne);
  const externes = reglages.couleursExternes.map(([nom, couleur]) => {
    const [r, v, b] = parseHex(couleur);
    const teinte = aplatir([r, v, b, reglages.opaciteExterne], fondExterne);
    const mesure = ratio(surExterne, teinte);
    const passe = mesure >= reglages.seuilTexte;
    if (!passe) {
      echecs.push(`${nom} : ${mesure.toFixed(2)}:1 sur ${couleur}, seuil ${reglages.seuilTexte}:1`);
    }
    return { nom, couleur, ratio: mesure, passe };
  });

  // 3. clartes percues, rapportees sans condition (voir `teintes`)
  const clartes = reglages.teintes.map((nom) => ({
    nom,
    clarte: clartePercue(aplatir(resoudreCouleur(tokens, nom), [0, 0, 0])),
  }));

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

  // 5. aucune couleur litterale hors d'une declaration de token
  const litteraux = trouverLitteraux([
    { chemin: "styles.css", contenu: css },
    ...fichiersComposants,
  ]);
  for (const litteral of litteraux) {
    echecs.push(
      `couleur ecrite en clair : ${litteral.texte} (${litteral.fichier}:${litteral.ligne})`,
    );
  }

  return { mesures, externes, clartes, litteraux, echecs };
}
