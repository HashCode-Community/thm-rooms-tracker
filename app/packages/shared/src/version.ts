/**
 * Compatibilite de version entre le dataset et le code qui le consomme.
 *
 * Mode de defaillance le plus probable du projet : Malick fait evoluer le
 * scraper, Nel n'a pas encore mis a jour l'importer, et les deux avancent en
 * desynchronisation. Sans ce controle, l'erreur remontee serait un
 * `unrecognized key: "imageUrl"` de Zod, qui ne dit rien du vrai probleme.
 *
 * Le contrat pose `additionalProperties: false` sur la racine et sur chaque
 * room. Un champ ajoute par le scraper n'est donc PAS ignore : il est rejete
 * par Zod tant que le contrat n'a pas ete mis a jour. Le controle de version
 * reste independant : une version comprise dans la plage caret est compatible.
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

function compareSemver(left: Semver, right: Semver): number {
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  return left.patch - right.patch;
}

/**
 * Semantique du caret npm :
 *   ^1.2.3   -> >=1.2.3 <2.0.0
 *   ^0.2.3   -> >=0.2.3 <0.3.0
 *   ^0.0.3   -> >=0.0.3 <0.0.4
 */
function satisfiesCaret(actual: Semver, minimum: Semver): boolean {
  if (compareSemver(actual, minimum) < 0) return false;
  if (minimum.major > 0) return actual.major === minimum.major;
  if (minimum.minor > 0) return actual.major === 0 && actual.minor === minimum.minor;
  return actual.major === 0 && actual.minor === 0 && actual.patch === minimum.patch;
}

export type VersionVerdict =
  | { ok: true; version: string; notice?: string }
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

  if (!satisfiesCaret(actual, supported)) {
    const older = compareSemver(actual, supported) < 0;
    return {
      ok: false,
      version: raw,
      reason: older
        ? `Dataset v${raw} plus ancien que la plage supportee ${range}. ` +
          "L'importer attend un contrat plus recent. Relancer un scrape compatible."
        : `Dataset v${raw} incompatible : cet importer supporte ${range}. ` +
          "La version sort de la plage de compatibilite et peut rompre le contrat. " +
          "Mettre a jour l'importer avant de relivrer.",
    };
  }

  if (compareSemver(actual, supported) > 0) {
    return {
      ok: true,
      version: raw,
      notice: `Dataset v${raw} plus recent que la version minimale ${supported.major}.${supported.minor}.${supported.patch}, mais compatible avec ${range}.`,
    };
  }

  return { ok: true, version: raw };
}
