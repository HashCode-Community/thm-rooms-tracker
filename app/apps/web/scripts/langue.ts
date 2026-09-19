/**
 * Controle de la langue affichee : accents et adresse au lecteur.
 *
 * DEUX DEFAUTS, LA MEME CAUSE. Un texte ecrit sans ses accents et un texte qui
 * tutoie alors que le reste vouvoie viennent tous deux de la meme chose : le
 * texte affiche est ecrit a plusieurs endroits, par plusieurs mains, et
 * personne ne relit l'ensemble. Un controle le fait a chaque `pnpm lint`.
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
  // Les libelles servis par la base : ils manquaient a la liste, donc le
  // controle serait reste muet meme apres avoir recu le bon perimetre.
  "intermediaire",
  "extreme",
  "defi",
  "defis",
  "defensive",
  "detaille",
  "detail",
  // Trouve a la main dans « Enregistree dans ce navigateur » : le controle
  // etait muet dessus, la liste ne connaissait pas le mot. « enregistre » n'y
  // est PAS : « le serveur enregistre » est un present de l'indicatif
  // parfaitement accentue, et un controle qui crie dessus finit desactive.
  "enregistree",
  "enregistrees",
  "methode",
  "methodes",
];

/**
 * Marques du tutoiement.
 *
 * Le produit VOUVOIE, partout, y compris dans le contenu editorial des
 * parcours. Ce n'est pas une preference de style : un site qui vouvoie sur
 * l'accueil et tutoie dans les parcours parle de deux voix, et le lecteur
 * l'entend meme s'il ne sait pas le nommer.
 *
 * Seuls les PRONOMS et POSSESSIFS sont listes. Les imperatifs (« prevois »,
 * « choisis ») ne le sont pas : leur forme est trop proche d'autres personnes
 * pour etre reconnue sans analyser la phrase, et un controle qui se trompe est
 * un controle qu'on desactive.
 */
export const MARQUES_TUTOIEMENT: readonly string[] = [
  "tu",
  "te",
  "toi",
  "ton",
  "ta",
  "tes",
  "tien",
  "tienne",
  "tiens",
  "tiennes",
];

const MOTIF_TUTOIEMENT = new RegExp(
  `(?<![A-Za-zÀ-ÿ'])(${MARQUES_TUTOIEMENT.join("|")})(?![A-Za-zÀ-ÿ])`,
  "gi",
);

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
  // UN LIBELLE PEUT TENIR EN UN MOT. « Intermediaire » et « Extreme » sont des
  // libelles affiches ; exiger une espace les laissait passer, et c'est
  // exactement ce qui s'est produit. Un mot seul compte s'il a la forme d'un
  // libelle : une capitale puis des minuscules, ou tout en capitales. Les
  // identifiants du depot sont en camelCase ou en PascalCase, donc porteurs
  // d'une capitale interne, et restent ecartes.
  if (!texte.includes(" ") && !/^([A-ZÀ-Þ][a-zà-ÿ]{3,}|[A-ZÀ-Þ]{4,})$/.test(texte)) return false;
  if (texte.includes("/")) return false;
  if (texte.includes("__") || texte.includes("--")) return false;
  if (/[;,{(=]$/.test(texte)) return false;
  if (/^[A-Za-z_$][A-Za-z0-9_$]*\s*[:(<]/.test(texte)) return false;
  // Une prose francaise porte des apostrophes ET des deux-points : « ATTENTION :
  // l'introduction n'est pas gratuite ». La regle qui les rejetait ensemble
  // faisait taire le controle sur une note entiere, tutoiement compris. Ce qui
  // ecarte le code est la FORME d'une affectation, testee juste au-dessus.
  if (/^[A-Za-z_$][A-Za-z0-9_$]*\s*=/.test(texte)) return false;
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

/**
 * Les marques de tutoiement d'un texte.
 *
 * `t'` est exclu de la liste et traite ici : `t'attire` tutoie, mais la meme
 * apostrophe suit aussi des mots qui ne tutoient pas. On ne signale donc que la
 * forme elidee suivie d'une lettre, jamais l'apostrophe seule.
 */
export function marquesTutoiement(texte: string): string[] {
  const sansCode = texte.replace(/\${[^}]*}/g, " ");
  const trouves = [...sansCode.matchAll(MOTIF_TUTOIEMENT)].map((trouve) => trouve[0]);
  const elide = /(?<![A-Za-zÀ-ÿ])t'[a-zà-ÿ]/gi;
  for (const trouve of sansCode.matchAll(elide)) trouves.push(trouve[0]);
  return trouves;
}

export type Signalement = {
  ligne: number;
  texte: string;
  formes: string[];
  /** Ce que le signalement reproche au texte. */
  genre: "accent" | "tutoiement";
};

/** Analyse un fichier source et renvoie ses signalements. */
export function analyser(source: string): Signalement[] {
  const signalements: Signalement[] = [];
  for (const candidat of textesAffiches(source)) {
    const texte = candidat.texte.trim();
    const formes = formesTrouvees(candidat.texte);
    if (formes.length > 0) {
      signalements.push({ ligne: candidat.ligne, texte, formes, genre: "accent" });
    }
    const marques = marquesTutoiement(candidat.texte);
    if (marques.length > 0) {
      signalements.push({ ligne: candidat.ligne, texte, formes: marques, genre: "tutoiement" });
    }
  }
  return signalements;
}

/**
 * Les textes d'un fichier YAML de parcours.
 *
 * Le contenu editorial n'est pas dans le code : il vit dans `data/roadmap`,
 * passe par le semis, puis par la base, puis par l'API. C'est le dernier
 * endroit ou le controle regardait — donc celui ou le tutoiement a survecu a
 * toute la refonte.
 *
 * LES CHAINES CITEES D'ABORD. Une ligne YAML de ce depot vaut souvent
 * `- { code: x, requirement: optional, note: "..." }` : prise entiere, elle
 * porte des deux-points et des guillemets, donc les regles d'exclusion la
 * jetaient comme du code. Le tutoiement d'une note y a survecu a la premiere
 * version de ce controle, et c'est en lisant les donnees que je l'ai vu, pas en
 * lisant le vert du controle. On extrait donc les chaines citees, et on ne
 * retombe sur le reste de la ligne que lorsqu'il n'y en a aucune.
 */
export function analyserYaml(source: string): Signalement[] {
  const signalements: Signalement[] = [];

  source.split("\n").forEach((ligne, index) => {
    const citees = [...ligne.matchAll(/"([^"\n]*)"|'([^'\n]*)'/g)].map(
      (trouve) => trouve[1] ?? trouve[2] ?? "",
    );
    const candidats =
      citees.length > 0 ? citees : [/^\s*(?:-\s*)?(?:[a-z_]+:\s*)?(.*)$/i.exec(ligne)?.[1] ?? ""];

    for (const valeur of candidats) {
      if (!estAffichable(valeur)) continue;
      const texte = valeur.trim();
      const formes = formesTrouvees(valeur);
      if (formes.length > 0) {
        signalements.push({ ligne: index + 1, texte, formes, genre: "accent" });
      }
      const marques = marquesTutoiement(valeur);
      if (marques.length > 0) {
        signalements.push({ ligne: index + 1, texte, formes: marques, genre: "tutoiement" });
      }
    }
  });

  return signalements;
}
