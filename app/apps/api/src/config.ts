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
   * Confiance accordee a `X-Forwarded-For`.
   *
   * CE N'EST PLUS UN BOOLEEN, parce qu'un booleen ne pouvait pas exprimer une
   * valeur sure : `true` veut dire « fais confiance a TOUS les sauts », donc
   * `request.ip` devient l'entree que l'APPELANT a ecrite. Le compteur de debit
   * s'appuyant sur `request.ip`, il suffisait de changer un en-tete a chaque
   * requete pour n'etre jamais limite. Mesure sur le service en ligne le
   * 2026-09-18, avant correction : trois requetes nues font descendre le seau
   * de 119 a 117, trois requetes portant chacune un `X-Forwarded-For` different
   * rendent 119, 119, 119.
   *
   * Le type etait le defaut, pas la valeur. `readTrustProxy` porte la mesure
   * complete et explique pourquoi une fonction, et pas le nombre que Fastify
   * accepte pourtant.
   */
  readonly trustProxy: ConfianceProxy;
  /** Origines autorisees a appeler l'API depuis un autre domaine. */
  readonly corsOrigins: readonly string[];
  readonly logLevel: string;
  readonly host: string;
  readonly port: number;
};

function readNodeEnv(value: string | undefined): NodeEnv {
  return value === "production" || value === "test" ? value : "development";
}

/**
 * Lit `TRUST_PROXY` et rend ce que Fastify doit recevoir.
 *
 * POURQUOI UNE FONCTION, ET PAS LE NOMBRE TEL QUEL. Le nombre que Fastify
 * accepte ne compte PAS les sauts, malgre son nom. Mesure, meme topologie dans
 * les quatre cas — socket 10.0.0.7, client reel 203.0.113.200, et un appelant
 * qui prefixe l'en-tete de 198.51.100.1 pour se choisir une adresse :
 *
 *   trustProxy            honnete           tricheur
 *   false                 10.0.0.7          10.0.0.7        un seul seau global
 *   true                  203.0.113.200     198.51.100.1    l'appelant decide
 *   1  (nombre)           10.0.0.7          10.0.0.7        l'en-tete est ignore
 *   (addr, hop) => hop<1  203.0.113.200     203.0.113.200   correct
 *
 * `1` ne degrade donc pas moins que `false` : il met TOUS les visiteurs dans le
 * meme seau, puisque le socket vu par l'application est le proxy de
 * l'hebergeur, identique pour tout le monde. La fonction, elle, retient la
 * DERNIERE entree de l'en-tete — celle que le proxy vient d'ajouter lui-meme,
 * et que l'appelant ne peut donc pas ecrire.
 *
 * `"true"` EST REFUSE. C'est la valeur qui a ouvert la faille en production le
 * 2026-09-18 ; l'accepter en silence la reconduirait a chaque deploiement qui
 * recopie l'ancienne documentation. Le message dit quoi mettre a la place :
 * une erreur qui n'indique pas la sortie coute autant que le defaut qu'elle
 * signale.
 *
 * Absente ou vide : `false`. Un seul seau pour tout le monde — genant, mais sur.
 * Des deux facons de se tromper, c'est celle qui degrade au lieu d'ouvrir.
 */
export type ConfianceProxy = boolean | ((adresse: string, saut: number) => boolean);

export function readTrustProxy(value: string | undefined): ConfianceProxy {
  const brut = value?.trim();
  if (brut === undefined || brut === "" || brut === "false") return false;

  if (brut === "true") {
    throw new Error(
      "TRUST_PROXY=true fait confiance a TOUS les sauts : l'appelant choisit alors " +
        "l'adresse sur laquelle il est compte, et la limite de debit ne limite plus rien. " +
        "Mettre le NOMBRE d'intermediaires devant l'application — sur Render, 1.",
    );
  }

  if (!/^\d+$/.test(brut)) {
    throw new Error(`TRUST_PROXY doit etre un nombre d'intermediaires, recu : ${brut}`);
  }

  const sauts = Number.parseInt(brut, 10);
  if (sauts === 0) return false;
  return (_adresse: string, saut: number) => saut < sauts;
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
    trustProxy: readTrustProxy(env.TRUST_PROXY),
    corsOrigins: parseOrigines(env.CORS_ORIGINS),
    logLevel: env.LOG_LEVEL ?? (nodeEnv === "test" ? "silent" : "info"),
    host: env.API_HOST ?? "127.0.0.1",
    port: Number.parseInt(env.API_PORT ?? "3000", 10),
  };
}
