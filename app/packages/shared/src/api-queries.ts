import { z } from "zod";
import { DIFFICULTIES, ROOM_TYPES, TEAMS } from "./dataset.js";

/**
 * Schemas d'entree du catalogue.
 *
 * SEMANTIQUE DES FILTRES, une fois pour toutes :
 *
 *   OU a l'interieur d'une facette   -> `tech=linux&tech=windows` = Linux OU Windows
 *   ET entre facettes                -> `tech=linux&tool=nmap`    = Linux ET Nmap
 *
 * C'est la seule combinaison qui se comporte comme un utilisateur l'attend :
 * cocher une deuxieme case dans la MEME liste elargit le resultat, cocher une case
 * dans une AUTRE liste le restreint.
 *
 * BORNES D'ENTREE : toutes les valeurs sont bornees, y compris celles qui
 * paraissent inoffensives. Une liste de filtres non bornee, c'est un `IN (...)` de
 * dix mille elements construit par un inconnu ; un `q` non borne, c'est un
 * `websearch_to_tsquery` sur un megaoctet. Le cout du garde est nul, celui de son
 * absence ne l'est pas.
 */

/** Nombre maximal de valeurs pour UNE facette. Borne la taille des listes `IN`. */
export const MAX_FILTER_VALUES = 25;
/** Longueur maximale du terme de recherche. */
export const MAX_QUERY_LENGTH = 200;
export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 24;
/** 714 rooms, limite maxi 100 : au-dela, l'offset ne designe plus rien. */
export const MAX_PAGE = 1000;
export const MAX_DURATION_MINUTES = 100_000;

export const SORT_KEYS = ["popular", "recent", "shortest", "longest", "az", "difficulty"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

/**
 * Accepte `?tech=a&tech=b` comme `?tech[]=a&tech[]=b` (cf. `parseQueryString`) et
 * la valeur unique `?tech=a`. L'union est declaree AVANT la transformation : c'est
 * elle qui part dans l'OpenAPI, donc la documentation montre reellement les deux
 * formes acceptees.
 */
function multiValue<Out, In>(item: z.ZodType<Out, In>) {
  return z
    .union([item, z.array(item).max(MAX_FILTER_VALUES)])
    .transform((value): Out[] => (Array.isArray(value) ? value : [value]))
    .optional();
}

/**
 * Forme d'un slug de tag ou de categorie : exactement ce que produit `slugify`.
 * Un slug inconnu n'est PAS une erreur — il donne zero resultat, ce qui est la
 * reponse juste. Seule une forme impossible est rejetee.
 */
const SlugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug attendu : minuscules, chiffres et tirets");

/**
 * Les cles d'equipe portent une majuscule en base (`Red`, `Blue`, `Purple`) parce
 * que c'est la valeur du dataset. On accepte n'importe quelle casse EN ENTREE et on
 * replie vers la cle canonique.
 *
 * Ce n'est pas la meme situation que `rooms.code` (ADR-0001 Q1) : ici la casse ne
 * porte aucune information et ne part dans aucune URL sortante. Replier un `code`
 * casserait un lien vers TryHackMe ; replier `red` en `Red` ne casse rien.
 */
const TeamKeySchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.enum(["red", "blue", "purple"]))
  .transform((value) => TEAMS.find((team) => team.toLowerCase() === value) ?? "Red");

const PositiveInt = (max: number) => z.coerce.number().int().min(0).max(max);

/** Filtres partages entre `/api/rooms` et `/api/facets`. */
export const RoomFiltersSchema = z.object({
  q: z.string().trim().min(1).max(MAX_QUERY_LENGTH).optional(),
  difficulty: multiValue(z.enum(DIFFICULTIES)),
  type: multiValue(z.enum(ROOM_TYPES)),
  team: multiValue(TeamKeySchema),
  tech: multiValue(SlugSchema),
  tool: multiValue(SlugSchema),
  skill: multiValue(SlugSchema),
  category: SlugSchema.optional(),
  durationMin: PositiveInt(MAX_DURATION_MINUTES).optional(),
  durationMax: PositiveInt(MAX_DURATION_MINUTES).optional(),
});

/** Le domaine des filtres, deja valide et normalise. */
export type RoomFilters = z.infer<typeof RoomFiltersSchema>;

/** Les cles de facette, c'est-a-dire les filtres qu'un comptage peut omettre. */
export const FACET_KEYS = ["difficulty", "type", "team", "tech", "tool", "skill"] as const;
export type FacetKey = (typeof FACET_KEYS)[number];

const DURATION_ORDER_MESSAGE = "durationMin doit etre inferieur ou egal a durationMax.";

function checkDurationOrder(value: {
  durationMin?: number | undefined;
  durationMax?: number | undefined;
}): boolean {
  if (value.durationMin === undefined || value.durationMax === undefined) return true;
  return value.durationMin <= value.durationMax;
}

/**
 * Les trois parametres de presentation, definis UNE fois. Deux assemblages les
 * utilisent, avec des valeurs par defaut a des endroits differents.
 */
export const SortSchema = z.enum(SORT_KEYS);
export const PageSchema = z.coerce.number().int().min(1).max(MAX_PAGE);
export const LimitSchema = z.coerce.number().int().min(1).max(MAX_LIMIT);

export const DEFAULT_SORT: SortKey = "popular";

/**
 * Cote SERVEUR : les valeurs par defaut sont appliquees, un gestionnaire recoit
 * toujours `sort`, `page` et `limit` renseignes.
 */
export const RoomListQuerySchema = RoomFiltersSchema.extend({
  sort: SortSchema.default(DEFAULT_SORT),
  page: PageSchema.default(1),
  limit: LimitSchema.default(DEFAULT_LIMIT),
}).refine(checkDurationOrder, { message: DURATION_ORDER_MESSAGE, path: ["durationMin"] });

/**
 * Cote CLIENT : les memes bornes, mais les trois parametres restent OPTIONNELS.
 *
 * Ce n'est pas un detail cosmetique. Si le front validait avec le schema serveur,
 * `sort`, `page` et `limit` seraient toujours definis, donc toujours serialises,
 * et chaque lien du site porterait `?sort=popular&page=1&limit=24`. Une URL
 * partagee doit contenir ce que l'utilisateur a choisi, rien d'autre.
 *
 * L'absence est sans consequence : le serveur applique exactement les memes
 * valeurs par defaut, avec exactement les memes bornes — elles sont ci-dessus,
 * ecrites une seule fois.
 */
export const RoomSearchSchema = RoomFiltersSchema.extend({
  sort: SortSchema.optional(),
  page: PageSchema.optional(),
  limit: LimitSchema.optional(),
}).refine(checkDurationOrder, { message: DURATION_ORDER_MESSAGE, path: ["durationMin"] });

export const FacetQuerySchema = RoomFiltersSchema.refine(checkDurationOrder, {
  message: DURATION_ORDER_MESSAGE,
  path: ["durationMin"],
});

export const TagQuerySchema = z.object({
  kind: z.enum(["technology", "tool", "skill"]).optional(),
});

/**
 * `rooms.code` : casse PRESERVEE, jamais repliee (ADR-0001 Q1).
 * Le motif reprend la verification du jeu de tests : les 714 codes du dataset sont
 * tous dans `[A-Za-z0-9._~-]`.
 */
export const RoomCodeSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9._~-]+$/, "code de room invalide");

export const RoomCodeParamsSchema = z.object({
  code: RoomCodeSchema,
});

/**
 * Nombre maximal de codes acceptes par `/api/rooms/batch`.
 *
 * 200 et pas 25 comme les filtres : ce n'est pas un filtre, c'est la
 * progression d'une personne, et elle peut legitimement depasser les 61 rooms
 * des trois parcours. 200 bornes la requete sans brider un usage reel ; au-dela,
 * c'est 400, pas une troncature silencieuse.
 */
export const MAX_BATCH_CODES = 200;

/**
 * `GET /api/rooms/batch?code=a&code=b`.
 *
 * Parametre REPETE, jamais `code[]` : `parseQueryString` accepte les deux, mais
 * la forme repetee est celle que produit `URLSearchParams` sans configuration
 * particuliere. Ne rien faire dependre du reglage d'un analyseur.
 *
 * L'union accepte aussi la valeur unique, parce qu'un seul `?code=a` n'est pas
 * un tableau apres analyse.
 */
export const RoomBatchQuerySchema = z.object({
  code: z
    .union([RoomCodeSchema, z.array(RoomCodeSchema).min(1).max(MAX_BATCH_CODES)])
    .transform((value): string[] => (Array.isArray(value) ? value : [value])),
});
