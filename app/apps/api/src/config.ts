/**
 * Configuration de l'application.
 *
 * REGLE STRUCTURANTE : rien ici n'est lu a la portee module, et `buildApp` recoit
 * sa configuration en PARAMETRE.
 *
 * Pourquoi ce n'est pas un detail de style : une garde ecrite
 * `if (process.env.NODE_ENV !== "production")` a la portee module est evaluee au
 * PREMIER import du module, puis le resultat est fige dans le cache de modules.
 * Un test qui pose la variable d'environnement puis importe l'application
 * passerait a vide — la garde ayant deja ete evaluee avec l'ancienne valeur. Le
 * test serait vert et ne prouverait rien.
 *
 * `loadConfig` prend `env` en parametre pour la meme raison : il est testable
 * sans toucher au process.
 */

export type NodeEnv = "development" | "test" | "production";

export type AppConfig = {
  readonly nodeEnv: NodeEnv;
  /** Swagger UI sur `/docs`. Jamais en production : cf. checklist phase 9. */
  readonly exposeDocs: boolean;
  /** Detail technique des erreurs 500 dans la reponse. Jamais en production. */
  readonly exposeErrorDetail: boolean;
  readonly logLevel: string;
  readonly host: string;
  readonly port: number;
};

function readNodeEnv(value: string | undefined): NodeEnv {
  return value === "production" || value === "test" ? value : "development";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = readNodeEnv(env.NODE_ENV);
  const isProduction = nodeEnv === "production";

  return {
    nodeEnv,
    exposeDocs: !isProduction,
    exposeErrorDetail: !isProduction,
    logLevel: env.LOG_LEVEL ?? (nodeEnv === "test" ? "silent" : "info"),
    host: env.API_HOST ?? "127.0.0.1",
    port: Number.parseInt(env.API_PORT ?? "3000", 10),
  };
}
