import fastifyRateLimit from "@fastify/rate-limit";
import type { FastifyInstance, FastifyRequest } from "fastify";

/**
 * Limite de debit.
 *
 * POURQUOI UNE DEPENDANCE ICI, alors que les en-tetes de securite sont ecrits a
 * la main. Un limiteur correct demande des compteurs par cle, une fenetre
 * glissante, et surtout l'EVICTION des cles devenues inutiles : sans elle, la
 * memoire du processus croit avec le nombre d'adresses vues, et la fuite ne se
 * manifeste qu'apres des semaines de production. C'est exactement la partie
 * qu'on ecrit mal a la main, et c'est celle que `toad-cache` resout dans ce
 * greffon.
 *
 * CE QUE CETTE LIMITE PROTEGE. La recherche plein texte tape `pg_trgm` sur 714
 * lignes a chaque appel. Une boucle de requetes sur `?q=` occupe la base sans
 * qu'aucune ligne de code applicatif ne soit en cause.
 */

export type ReglagesDebit = Readonly<{
  /** Requetes autorisees par fenetre, et par cle. */
  readonly max: number;
  /** Duree de la fenetre, en millisecondes. */
  readonly fenetreMs: number;
  /**
   * Faire confiance a `X-Forwarded-For` pour identifier l'appelant.
   *
   * PIEGE A DEUX FACES, et les deux sont graves.
   *
   * A `false` derriere un proxy, toutes les requetes portent l'adresse du proxy :
   * la limite devient un SEUL SEAU partage par tous les visiteurs, et le site se
   * limite lui-meme des qu'il a du trafic.
   *
   * A `true` sans proxy devant, n'importe qui pose l'en-tete qu'il veut et
   * s'attribue un seau neuf a chaque requete : la limite ne limite plus rien.
   *
   * Il n'existe pas de valeur par defaut sure. Celle retenue, `false`, est la
   * moins dangereuse des deux — elle degrade le service au lieu de l'ouvrir — et
   * le deploiement DOIT la trancher. Voir la dette de la phase 10.
   */
  readonly trustProxy: boolean | ((adresse: string, saut: number) => boolean);
}>;

/**
 * Chemins jamais limites.
 *
 * `/health` est interroge par la supervision, souvent plus vite qu'un humain ne
 * navigue. Le limiter ferait tomber la sonde qui surveille la sante du service,
 * c'est-a-dire declencher l'alerte que la limite etait censee eviter.
 */
const JAMAIS_LIMITE: ReadonlySet<string> = new Set(["/health"]);

export async function registerRateLimit(
  app: FastifyInstance,
  reglages: ReglagesDebit,
): Promise<void> {
  await app.register(fastifyRateLimit, {
    max: reglages.max,
    timeWindow: reglages.fenetreMs,

    /**
     * Cle de comptage.
     *
     * `request.ip` respecte deja `trustProxy` de Fastify. On le laisse decider,
     * plutot que de relire `X-Forwarded-For` ici : deux endroits qui repondent a
     * la meme question finissent par ne plus repondre pareil.
     */
    keyGenerator: (request: FastifyRequest) => request.ip,

    allowList: (request: FastifyRequest) => JAMAIS_LIMITE.has(request.url.split("?")[0] ?? ""),

    /**
     * PAS d'`errorResponseBuilder` ici.
     *
     * La forme des erreurs appartient au gestionnaire global, qui rend du
     * RFC 9457 pour tout le reste. Deux endroits qui fabriquent des corps
     * d'erreur finissent par en fabriquer deux differents, et c'est le second
     * que le front oublie de traiter. Le greffon leve, `problem.ts` met en forme.
     */
  });
}
