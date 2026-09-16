import fastifyCors from "@fastify/cors";
import type { FastifyInstance } from "fastify";

/**
 * Origines autorisees.
 *
 * ADR-0001 D3 fixe la cible : le front sur `<domaine>`, l'API sur
 * `api.<domaine>`. Ce sont deux origines differentes, donc le navigateur
 * refusera l'appel sans en-tete CORS. Ce n'est pas anticiper un besoin
 * hypothetique — c'est le deploiement decide.
 *
 * LA LISTE EST VIDE PAR DEFAUT, et c'est volontaire : aucun en-tete CORS n'est
 * alors pose, donc seul le meme domaine peut appeler l'API. C'est ce qui vaut en
 * developpement, ou le front passe par le proxy de Vite et se presente comme la
 * meme origine. Le deploiement remplit `CORS_ORIGINS`, et rien avant.
 *
 * `*` n'est jamais accepte : voir le test qui l'exige.
 */

export type ReglagesOrigines = Readonly<{
  /** Origines exactes, schema compris : `https://thm.example`. */
  readonly autorisees: readonly string[];
}>;

/**
 * Lit la liste depuis une variable d'environnement.
 *
 * `*` est REFUSE, pas ignore en silence. Une etoile dans cette variable est une
 * intention — « ouvre a tout le monde » — et la traiter comme une faute de
 * frappe laisserait quelqu'un croire qu'il a ouvert l'API alors que non, ou
 * l'inverse. On s'arrete au demarrage.
 */
export function parseOrigines(valeur: string | undefined): readonly string[] {
  if (valeur === undefined || valeur.trim() === "") return [];

  const origines = valeur
    .split(",")
    .map((origine) => origine.trim())
    .filter((origine) => origine !== "");

  const etoile = origines.find((origine) => origine === "*");
  if (etoile !== undefined) {
    throw new Error(
      "CORS_ORIGINS contient `*`. Une API ouverte a toutes les origines n'a pas " +
        "de politique d'origine. Nommez les domaines autorises, separes par des virgules.",
    );
  }

  const invalide = origines.find((origine) => !/^https?:\/\/[^/\s]+$/.test(origine));
  if (invalide !== undefined) {
    throw new Error(
      `CORS_ORIGINS contient une origine invalide : ${JSON.stringify(invalide)}. ` +
        "Attendu : schema et hote, sans chemin final, par exemple https://thm.example",
    );
  }

  return origines;
}

export async function registerCors(
  app: FastifyInstance,
  reglages: ReglagesOrigines,
): Promise<void> {
  // Aucune origine declaree : on n'enregistre RIEN. Enregistrer le greffon avec
  // une liste vide poserait quand meme `Vary: Origin` sur chaque reponse, ce qui
  // fragmente inutilement les caches intermediaires pour une politique qui
  // n'existe pas.
  if (reglages.autorisees.length === 0) return;

  await app.register(fastifyCors, {
    origin: [...reglages.autorisees],
    methods: ["GET", "HEAD", "OPTIONS"],
    // L'API ne lit aucun cookie et n'en pose aucun : la progression vit dans le
    // navigateur. Autoriser les identifiants ouvrirait une surface sans usage.
    credentials: false,
    maxAge: 600,
  });
}
