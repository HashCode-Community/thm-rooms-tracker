import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { closeDatabase } from "./db/client.js";

/**
 * Point d'entree du processus.
 *
 * C'est le SEUL endroit qui lit l'environnement et qui ouvre un port. `buildApp`
 * ne fait qu'assembler une application a partir d'une configuration deja resolue,
 * ce qui la rend utilisable telle quelle depuis les tests.
 */

const config = loadConfig();
const app = await buildApp(config);

if (config.exposeDocs) {
  app.log.info("/docs actif (NODE_ENV != production)");
}

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
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error({ err: error }, "impossible de demarrer le serveur");
  process.exit(1);
}
