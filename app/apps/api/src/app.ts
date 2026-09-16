import fastifyCompress from "@fastify/compress";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { parseQueryString } from "@thm/shared";
import Fastify, { type FastifyInstance } from "fastify";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import type { AppConfig } from "./config.js";
import { registerRateLimit } from "./http/debit.js";
import { registerCors } from "./http/origines.js";
import { registerProblemHandlers } from "./http/problem.js";
import { registerSecurityHeaders } from "./http/securite.js";
import { catalogRoutes } from "./routes/catalog.js";
import { healthRoutes } from "./routes/health.js";
import { trackRoutes } from "./routes/tracks.js";

/**
 * Fabrique de l'application.
 *
 * `config` est un PARAMETRE, jamais une lecture de `process.env` a la portee
 * module. Deux consequences, dans cet ordre d'importance :
 *
 *   1. les gardes conditionnelles sont reellement testables. Une garde
 *      `if (process.env.NODE_ENV !== "production")` evaluee a l'import est figee
 *      par le cache de modules : un test qui pose la variable puis importe
 *      l'application passerait a vide, vert et sans rien prouver ;
 *   2. la configuration devient injectable pour tout le reste.
 *
 * `buildApp` ne fait qu'assembler. Elle n'ecoute pas : c'est `server.ts` qui
 * decide d'ouvrir un port.
 */
/**
 * L'ADRESSE IP NE PART PAS DANS LES JOURNAUX.
 *
 * Le serialiseur par defaut de pino ecrit `remoteAddress` a chaque requete.
 * C'est une donnee personnelle, et ce produit n'a ni compte, ni cookie, ni
 * traceur : conserver l'IP de chaque visiteur serait la seule chose qui
 * permettrait de le suivre, et elle n'aurait servi a rien.
 *
 * `request.ip` reste disponible A L'EXECUTION — la limite de debit s'en sert
 * pour compter. Ce qui est retire, c'est la TRACE ECRITE.
 *
 * EXPORTEE pour etre testable sur l'objet reel. Un test qui reconstruirait la
 * liste des chemins de son cote verifierait sa propre copie, et resterait vert
 * le jour ou celle-ci divergerait de celle employee ici.
 */
export const REDACTION_JOURNAL: { paths: string[]; remove: boolean } = {
  paths: ["req.remoteAddress", "req.remotePort", 'req.headers["x-forwarded-for"]'],
  remove: true,
};

export async function buildApp(config: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: REDACTION_JOURNAL,
    },
    // Decide si `request.ip` lit `X-Forwarded-For`. C'est la MEME question que
    // celle de la limite de debit, et elle se repond a un seul endroit.
    trustProxy: config.trustProxy,
    routerOptions: {
      // Rend `?tech[]=a` et `?tech=a` equivalents.
      // Convention partagee avec le front : packages/shared/src/querystring.ts.
      // Sous `routerOptions` et non a la racine : Fastify 5 emet FSTDEP022 pour
      // la forme racine, qui disparait en Fastify 6.
      querystringParser: parseQueryString,
    },
  });

  // Zod valide les entrees ET genere l'OpenAPI a partir des memes schemas :
  // une seule definition, pas de documentation a maintenir en parallele du code.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Compression. Les reponses du catalogue sont du JSON tres repetitif : les
  // memes cles sur chaque room, les memes slugs sur chaque facette. C'est le cas
  // ou gzip rend le plus. `threshold` evite de compresser les petites reponses,
  // ou le cout CPU depasserait le gain.
  await app.register(fastifyCompress, {
    global: true,
    encodings: ["br", "gzip", "deflate"],
    threshold: 1024,
  });

  // En-tetes de securite, poses sur TOUTE reponse — y compris les erreurs et les
  // 404. Un crochet `onSend` global est le seul endroit qui le garantisse :
  // l'oublier sur une route est alors impossible.
  registerSecurityHeaders(app, {
    hsts: config.hsts,
    // `/docs` sert du HTML et a besoin d'une politique plus large. Le prefixe
    // est nomme ici, pas devine.
    prefixesHtml: ["/docs"],
  });

  // La limite de debit AVANT les routes : une requete refusee ne doit pas avoir
  // touche la base.
  await registerRateLimit(app, {
    max: config.rateLimitMax,
    fenetreMs: config.rateLimitWindowMs,
    trustProxy: config.trustProxy,
  });

  await registerCors(app, { autorisees: config.corsOrigins });

  registerProblemHandlers(app, config.exposeErrorDetail);

  // Swagger UI n'est PAS expose en production. Une plateforme de cybersecurite qui
  // publie sa surface d'API complete en clair est exactement l'ironie qu'on nous
  // ressortirait. Point de la checklist phase 9, traite ici parce que la mise en
  // ligne precede la phase 9 dans l'ordre reel des choses.
  if (config.exposeDocs) {
    await app.register(fastifySwagger, {
      openapi: {
        info: {
          title: "THM Roadmap API",
          description:
            "Catalogue et parcours d'apprentissage construits sur les rooms gratuites " +
            "TryHackMe. Projet non affilie a TryHackMe : seules des metadonnees " +
            "publiques sont exposees.",
          version: "0.1.0",
        },
      },
      transform: jsonSchemaTransform,
    });
    await app.register(fastifySwaggerUi, { routePrefix: "/docs" });
  }

  await app.register(healthRoutes);
  await app.register(catalogRoutes);
  await app.register(trackRoutes);

  return app;
}
