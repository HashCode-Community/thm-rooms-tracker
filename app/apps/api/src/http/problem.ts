import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from "fastify-type-provider-zod";
import { z } from "zod";

/**
 * Erreurs au format RFC 9457, « Problem Details for HTTP APIs ».
 *
 * Type de media : `application/problem+json`. Sans lui, un client ne peut pas
 * distinguer un corps d'erreur structure d'une reponse metier.
 *
 * `type` est une reference d'URI RELATIVE (`/problems/...`). La RFC 9457 l'autorise
 * explicitement (section 3.1.1, resolution contre l'URI de base). C'est preferable
 * a une URL absolue pointant vers un domaine qui n'existe pas encore.
 */

export const PROBLEM_CONTENT_TYPE = "application/problem+json";

export const ProblemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  /** Extension : detail champ par champ des erreurs de validation. */
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});

export type Problem = z.infer<typeof ProblemSchema>;

export function sendProblem(reply: FastifyReply, problem: Problem): FastifyReply {
  return reply.code(problem.status).type(PROBLEM_CONTENT_TYPE).send(problem);
}

export function notFoundProblem(detail: string, instance: string): Problem {
  return {
    type: "/problems/not-found",
    title: "Ressource introuvable",
    status: 404,
    detail,
    instance,
  };
}

/**
 * Branche le gestionnaire d'erreurs global et le 404.
 *
 * `exposeDetail` vient de la configuration, pas de `process.env` : en production
 * le client recoit un message generique et rien d'autre. Le detail technique part
 * dans les logs serveur, ou il a sa place.
 */
export function registerProblemHandlers(app: FastifyInstance, exposeDetail: boolean): void {
  app.setNotFoundHandler((request, reply) => {
    sendProblem(
      reply,
      notFoundProblem(`Aucune route ${request.method} ${request.url}.`, request.url),
    );
  });

  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    // 1. Validation d'entree : 400, avec le detail champ par champ. Ce detail est
    //    sur les donnees ENVOYEES par le client, il n'expose rien du serveur.
    if (hasZodFastifySchemaValidationErrors(error)) {
      return sendProblem(reply, {
        type: "/problems/validation-error",
        title: "Parametres de requete invalides",
        status: 400,
        detail: "Un ou plusieurs parametres ne respectent pas le contrat.",
        instance: request.url,
        errors: error.validation.map((issue) => ({
          path: issue.instancePath === "" ? "(racine)" : issue.instancePath,
          message: issue.message ?? "valeur invalide",
        })),
      });
    }

    // 2. Serialisation de sortie : c'est un BUG SERVEUR, pas une erreur client.
    //    La reponse ne respectait pas le schema declare. 500, detail dans les logs.
    if (isResponseSerializationError(error)) {
      request.log.error(
        { err: error, issues: error.cause.issues },
        "la reponse ne respecte pas le schema declare",
      );
      return sendProblem(reply, {
        type: "/problems/internal-error",
        title: "Erreur interne",
        status: 500,
        detail: exposeDetail
          ? `Serialisation de la reponse invalide : ${error.message}`
          : "Une erreur interne est survenue.",
        instance: request.url,
      });
    }

    const status = typeof error.statusCode === "number" ? error.statusCode : 500;

    // 3. Limite de debit. Un 429 n'est PAS une « requete invalide » : la requete
    //    est parfaitement valable, il y en a seulement trop. Sans cette branche,
    //    la reponse porterait un titre qui ment sur ce qui s'est passe, et le
    //    client n'aurait aucun moyen de distinguer « corrige ta requete » de
    //    « ralentis ». L'en-tete `Retry-After`, lui, est deja pose par le greffon.
    if (status === 429) {
      return sendProblem(reply, {
        type: "/problems/rate-limit",
        title: "Trop de requetes",
        status,
        detail: error.message,
        instance: request.url,
      });
    }

    if (status >= 500) {
      request.log.error({ err: error }, "erreur non geree");
      return sendProblem(reply, {
        type: "/problems/internal-error",
        title: "Erreur interne",
        status: 500,
        // JAMAIS de pile d'appels ni de message brut en production : un message
        // d'erreur de base de donnees revele le schema.
        detail: exposeDetail ? error.message : "Une erreur interne est survenue.",
        instance: request.url,
      });
    }

    return sendProblem(reply, {
      type: "/problems/request-error",
      title: "Requete invalide",
      status,
      detail: error.message,
      instance: request.url,
    });
  });
}
