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

import { parseOrigines } from "./http/origines.js";

export type NodeEnv = "development" | "test" | "production";

export type AppConfig = {
  readonly nodeEnv: NodeEnv;
  /** Swagger UI sur `/docs`. Jamais en production : cf. checklist phase 9. */
  readonly exposeDocs: boolean;
  /** Detail technique des erreurs 500 dans la reponse. Jamais en production. */
  readonly exposeErrorDetail: boolean;
  /**
   * Pose `Strict-Transport-Security`. Production seulement.
   *
   * Sur `http://`, l'en-tete est ignore — mais le poser quand meme apprendrait a
   * le lire comme du decor, et sur un nom de domaine local il forcerait HTTPS
   * durablement dans le navigateur du developpeur.
   */
  readonly hsts: boolean;
  /** Requetes autorisees par fenetre et par adresse. */
  readonly rateLimitMax: number;
  /** Duree de la fenetre de comptage, en millisecondes. */
  readonly rateLimitWindowMs: number;
  /**
   * Faire confiance a `X-Forwarded-For`. Aucune valeur par defaut n'est sure :
   * `false` derriere un proxy fait un seul seau pour tout le monde, `true` sans
   * proxy laisse n'importe qui s'en fabriquer un. Le deploiement tranche.
   */
  readonly trustProxy: boolean;
  /** Origines autorisees a appeler l'API depuis un autre domaine. */
  readonly corsOrigins: readonly string[];
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
    hsts: isProduction,
    // 120 requetes par minute : une navigation normale en fait quelques dizaines,
    // et l'affichage d'une progression complete de 714 rooms en fait 12.
    rateLimitMax: Number.parseInt(env.RATE_LIMIT_MAX ?? "120", 10),
    rateLimitWindowMs: Number.parseInt(env.RATE_LIMIT_WINDOW_MS ?? "60000", 10),
    trustProxy: env.TRUST_PROXY === "true",
    corsOrigins: parseOrigines(env.CORS_ORIGINS),
    logLevel: env.LOG_LEVEL ?? (nodeEnv === "test" ? "silent" : "info"),
    host: env.API_HOST ?? "127.0.0.1",
    port: Number.parseInt(env.API_PORT ?? "3000", 10),
  };
}
