import Fastify from "fastify";
import { closeDatabase, pingDatabase } from "./db/client.js";

const HOST = process.env.API_HOST ?? "127.0.0.1";
const PORT = Number.parseInt(process.env.API_PORT ?? "3000", 10);

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
  },
});

/**
 * Sonde de vie. `db` n'est "ok" qu'apres un SELECT 1 reellement execute :
 * un health check qui ne touche pas la base ne prouve rien.
 */
app.get("/health", async (_request, reply) => {
  try {
    const reachable = await pingDatabase();
    if (!reachable) {
      return reply.code(503).send({ status: "error", db: "error" });
    }
    return { status: "ok", db: "ok" };
  } catch (error) {
    // Le detail reste dans les logs serveur, jamais dans la reponse client.
    app.log.error({ err: error }, "health: le SELECT 1 a echoue");
    return reply.code(503).send({ status: "error", db: "error" });
  }
});

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
