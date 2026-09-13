/**
 * Compatibilite de version entre le dataset et le code qui le consomme.
 *
 * Mode de defaillance le plus probable du projet : Malick fait evoluer le
 * scraper, Nel n'a pas encore mis a jour l'importer, et les deux avancent en
 * desynchronisation. Sans ce controle, l'erreur remontee serait un
 * `unrecognized key: "imageUrl"` de Zod, qui ne dit rien du vrai probleme.
 *
 * Le contrat pose `additionalProperties: false` sur la racine et sur chaque
 * room. Un champ ajoute par le scraper n'est donc PAS ignore : il est rejete.
 * C'est voulu (la coordination est forcee plutot que la derive silencieuse),
 * mais cela n'a de sens que si le message d'erreur est actionnable.
 *
 * Politique de versionnement, cf. docs/data-contract.md :
 *   ajout de champ                 -> bump MINEUR (1.0.0 -> 1.1.0), meme fichier
 *   suppression / changement type  -> bump MAJEUR (2.0.0), fichier rooms.v2.json
 * Le dataset et son schema voyagent ensemble, jamais l'un sans l'autre.
 */

/** Plage supportee par cet importer, au sens du caret npm : >=1.0.0 <2.0.0. */
export const SUPPORTED_DATASET_RANGE = "^1.0.0";

type Semver = { major: number; minor: number; patch: number };

function parseSemver(value: string): Semver | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) return null;
  const [, major, minor, patch] = match;
  if (major === undefined || minor === undefined || patch === undefined) return null;
  return { major: Number(major), minor: Number(minor), patch: Number(patch) };
}

export type VersionVerdict =
  | { ok: true; version: string }
  | { ok: false; version: string; reason: string };

/**
 * Verifie `meta.datasetVersion` AVANT la validation Zod, pour que l'incompatibilite
 * de version l'emporte sur le symptome (un champ inconnu).
 */
export function checkDatasetVersion(
  datasetVersion: unknown,
  range: string = SUPPORTED_DATASET_RANGE,
): VersionVerdict {
  const raw = typeof datasetVersion === "string" ? datasetVersion : String(datasetVersion);

  const supported = parseSemver(range.replace(/^\^/, ""));
  const actual = parseSemver(raw);

  if (!supported) {
    return { ok: false, version: raw, reason: `Plage supportee illisible : "${range}".` };
  }
  if (!actual) {
    return {
      ok: false,
      version: raw,
      reason:
        `\`meta.datasetVersion\` absent ou malforme ("${raw}"). ` +
        "Le contrat impose le format X.Y.Z. Corriger le scraper avant de relivrer.",
    };
  }

  if (actual.major !== supported.major) {
    return {
      ok: false,
      version: raw,
      reason:
        `Dataset v${raw} incompatible : cet importer supporte ${range}. ` +
        "Changement majeur = rupture de contrat (champ supprime ou type modifie). " +
        `Attendre la mise a jour de l'importer, ou repartir d'un fichier rooms.v${supported.major}.json.`,
    };
  }

  if (
    actual.minor > supported.minor ||
    (actual.minor === supported.minor && actual.patch > supported.patch)
  ) {
    return {
      ok: false,
      version: raw,
      reason:
        `Dataset v${raw} incompatible : cet importer supporte ${range}. ` +
        "Le dataset est PLUS RECENT que l'importer : le scraper a probablement ajoute un champ. " +
        "Mettre a jour l'importer et le contrat Zod, ou regenerer le dataset avec l'ancien scraper. " +
        "Ne PAS contourner en relachant le schema.",
    };
  }

  if (actual.minor < supported.minor) {
    return {
      ok: false,
      version: raw,
      reason:
        `Dataset v${raw} plus ancien que la plage supportee ${range}. ` +
        "L'importer attend des champs que ce dataset ne contient pas. Relancer un scrape.",
    };
  }

  return { ok: true, version: raw };
}
