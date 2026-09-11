import {
  CategoryListResponseSchema,
  FacetQuerySchema,
  FacetsResponseSchema,
  RoomCodeParamsSchema,
  RoomDetailSchema,
  RoomListQuerySchema,
  RoomListResponseSchema,
  StatsResponseSchema,
  TagListResponseSchema,
  TagQuerySchema,
} from "@thm/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { notFoundProblem, ProblemSchema, sendProblem } from "../http/problem.js";
import { computeFacets } from "../queries/facets.js";
import { resolveSearchStrategy } from "../queries/room-filters.js";
import {
  computeStats,
  findRoomByCode,
  listCategories,
  listRooms,
  listTags,
} from "../queries/rooms.js";

/**
 * Endpoints du catalogue.
 *
 * SEMANTIQUE DES FILTRES — repetee ici parce qu'elle est visible dans l'OpenAPI :
 *   OU a l'interieur d'une facette, ET entre facettes.
 *   `?tech=linux&tech=windows&tool=nmap` = (Linux OU Windows) ET Nmap.
 *
 * Les deux ecritures `?tech=a&tech=b` et `?tech[]=a&tech[]=b` sont equivalentes.
 */

/**
 * Donnees de REFERENCE : elles ne changent qu'a l'import, jamais au fil des
 * requetes. Un an de cache serait malhonnete, une minute ne servirait a rien.
 *
 * Consequence assumee : apres un import, un client peut ignorer pendant une heure
 * le NOM d'affichage d'un tag nouvellement apparu. Ce n'est pas grave par
 * construction — `slug` est la cle fonctionnelle et il vient de `/api/facets`,
 * qui n'est pas mis en cache ; `name` est cosmetique et modifiable sans migration
 * (ADR-0003). Le front affiche le slug quand le nom lui manque.
 */
const REFERENCE_CACHE_CONTROL = "public, max-age=3600, stale-while-revalidate=86400";

/** Depend de la requete : jamais mis en cache. */
const QUERY_CACHE_CONTROL = "no-store";

const FILTER_SEMANTICS =
  "Filtres multi-valeurs : OU a l'interieur d'une meme facette, ET entre facettes. " +
  "`?tech=linux&tech=windows&tool=nmap` signifie (Linux OU Windows) ET Nmap. " +
  "Les ecritures `?tech=a&tech=b` et `?tech[]=a&tech[]=b` sont equivalentes. " +
  "Seules les rooms actives sont retournees.";

export const catalogRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/api/rooms",
    {
      schema: {
        tags: ["catalogue"],
        summary: "Liste paginee des rooms",
        description:
          `${FILTER_SEMANTICS} ` +
          "Tri : tout ORDER BY est departage par `code` croissant, ce qui rend la " +
          "pagination par offset stable malgre les ex aequo (710 des 714 rooms sont " +
          "ex aequo sur la duree). Recherche : `websearch_to_tsquery` sur le vecteur " +
          "de recherche, repli par similarite trigramme sur le titre si le terme ne " +
          "ramene rien dans tout le catalogue.",
        querystring: RoomListQuerySchema,
        response: { 200: RoomListResponseSchema, 400: ProblemSchema },
      },
    },
    async (request) => {
      const { sort, page, limit, ...filters } = request.query;
      return listRooms(filters, { sort, page, limit });
    },
  );

  app.get(
    "/api/rooms/:code",
    {
      schema: {
        tags: ["catalogue"],
        summary: "Detail d'une room",
        description:
          "La route porte sur `code`, l'identifiant public (ADR-0001 Q1). La " +
          "comparaison est SENSIBLE A LA CASSE : 14 des 714 codes contiennent des " +
          "majuscules et l'URL TryHackMe en depend.",
        params: RoomCodeParamsSchema,
        response: { 200: RoomDetailSchema, 400: ProblemSchema, 404: ProblemSchema },
      },
    },
    async (request, reply) => {
      const room = await findRoomByCode(request.params.code);
      if (room === null) {
        return sendProblem(
          reply,
          notFoundProblem(`Aucune room avec le code "${request.params.code}".`, request.url),
        );
      }
      return room;
    },
  );

  app.get(
    "/api/facets",
    {
      schema: {
        tags: ["catalogue"],
        summary: "Compteurs de facettes pour les filtres restants",
        description:
          `${FILTER_SEMANTICS} ` +
          "Le compteur d'une facette est calcule sur l'ensemble filtre par tous les " +
          "filtres SAUF elle-meme. C'est ce qui permet de cocher une deuxieme valeur " +
          "dans la meme liste : comptes sur l'ensemble entierement filtre, les autres " +
          "valeurs tomberaient a zero et l'interface se verrouillerait. " +
          "Les facettes de tags ne portent PAS le nom d'affichage : il vient de " +
          "`/api/tags`, mis en cache. Cette reponse-ci change a chaque filtre.",
        querystring: FacetQuerySchema,
        response: { 200: FacetsResponseSchema, 400: ProblemSchema },
      },
    },
    async (request, reply) => {
      const filters = request.query;
      const strategy = await resolveSearchStrategy(filters.q);
      reply.header("cache-control", QUERY_CACHE_CONTROL);
      return computeFacets(filters, strategy);
    },
  );

  app.get(
    "/api/tags",
    {
      schema: {
        tags: ["catalogue"],
        summary: "Technologies, outils et competences avec leur nombre de rooms",
        description:
          "`slug` est la valeur a passer aux filtres `tech`, `tool` et `skill`. " +
          "`name` est la forme d'affichage et peut changer sans migration. " +
          "C'est l'endpoint des NOMS : `/api/facets` ne rend que des couples " +
          "`slug` -> compteur, le front joint les deux. Mis en cache une heure, " +
          "ces donnees ne changeant qu'a l'import.",
        querystring: TagQuerySchema,
        response: { 200: TagListResponseSchema, 400: ProblemSchema },
      },
    },
    async (request, reply) => {
      reply.header("cache-control", REFERENCE_CACHE_CONTROL);
      return { data: await listTags(request.query.kind) };
    },
  );

  app.get(
    "/api/categories",
    {
      schema: {
        tags: ["catalogue"],
        summary: "Categories metier",
        description:
          "Liste plate, `parentSlug` porte la hierarchie. VIDE aujourd'hui : aucune " +
          "categorisation n'est deduite des donnees TryHackMe, et rien ne sera " +
          "invente. Le contenu arrive avec le travail editorial de la phase 7.",
        response: { 200: CategoryListResponseSchema },
      },
    },
    async (_request, reply) => {
      reply.header("cache-control", REFERENCE_CACHE_CONTROL);
      return { data: await listCategories() };
    },
  );

  app.get(
    "/api/stats",
    {
      schema: {
        tags: ["catalogue"],
        summary: "Chiffres du catalogue",
        description: "Comptes sur les rooms ACTIVES uniquement.",
        response: { 200: StatsResponseSchema },
      },
    },
    async (_request, reply) => {
      reply.header("cache-control", REFERENCE_CACHE_CONTROL);
      return computeStats();
    },
  );
};
