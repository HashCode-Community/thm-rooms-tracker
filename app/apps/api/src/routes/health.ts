import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { pingDatabase } from "../db/client.js";

/**
 * Sonde de vie.
 *
 * Typee par Zod : les memes schemas valident la reponse et generent l'OpenAPI.
 *
 * La confrontation TypeScript 7 / Drizzle / fastify-type-provider-zod qui a servi
 * a franchir la porte C2 (ADR-0002) vit desormais dans
 * tests/type-inference.probe.ts, ou elle a sa place : verifier l'inference n'est
 * pas le travail d'un endpoint de production.
 */

/**
 * Repond a « suis-je vivant », PAS a « que contient ma base ».
 *
 * Aucun compteur metier ici, volontairement : un /health qui execute une requete
 * metier finit par echouer parce que cette requete est lente, et un load
 * balancer retire alors un serveur parfaitement sain. Le nombre de rooms
 * appartient a /api/stats (phase 5).
 */
const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  db: z.literal("ok"),
});

const HealthErrorSchema = z.object({
  status: z.literal("error"),
  db: z.literal("error"),
});

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/health",
    {
      schema: {
        tags: ["monitoring"],
        summary: "Sonde de vie",
        description:
          "`db` n'est `ok` qu'apres un aller-retour SQL reellement execute. " +
          "Un health check qui ne touche pas la base ne prouve rien.",
        response: {
          200: HealthResponseSchema,
          503: HealthErrorSchema,
        },
      },
    },
    async (_request, reply) => {
      try {
        const reachable = await pingDatabase();
        if (!reachable) {
          return reply.code(503).send({ status: "error", db: "error" } as const);
        }

        return { status: "ok", db: "ok" } as const;
      } catch (error) {
        // Le detail reste dans les logs serveur, jamais dans la reponse client.
        app.log.error({ err: error }, "health: le SELECT 1 a echoue");
        return reply.code(503).send({ status: "error", db: "error" } as const);
      }
    },
  );
};
