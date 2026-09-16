/**
 * Detection des textes francais affiches sans leurs accents.
 *
 * POURQUOI UN CONTROLE ET PAS UNE RELECTURE. La passe d'accentuation a laisse
 * des restes trois fois de suite : la premiere fois sur des paragraphes JSX
 * repartis sur plusieurs lignes, que la recherche par litteral ne voyait pas ;
 * la deuxieme sur des messages d'erreur, qui ne s'affichent que si l'API tombe ;
 * la troisieme dans `packages/shared`, ou personne ne cherchait du texte
 * d'interface. Une relecture qui echoue trois fois n'est pas une methode.
 *
 * CE QUE CE CONTROLE NE FAIT PAS. Il ne connait pas le francais : il compare a
 * une LISTE de formes non accentuees frequentes. Un mot hors liste passe. C'est
 * un filet, pas une preuve — et il est dimensionne pour attraper exactement la
 * classe de defaut qui s'est produite, pas toutes les fautes possibles.
 *
 * La logique vit ici, separee du script qui parcourt les fichiers, pour etre
 * exercable par un test sans casser le depot reel.
 */

/**
 * Formes non accentuees a signaler.
 *
 * Deux exclusions volontaires :
 *  - les mots qui servent aussi d'identifiants ou de classes CSS dans ce depot
 *    (`etat`, `cle`, `theme`, `etape`...), que le filtrage ne distingue pas
 *    toujours d'un texte ;
 *  - « a », dont la forme sans accent est un verbe francais parfaitement
 *    valide. Impossible a trancher sans analyser la phrase.
 */
export const FORMES_SANS_ACCENT: readonly string[] = [
  "publie",
  "publiee",
  "publiees",
  "publies",
  "termine",
  "terminee",
  "terminees",
  "termines",
  "resultat",
  "resultats",
  "duree",
  "durees",
  "frequentation",
  "editorial",
  "editoriale",
  "deduisent",
  "deduit",
  "creation",
  "anciennete",
  "elargir",
  "tolerant",
  "meme",
  "memes",
  "deja",
  "tres",
  "apres",
  "etre",
  "prerequis",
  "difficulte",
  "difficultes",
  "competence",
  "competences",
  "reference",
  "references",
  "requete",
  "requetes",
  "parametre",
  "parametres",
  "probleme",
  "problemes",
  "modele",
  "modeles",
  "annee",
  "annees",
  "premiere",
  "premieres",
  "derniere",
  "dernieres",
  "verifie",
  "verifiee",
  "selectionne",
  "integre",
  "operation",
  "operations",
  "numero",
  "reussi",
  "reussie",
  "echec",
  "precedente",
  "generale",
  "matiere",
  "maniere",
  "acces",
  "succes",
  "progres",
  "generes",
  "genere",
  "pedagogique",
  "donnee",
  "donnees",
  "reponse",
  "reponses",
  "affichee",
  "affichees",
  "ecrit",
  "ecrite",
  "ecrits",
  "arretee",
  "repond",
];

const MOTIF = new RegExp(`(?<![A-Za-zÀ-ÿ])(${FORMES_SANS_ACCENT.join("|")})(?![A-Za-zÀ-ÿ])`, "gi");

/**
 * Blanchit les commentaires en gardant les numeros de ligne.
 *
 * Les commentaires de ce depot sont ECRITS SANS ACCENTS, par convention : les
 * inclure ferait du controle un generateur de bruit, et un controle bruyant
 * finit desactive.
 */
export function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, " "))
    .replace(
      /(^|[^:])\/\/[^\n]*/g,
      (tout, avant: string) => avant + " ".repeat(tout.length - avant.length),
    );
}

/** Un texte candidat, avec la ligne ou il se trouve. */
export type Candidat = { ligne: number; texte: string };

/**
 * Les textes SUSCEPTIBLES d'etre affiches : litteraux de chaine et texte JSX.
 *
 * Le texte JSX est reconnu de deux facons, parce qu'une seule ne suffisait pas :
 * entre deux balises sur la meme ligne, et en ligne entiere de prose au milieu
 * d'un element. C'est cette seconde forme que la recherche par litteral avait
 * manquee la premiere fois.
 */
export function textesAffiches(source: string): Candidat[] {
  const trouves: Candidat[] = [];
  const lignes = sansCommentaires(source).split("\n");

  lignes.forEach((ligne, index) => {
    for (const trouve of ligne.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`\n]*)`/g)) {
      trouves.push({ ligne: index + 1, texte: trouve[1] ?? trouve[2] ?? trouve[3] ?? "" });
    }
    for (const trouve of ligne.matchAll(/>([^<>{}]+)</g)) {
      trouves.push({ ligne: index + 1, texte: trouve[1] ?? "" });
    }
    if (estProse(ligne)) trouves.push({ ligne: index + 1, texte: ligne.trim() });
  });

  return trouves.filter((candidat) => estAffichable(candidat.texte));
}

function estProse(ligne: string): boolean {
  if (!/^\s*[A-Za-zÀ-ÿ«»][^<>={}]*$/.test(ligne)) return false;
  return !/^\s*(import|export|const|let|var|return|type|interface)\b/.test(ligne);
}

/**
 * Ecarte ce qui n'est pas du texte d'interface.
 *
 * Les regles sont grossieres et assumees : un nom de classe, un chemin, une
 * ligne de code capturee par erreur. Chacune retire du bruit reel, mesure sur
 * ce depot — sans elles le controle sortait 55 lignes dont 48 fausses.
 */
export function estAffichable(brut: string): boolean {
  const texte = brut.trim();
  if (texte.length < 4) return false;
  if (!texte.includes(" ")) return false;
  if (texte.includes("/")) return false;
  if (texte.includes("__") || texte.includes("--")) return false;
  if (/[;,{(=]$/.test(texte)) return false;
  if (/^[A-Za-z_$][A-Za-z0-9_$]*\s*[:(<]/.test(texte)) return false;
  if (/["']/.test(texte) && /[=:]/.test(texte)) return false;
  return true;
}

/**
 * Les formes non accentuees d'un texte.
 *
 * Les interpolations sont retirees AVANT la comparaison : `${etape.title}`
 * contient un identifiant, pas du texte affiche.
 */
export function formesTrouvees(texte: string): string[] {
  const sansCode = texte.replace(/\$\{[^}]*\}/g, " ");
  return [...sansCode.matchAll(MOTIF)].map((trouve) => trouve[0]);
}

export type Signalement = { ligne: number; texte: string; formes: string[] };

/** Analyse un fichier source et renvoie ses signalements. */
export function analyser(source: string): Signalement[] {
  const signalements: Signalement[] = [];
  for (const candidat of textesAffiches(source)) {
    const formes = formesTrouvees(candidat.texte);
    if (formes.length > 0) {
      signalements.push({ ligne: candidat.ligne, texte: candidat.texte.trim(), formes });
    }
  }
  return signalements;
}
