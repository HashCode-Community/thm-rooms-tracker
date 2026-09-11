import { count, eq } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db, pingDatabase } from "../db/client.js";
import { rooms } from "../db/schema.js";

/**
 * Sonde de vie.
 *
 * Sert aussi de porte de validation TypeScript 7 (ADR-0002) : cette route
 * confronte dans un meme fichier les deux bibliotheques les plus lourdes en
 * programmation au niveau types de la stack, `fastify-type-provider-zod` et
 * Drizzle. C'est la ou un compilateur majeur tout neuf casse, pas sur deux
 * applications vides.
 */

const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  db: z.literal("ok"),
  /** Nombre de rooms actives. 0 tant que l'import de la phase 4 n'a pas tourne. */
  activeRooms: z.number().int().nonnegative(),
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

        // Requete Drizzle typee : l'inference doit remonter jusqu'ici sans se
        // degrader en `any`. C'est precisement ce que la porte C2 verifie.
        const [row] = await db
          .select({ total: count() })
          .from(rooms)
          .where(eq(rooms.isActive, true));

        return { status: "ok", db: "ok", activeRooms: row?.total ?? 0 } as const;
      } catch (error) {
        // Le detail reste dans les logs serveur, jamais dans la reponse client.
        app.log.error({ err: error }, "health: le SELECT 1 a echoue");
        return reply.code(503).send({ status: "error", db: "error" } as const);
      }
    },
  );
};
