import {
  ROADMAP_DISCLAIMER,
  TrackDetailResponseSchema,
  TrackListResponseSchema,
} from "@thm/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { notFoundProblem, ProblemSchema, sendProblem } from "../http/problem.js";
import { findTrackBySlug, listTracks } from "../queries/tracks.js";

/**
 * Endpoints des parcours.
 *
 * `disclaimer` voyage dans CHAQUE reponse. Le laisser a la charge de l'interface
 * reviendrait a esperer qu'elle l'affiche : un client qui consomme l'API sans
 * passer par notre front le recevrait quand meme.
 *
 * VOCABULAIRE : une etape « recommande » des rooms. Jamais « requiert », jamais
 * « prerequis ». Les donnees TryHackMe ne contiennent aucun prerequis et rien ici
 * n'en fabrique un.
 */

const TrackSlugParamsSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug de parcours invalide"),
});

const CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=3600";

export const trackRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/api/tracks",
    {
      schema: {
        tags: ["parcours"],
        summary: "Liste des parcours publies",
        description:
          "Contenu EDITORIAL, ecrit a la main : le dataset TryHackMe ne contient ni " +
          "prerequis, ni ordre pedagogique, ni parcours. Chaque parcours porte sa " +
          "`provenance`, qui dit comment il a ete construit et s'il a ete suivi de " +
          "bout en bout par l'equipe. `coreRoomCount` est le denominateur de la " +
          "progression : les rooms `optional` et `bonus` n'y entrent pas.",
        response: { 200: TrackListResponseSchema },
      },
    },
    async (_request, reply) => {
      reply.header("cache-control", CACHE_CONTROL);
      return { data: await listTracks(), disclaimer: ROADMAP_DISCLAIMER };
    },
  );

  app.get(
    "/api/tracks/:slug",
    {
      schema: {
        tags: ["parcours"],
        summary: "Detail d'un parcours, etape par etape",
        description:
          "Les etapes sont numerotees et ORDONNEES : ici la numerotation encode une " +
          "sequence pedagogique. `note` est un texte destine a l'utilisateur final, " +
          "a afficher sous la room concernee.",
        params: TrackSlugParamsSchema,
        response: { 200: TrackDetailResponseSchema, 400: ProblemSchema, 404: ProblemSchema },
      },
    },
    async (request, reply) => {
      const track = await findTrackBySlug(request.params.slug);
      if (track === null) {
        return sendProblem(
          reply,
          notFoundProblem(
            `Aucun parcours publie avec le slug "${request.params.slug}".`,
            request.url,
          ),
        );
      }
      reply.header("cache-control", CACHE_CONTROL);
      return { data: track, disclaimer: ROADMAP_DISCLAIMER };
    },
  );
};
