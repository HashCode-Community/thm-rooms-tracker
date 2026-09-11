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
import {
  FacetQuerySchema,
  RoomCodeParamsSchema,
  RoomListQuerySchema,
  TagQuerySchema,
} from "../schemas/catalog.js";
import {
  CategoryListResponseSchema,
  FacetsResponseSchema,
  RoomDetailSchema,
  RoomListResponseSchema,
  StatsResponseSchema,
  TagListResponseSchema,
} from "../schemas/responses.js";

/**
 * Endpoints du catalogue.
 *
 * SEMANTIQUE DES FILTRES — repetee ici parce qu'elle est visible dans l'OpenAPI :
 *   OU a l'interieur d'une facette, ET entre facettes.
 *   `?tech=linux&tech=windows&tool=nmap` = (Linux OU Windows) ET Nmap.
 *
 * Les deux ecritures `?tech=a&tech=b` et `?tech[]=a&tech[]=b` sont equivalentes.
 */

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
          "valeurs tomberaient a zero et l'interface se verrouillerait.",
        querystring: FacetQuerySchema,
        response: { 200: FacetsResponseSchema, 400: ProblemSchema },
      },
    },
    async (request) => {
      const filters = request.query;
      const strategy = await resolveSearchStrategy(filters.q);
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
          "`name` est la forme d'affichage et peut changer sans migration.",
        querystring: TagQuerySchema,
        response: { 200: TagListResponseSchema, 400: ProblemSchema },
      },
    },
    async (request) => ({ data: await listTags(request.query.kind) }),
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
    async () => ({ data: await listCategories() }),
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
    async () => computeStats(),
  );
};
