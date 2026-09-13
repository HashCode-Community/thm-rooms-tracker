import { readFileSync } from "node:fs";
import type { RoomSource } from "@thm/shared";
import { parse as parseYaml } from "yaml";

/**
 * Application du mapping de normalisation.
 *
 * Deux couches, qui ne se remplacent pas (ADR-0003) :
 *   le mapping est le MECANISME  -> suffixes d'affichage, fautes de frappe
 *   le slug est le FILET         -> variantes de casse et de ponctuation
 *
 * Sur les donnees brutes, le filet n'attrape rien : 186 outils produisent 186
 * slugs distincts. Il n'attrape qu'un cas, et c'est un cas que le mapping CREE
 * lui-meme. Il servira le jour ou TryHackMe introduira une variante de casse.
 */

// --- Mapping ---------------------------------------------------------------

export type Mapping = {
  version: number;
  /** forme canonique -> variantes a absorber */
  merge: Record<string, string[]>;
  /** forme source -> forme cible (aucun jumeau, simple renommage) */
  rename: Record<string, string>;
  /** slug en collision -> `name` a afficher */
  canonical: Record<string, string>;
};

const EMPTY_MAPPING: Mapping = { version: 0, merge: {}, rename: {}, canonical: {} };

export function loadMapping(path: string): Mapping {
  const parsed: unknown = parseYaml(readFileSync(path, "utf8"));
  if (parsed === null || typeof parsed !== "object") {
    throw new Error(`Mapping illisible : ${path}`);
  }
  const raw = parsed as Partial<Record<keyof Mapping, unknown>>;
  return {
    version: typeof raw.version === "number" ? raw.version : 0,
    merge: asStringArrayRecord(raw.merge, `${path} -> merge`),
    rename: asStringRecord(raw.rename, `${path} -> rename`),
    canonical: asStringRecord(raw.canonical, `${path} -> canonical`),
  };
}

function asStringRecord(value: unknown, where: string): Record<string, string> {
  if (value === null || value === undefined) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${where} : attendu un dictionnaire.`);
  }
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") {
      throw new Error(`${where} : la cle "${key}" doit avoir une valeur texte.`);
    }
    out[key] = entry;
  }
  return out;
}

function asStringArrayRecord(value: unknown, where: string): Record<string, string[]> {
  if (value === null || value === undefined) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${where} : attendu un dictionnaire.`);
  }
  const out: Record<string, string[]> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!Array.isArray(entry) || entry.some((item) => typeof item !== "string")) {
      throw new Error(`${where} : la cle "${key}" doit avoir une liste de textes.`);
    }
    out[key] = entry as string[];
  }
  return out;
}

// --- Normalisation ---------------------------------------------------------

/**
 * `trim()` sur tous les champs texte (decision Q5). C'est de la normalisation
 * d'espaces, pas une modification de contenu — mais elle est tracee dans le
 * rapport d'import, champ par champ, avec le `code` concerne.
 */
export function trimText(value: string): string {
  return value.trim();
}

/**
 * Forme normalisee d'un tag : casefold, sans accent, sans ponctuation.
 * C'est la cle de deduplication, la cle d'unicite et la valeur du filtre dans
 * l'URL. JAMAIS appliquee a `rooms.code` (ADR-0001 Q1).
 */
export function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      // Retire les diacritiques laisses par la decomposition NFD.
      // `\p{Diacritic}` plutot qu'une plage de caracteres combinants : la plage
      // s'ecrit avec des caracteres invisibles a la relecture, qui ne survivent pas
      // toujours a un copier-coller ou a un outil de formatage.
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}

/** Applique `rename` puis `merge`. Retourne la forme d'affichage retenue. */
export function applyMapping(rawValue: string, mapping: Mapping): string {
  const trimmed = trimText(rawValue);

  const renamed = mapping.rename[trimmed] ?? trimmed;

  for (const [canonicalForm, variants] of Object.entries(mapping.merge)) {
    if (canonicalForm === renamed || variants.includes(renamed)) {
      return canonicalForm;
    }
  }
  return renamed;
}

// --- Resolution des tags ---------------------------------------------------

export type TagKind = "technology" | "tool" | "skill";

export type ResolvedTag = { kind: TagKind; slug: string; name: string };

export type SlugCollision = {
  kind: TagKind;
  slug: string;
  /** Formes d'affichage distinctes qui retombent sur le meme slug. */
  names: string[];
};

/**
 * Construit la table des tags a partir des rooms, et DETECTE LES COLLISIONS.
 *
 * Une collision de slug signifie que deux valeurs distinctes ne feront qu'une
 * seule ligne en base. Il faut alors decider laquelle atterrit dans `tags.name`.
 *
 * Sans declaration explicite, la reponse serait « la premiere rencontree »,
 * donc l'ORDRE DE PARCOURS des rooms. Le dataset etant trie par `code`, c'est
 * stable aujourd'hui — mais au prochain scrape, si l'ordre change ou si une room
 * disparait, le nom affiche bascule d'une variante a l'autre. Le rapport
 * signalerait une modification que personne ne saurait expliquer, et on
 * chercherait un bug qui n'existe pas.
 *
 * D'ou la regle : toute collision exige une entree dans `canonical:`. Sinon
 * l'import refuse de tourner. Meme philosophie que le garde des 5 % : quand deux
 * donnees se contredisent, on s'arrete, on ne devine pas.
 */
export function resolveTags(
  rooms: readonly RoomSource[],
  mapping: Mapping,
): { tags: ResolvedTag[]; collisions: SlugCollision[]; unresolved: SlugCollision[] } {
  const facets: Array<{ kind: TagKind; field: "technologies" | "tools" | "skills" }> = [
    { kind: "technology", field: "technologies" },
    { kind: "tool", field: "tools" },
    { kind: "skill", field: "skills" },
  ];

  const bySlug = new Map<string, { kind: TagKind; slug: string; names: Set<string> }>();

  for (const { kind, field } of facets) {
    for (const room of rooms) {
      for (const rawValue of room[field] ?? []) {
        const trimmed = trimText(rawValue);
        // "N/A" est une absence, jamais un tag.
        if (trimmed === "" || trimmed.toUpperCase() === "N/A") continue;

        const name = applyMapping(rawValue, mapping);
        const slug = slugify(name);
        if (slug === "") continue;

        const key = `${kind}:${slug}`;
        const existing = bySlug.get(key);
        if (existing) {
          existing.names.add(name);
        } else {
          bySlug.set(key, { kind, slug, names: new Set([name]) });
        }
      }
    }
  }

  const tags: ResolvedTag[] = [];
  const collisions: SlugCollision[] = [];
  const unresolved: SlugCollision[] = [];

  // Tri par cle : l'ordre de sortie ne doit dependre d'aucun parcours.
  for (const key of [...bySlug.keys()].sort()) {
    const entry = bySlug.get(key);
    if (!entry) continue;

    const names = [...entry.names].sort();
    const declared = mapping.canonical[entry.slug];

    if (names.length > 1) {
      collisions.push({ kind: entry.kind, slug: entry.slug, names });
      if (declared === undefined) {
        unresolved.push({ kind: entry.kind, slug: entry.slug, names });
        continue;
      }
    }

    tags.push({
      kind: entry.kind,
      slug: entry.slug,
      // Forme declaree si elle existe, sinon l'unique nom. JAMAIS names[0] sur
      // une collision : ce serait revenir a « le premier rencontre ».
      name: declared ?? names[0] ?? entry.slug,
    });
  }

  return { tags, collisions, unresolved };
}

/** Les tags d'une room, dedupliques, dans l'ordre des slugs. */
export function roomTagSlugs(
  room: RoomSource,
  mapping: Mapping,
): Array<{ kind: TagKind; slug: string }> {
  const facets: Array<{ kind: TagKind; field: "technologies" | "tools" | "skills" }> = [
    { kind: "technology", field: "technologies" },
    { kind: "tool", field: "tools" },
    { kind: "skill", field: "skills" },
  ];

  const seen = new Set<string>();
  const out: Array<{ kind: TagKind; slug: string }> = [];

  for (const { kind, field } of facets) {
    for (const rawValue of room[field] ?? []) {
      const trimmed = trimText(rawValue);
      if (trimmed === "" || trimmed.toUpperCase() === "N/A") continue;
      const slug = slugify(applyMapping(rawValue, mapping));
      if (slug === "") continue;
      const key = `${kind}:${slug}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind, slug });
    }
  }
  return out;
}

export { EMPTY_MAPPING };
