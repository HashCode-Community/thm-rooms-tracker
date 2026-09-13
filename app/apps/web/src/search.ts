import {
  DEFAULT_LIMIT,
  DEFAULT_SORT,
  parseQueryString,
  type QueryValue,
  RoomSearchSchema,
  stringifyQueryString,
} from "@thm/shared";

/**
 * L'etat des filtres vit dans l'URL, et nulle part ailleurs.
 *
 * Consequence directe : une vue filtree est partageable telle quelle et le bouton
 * retour du navigateur fonctionne sans qu'on ait rien a ecrire. C'est structurel —
 * ca ne se rajoute pas apres coup, c'est pour ca que c'est ici avant le premier
 * composant.
 *
 * TanStack Router serialise par defaut les tableaux en JSON encode
 * (`?tech=%5B%22linux%22%5D`). On lui substitue la convention du projet, celle que
 * l'API comprend : cles repetees, `?tech=linux&tech=windows`. La barre d'adresse
 * et la requete HTTP ont alors exactement la meme syntaxe, et il n'y a aucune
 * traduction a maintenir entre les deux.
 */

/**
 * Valeurs qui ne changent rien et qu'on retire donc de l'URL.
 *
 * Sans ca, chaque lien porterait `?sort=popular&page=1&limit=24`. Le tour est
 * stable : ce qui est retire est exactement ce que le schema redonnera par defaut.
 */
const IMPLICIT_DEFAULTS = {
  sort: DEFAULT_SORT,
  page: 1,
  limit: DEFAULT_LIMIT,
} as const;

export function stringifySearch(search: Record<string, unknown>): string {
  return stringifyQueryString(search as Record<string, QueryValue>, IMPLICIT_DEFAULTS);
}

export function parseSearch(searchStr: string): Record<string, unknown> {
  return parseQueryString(searchStr.replace(/^\?/, ""));
}

/**
 * Valide les parametres d'URL avec les MEMES bornes que l'API.
 *
 * `RoomSearchSchema` et `RoomListQuerySchema` partagent leurs definitions de
 * champ (cf. `packages/shared/src/api-queries.ts`) ; seule differe la place des
 * valeurs par defaut. Une URL bricolee a la main est donc bornee ici exactement
 * comme elle le serait cote serveur.
 */
export type RoomSearch = ReturnType<typeof validateRoomSearch>;

export function validateRoomSearch(input: Record<string, unknown>) {
  const parsed = RoomSearchSchema.safeParse(input);
  if (parsed.success) return parsed.data;

  // Une URL invalide ne doit pas donner un ecran d'erreur : on retombe sur le
  // catalogue complet. L'utilisateur a peut-etre recu un lien tronque par un
  // client de messagerie, ce n'est pas a lui de le reparer.
  return RoomSearchSchema.parse({});
}

/** La chaine de requete a envoyer a l'API pour cette recherche. */
export function toApiQuery(search: Record<string, unknown>): string {
  return stringifyQueryString(search as Record<string, QueryValue>, {});
}

/** La chaine de requete des FACETTES : les memes filtres, sans tri ni pagination. */
export function toFacetQuery(search: Record<string, unknown>): string {
  const { sort: _sort, page: _page, limit: _limit, ...filters } = search;
  return stringifyQueryString(filters as Record<string, QueryValue>, {});
}
