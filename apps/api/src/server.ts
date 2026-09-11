import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { closeDatabase } from "./db/client.js";
import { healthRoutes } from "./routes/health.js";

const HOST = process.env.API_HOST ?? "127.0.0.1";
const PORT = Number.parseInt(process.env.API_PORT ?? "3000", 10);

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
  },
});

// Zod valide les entrees ET genere l'OpenAPI a partir des memes schemas :
// une seule definition, pas de doc a maintenir en parallele du code.
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: "THM Roadmap API",
      description:
        "Catalogue et parcours d'apprentissage construits sur les rooms gratuites TryHackMe. " +
        "Projet non affilie a TryHackMe : seules des metadonnees publiques sont exposees.",
      version: "0.1.0",
    },
  },
  transform: jsonSchemaTransform,
});
await app.register(fastifySwaggerUi, { routePrefix: "/docs" });

await app.register(healthRoutes);

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, "arret demande, fermeture propre");
  try {
    await app.close();
    await closeDatabase();
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, "echec de l'arret propre");
    process.exit(1);
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}

try {
  await app.listen({ host: HOST, port: PORT });
} catch (error) {
  app.log.error({ err: error }, "impossible de demarrer le serveur");
  process.exit(1);
}
