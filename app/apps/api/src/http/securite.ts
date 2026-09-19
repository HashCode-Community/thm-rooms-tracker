import type { FastifyInstance } from "fastify";

/**
 * En-tetes de securite.
 *
 * ECRITS A LA MAIN, SANS `@fastify/helmet`. Ce n'est pas de l'entetement : cette
 * API sert du JSON, et l'essentiel de ce que helmet pose s'adresse a des
 * reponses HTML servies par le meme processus. Le compte est vite fait — six
 * en-tetes utiles ici, dont la liste tient ci-dessous avec le mode de
 * defaillance que chacun ferme. Une dependance se justifie par un besoin, pas
 * par une habitude, et celle-ci apporterait surtout des reglages a desactiver.
 *
 * Les en-tetes du FRONT ne sont pas ici : il est servi en statique, par un
 * hebergeur ou un proxy, et c'est la qu'ils devront etre poses. Note dans la
 * dette de deploiement.
 */

export type ReglagesSecurite = Readonly<{
  /**
   * Pose `Strict-Transport-Security`.
   *
   * Uniquement en production. Sur `http://localhost`, l'en-tete est ignore par
   * le navigateur — mais le poser quand meme apprendrait a le lire comme du
   * decor. Pire : un developpeur qui teste sur `http://` avec un nom de domaine
   * local verrait son navigateur forcer HTTPS sur ce nom, durablement.
   */
  readonly hsts: boolean;
  /**
   * Prefixes dont la politique de contenu est RELACHEE.
   *
   * `/docs` est du HTML : Swagger UI a besoin de scripts et de styles en ligne.
   * Lui appliquer `default-src 'none'` rendrait une page blanche, et la reponse
   * evidente serait d'affaiblir la politique POUR TOUT LE MONDE. On relache donc
   * ici, nommement, et seulement ou c'est necessaire.
   */
  readonly prefixesHtml: readonly string[];
}>;

/**
 * Politique de contenu d'une reponse JSON.
 *
 * `default-src 'none'` : rien n'a le droit de se charger depuis une reponse
 * d'API. C'est la politique la plus stricte possible, et elle est exacte : du
 * JSON ne charge rien.
 *
 * `frame-ancestors 'none'` ferme le detournement de clic ; `base-uri 'none'`
 * empeche qu'une injection de `<base>` reroute les URL relatives ;
 * `form-action 'none'` interdit qu'un formulaire injecte poste ailleurs.
 */
const CSP_JSON = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

/** Meme politique, moins ce qui empecherait Swagger UI de fonctionner. */
const CSP_HTML =
  "default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline'; " +
  "style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'";

/** Deux ans, en secondes. Valeur attendue pour une inscription en liste HSTS. */
const HSTS_MAX_AGE = 63072000;

export function registerSecurityHeaders(app: FastifyInstance, reglages: ReglagesSecurite): void {
  app.addHook("onSend", async (request, reply) => {
    const estHtml = reglages.prefixesHtml.some((prefixe) => request.url.startsWith(prefixe));

    // Le navigateur ne DEVINE pas le type : une reponse d'API dont le contenu
    // vient en partie des donnees ne peut pas etre reinterpretee en HTML.
    reply.header("X-Content-Type-Options", "nosniff");

    // Aucune URL de l'API ne part dans l'en-tete `Referer` d'une requete
    // suivante. Les URL portent les filtres de recherche de l'utilisateur.
    reply.header("Referrer-Policy", "no-referrer");

    // Redondant avec `frame-ancestors` pour les navigateurs recents, et seul
    // recours pour les anciens. Deux lignes pour couvrir les deux.
    reply.header("X-Frame-Options", "DENY");

    // Une autre origine ne peut pas embarquer la reponse comme une ressource.
    reply.header("Cross-Origin-Resource-Policy", "same-origin");

    reply.header("Content-Security-Policy", estHtml ? CSP_HTML : CSP_JSON);

    if (reglages.hsts) {
      reply.header(
        "Strict-Transport-Security",
        `max-age=${HSTS_MAX_AGE}; includeSubDomains; preload`,
      );
    }
  });
}
