import { z } from "zod";

/**
 * Schemas de SORTIE.
 *
 * Ils ne servent pas qu'a documenter : `fastify-type-provider-zod` serialise la
 * reponse A TRAVERS eux, et `z.object` retire les cles non declarees. C'est donc
 * la derniere barriere de la regle 2 de D5 (« `raw` n'est jamais expose par
 * l'API ») : meme si une requete ramenait la colonne par accident, elle ne
 * franchirait pas la serialisation.
 *
 * `rooms.id` n'apparait nulle part : l'identifiant public est `code`.
 */

export const TagRefSchema = z.object({
  slug: z.string(),
  name: z.string(),
});

export const RoomTagsSchema = z.object({
  technology: z.array(TagRefSchema),
  tool: z.array(TagRefSchema),
  skill: z.array(TagRefSchema),
});

export const TeamRefSchema = z.object({
  key: z.string(),
  label: z.string(),
  color: z.string(),
});

export const RoomSummarySchema = z.object({
  code: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  difficulty: z.object({ key: z.string(), label: z.string(), level: z.number().int() }),
  type: z.object({ key: z.string(), label: z.string() }),
  teams: z.array(TeamRefSchema),
  durationMinutes: z.number().int().nullable(),
  usersCount: z.number().int().nullable(),
  /** `date` PostgreSQL : jour calendaire, sans heure ni fuseau. */
  publishedAt: z.string().nullable(),
  thmUrl: z.string(),
  tags: RoomTagsSchema,
});

export const RoomDetailSchema = RoomSummarySchema.extend({
  isActive: z.boolean(),
  isFree: z.boolean(),
  categories: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      /** Origine de la categorisation, exposee volontairement (ADR-0001). */
      source: z.enum(["thm", "derived", "manual"]),
    }),
  ),
  /**
   * Etapes de parcours qui contiennent cette room. Vide tant que la phase 7 n'a
   * pas produit de contenu editorial : la roadmap ne se deduit d'aucune donnee
   * TryHackMe.
   */
  trackSteps: z.array(
    z.object({
      trackSlug: z.string(),
      trackTitle: z.string(),
      stepPosition: z.number().int(),
      stepTitle: z.string(),
      requirement: z.enum(["core", "optional", "bonus"]),
      note: z.string().nullable(),
    }),
  ),
});

/**
 * Forme BREVE d'une room, pour `/api/rooms/batch`.
 *
 * Volontairement plus pauvre que `RoomSummary` : ni description, ni tags, ni
 * equipes. Deux raisons, et la seconde compte autant que la premiere.
 *
 *   1. Une seule requete SQL. Les tags et les equipes sont des jointures
 *      separees, donc deux requetes de plus a chaque appel — le defaut qu'on
 *      vient precisement de supprimer.
 *   2. 200 descriptions pesent plus que tout le reste de la reponse, et la page
 *      qui consomme ce point d'entree n'en affiche aucune.
 *
 * `isActive` est present parce que c'est le seul endroit ou une room desactivee
 * doit rester visible : une room retiree du catalogue ne doit pas disparaitre
 * de la progression de quelqu'un qui l'a terminee.
 */
export const RoomBriefSchema = z.object({
  code: z.string(),
  title: z.string(),
  difficulty: z.object({ key: z.string(), label: z.string(), level: z.number().int() }),
  type: z.object({ key: z.string(), label: z.string() }),
  durationMinutes: z.number().int().nullable(),
  thmUrl: z.string(),
  isActive: z.boolean(),
});

/**
 * Reponse du lot.
 *
 * `missing` n'est PAS une erreur : c'est une donnee de la reponse. Un code
 * inconnu dans la progression locale de quelqu'un est un fait a lui montrer,
 * pas un motif pour lui refuser sa page entiere. Le statut reste 200 meme si
 * tous les codes sont inconnus.
 */
export const RoomBatchResponseSchema = z.object({
  rooms: z.array(RoomBriefSchema),
  missing: z.array(z.string()),
});

export const PaginationSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export const RoomListResponseSchema = z.object({
  data: z.array(RoomSummarySchema),
  pagination: PaginationSchema,
  /**
   * Strategie de recherche reellement employee. `trigram` signifie que
   * `websearch_to_tsquery` n'a rien trouve dans tout le catalogue et que le repli
   * par similarite de titre a pris le relais. L'interface doit pouvoir le dire.
   */
  search: z.object({ term: z.string(), strategy: z.enum(["fulltext", "trigram"]) }).nullable(),
});

/**
 * Pas de `name` ici, et c'est delibere : la forme d'affichage vient de
 * `/api/tags`, qui est mis en cache. `/api/facets` est appele a chaque
 * changement de filtre et ne transporte que ce qui change. Le front joint sur
 * le `slug` — et affiche le slug si le nom lui manque encore.
 */
const CountedTagSchema = z.object({
  slug: z.string(),
  count: z.number().int(),
});

export const FacetsResponseSchema = z.object({
  difficulty: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      level: z.number().int(),
      count: z.number().int(),
    }),
  ),
  type: z.array(z.object({ key: z.string(), label: z.string(), count: z.number().int() })),
  team: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      color: z.string(),
      count: z.number().int(),
    }),
  ),
  tech: z.array(CountedTagSchema),
  tool: z.array(CountedTagSchema),
  skill: z.array(CountedTagSchema),
});

export const TagListResponseSchema = z.object({
  data: z.array(
    z.object({
      kind: z.enum(["technology", "tool", "skill"]),
      slug: z.string(),
      name: z.string(),
      count: z.number().int(),
    }),
  ),
});

export const CategoryListResponseSchema = z.object({
  data: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      position: z.number().int(),
      parentSlug: z.string().nullable(),
      count: z.number().int(),
    }),
  ),
});

export const StatsResponseSchema = z.object({
  rooms: z.object({ total: z.number().int(), withoutTeam: z.number().int() }),
  durationMinutes: z.object({
    total: z.number().int(),
    min: z.number().int().nullable(),
    max: z.number().int().nullable(),
  }),
  byDifficulty: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      level: z.number().int(),
      count: z.number().int(),
    }),
  ),
  byType: z.array(z.object({ key: z.string(), label: z.string(), count: z.number().int() })),
  byTeam: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      color: z.string(),
      count: z.number().int(),
    }),
  ),
  tags: z.object({
    technology: z.number().int(),
    tool: z.number().int(),
    skill: z.number().int(),
  }),
});

// --- Types inferes, pour le front comme pour l'API --------------------------
//
// Une seule definition du contrat, des deux cotes du reseau. Le jour ou une
// reponse change de forme, le front cesse de compiler : c'est le but.

export type RoomSummary = z.infer<typeof RoomSummarySchema>;
export type RoomDetail = z.infer<typeof RoomDetailSchema>;
export type RoomBrief = z.infer<typeof RoomBriefSchema>;
export type RoomBatchResponse = z.infer<typeof RoomBatchResponseSchema>;
export type RoomListResponse = z.infer<typeof RoomListResponseSchema>;
export type FacetsResponse = z.infer<typeof FacetsResponseSchema>;
export type TagListResponse = z.infer<typeof TagListResponseSchema>;
export type CategoryListResponse = z.infer<typeof CategoryListResponseSchema>;
export type StatsResponse = z.infer<typeof StatsResponseSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
export type TagRef = z.infer<typeof TagRefSchema>;
export type TeamRef = z.infer<typeof TeamRefSchema>;
