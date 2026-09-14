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

// --- Journal des tags -------------------------------------------------------

/** Ce qui arrive a une valeur brute entre le dataset et la table `tags`. */
export type TagFate =
  | "conservee"
  | "renommee"
  | "absorbee"
  | "ecartee-absence"
  | "ecartee-slug-vide";

export type TagLedgerEntry = {
  kind: TagKind;
  /** La valeur telle que le dataset l'ecrit, espaces parasites compris. */
  raw: string;
  /** Forme d'affichage retenue, ou `null` si la valeur est ecartee. */
  name: string | null;
  slug: string | null;
  fate: TagFate;
  occurrences: number;
};

export type TagFusion = {
  kind: TagKind;
  slug: string;
  name: string;
  /** Les ecritures source qui convergent, avec leurs occurrences. */
  sources: Array<{ raw: string; occurrences: number }>;
};

export type TagKindLedger = {
  kind: TagKind;
  /** Valeurs brutes DISTINCTES rencontrees dans le dataset. */
  incoming: number;
  /** Ecartees comme absence : chaine vide ou `N/A`. */
  discardedAbsence: number;
  /** Ecartees parce que leur slug serait vide. Anomalie : aucune aujourd'hui. */
  discardedEmptySlug: number;
  /** Valeurs absorbees par une autre : `n` ecritures pour un tag valent `n - 1`. */
  absorbed: number;
  /** Tags reellement produits. */
  resulting: number;
  /** `incoming - discarded - absorbed === resulting`. */
  reconciled: boolean;
};

export type TagLedger = {
  byKind: TagKindLedger[];
  entries: TagLedgerEntry[];
  fusions: TagFusion[];
  /** Renommages sans fusion : le libelle change, le compte ne bouge pas. */
  renames: Array<{ kind: TagKind; from: string; to: string; occurrences: number }>;
  totals: Omit<TagKindLedger, "kind">;
  /** Faux si une seule facette ne se reconcilie pas. Bloquant a l'import. */
  reconciled: boolean;
};

const FACETS: ReadonlyArray<{ kind: TagKind; field: "technologies" | "tools" | "skills" }> = [
  { kind: "technology", field: "technologies" },
  { kind: "tool", field: "tools" },
  { kind: "skill", field: "skills" },
];

/** `N/A` et la chaine vide sont des ABSENCES, jamais des tags. */
function isAbsence(trimmed: string): boolean {
  return trimmed === "" || trimmed.toUpperCase() === "N/A";
}

/**
 * Compte ce que la normalisation fait aux tags, valeur par valeur.
 *
 * POURQUOI CE JOURNAL EXISTE. L'union brute des trois facettes contient 304
 * valeurs distinctes et la base en contient 296. L'ecart est entierement
 * explique — 1 technologie `N/A` ecartee comme absence, 7 outils absorbes par
 * les `merge` du mapping — mais il n'etait ecrit nulle part, et un chiffre qui
 * baisse sans explication est exactement ce que la regle « aucune modification
 * silencieuse des donnees » interdit.
 *
 * Ce calcul est VOLONTAIREMENT independant de `resolveTags` : il repart des
 * rooms. Deux chemins qui tombent sur le meme nombre valent mieux qu'un seul
 * chemin qui se raconte a lui-meme qu'il a raison. L'import compare les deux et
 * refuse de tourner s'ils divergent.
 */
export function buildTagLedger(rooms: readonly RoomSource[], mapping: Mapping): TagLedger {
  const entries: TagLedgerEntry[] = [];
  const fusions: TagFusion[] = [];
  const renames: TagLedger["renames"] = [];
  const byKind: TagKindLedger[] = [];

  for (const { kind, field } of FACETS) {
    // Occurrences par valeur BRUTE, sans aucune transformation prealable.
    const occurrences = new Map<string, number>();
    for (const room of rooms) {
      for (const rawValue of room[field] ?? []) {
        occurrences.set(rawValue, (occurrences.get(rawValue) ?? 0) + 1);
      }
    }

    // Regroupement par slug d'arrivee : c'est la que se voient les fusions.
    const groups = new Map<string, { name: string; sources: string[] }>();
    let discardedAbsence = 0;
    let discardedEmptySlug = 0;

    for (const raw of [...occurrences.keys()].sort()) {
      const count = occurrences.get(raw) ?? 0;

      if (isAbsence(trimText(raw))) {
        discardedAbsence += 1;
        entries.push({
          kind,
          raw,
          name: null,
          slug: null,
          fate: "ecartee-absence",
          occurrences: count,
        });
        continue;
      }

      const name = applyMapping(raw, mapping);
      const slug = slugify(name);

      if (slug === "") {
        discardedEmptySlug += 1;
        entries.push({
          kind,
          raw,
          name,
          slug: null,
          fate: "ecartee-slug-vide",
          occurrences: count,
        });
        continue;
      }

      const group = groups.get(slug);
      if (group === undefined) groups.set(slug, { name, sources: [raw] });
      else group.sources.push(raw);
    }

    // Classement final : une valeur seule dans son groupe est conservee ou
    // renommee ; dans un groupe de plusieurs, une seule represente le tag.
    for (const slug of [...groups.keys()].sort()) {
      const group = groups.get(slug);
      if (group === undefined) continue;

      if (group.sources.length > 1) {
        fusions.push({
          kind,
          slug,
          name: group.name,
          sources: group.sources.map((raw) => ({
            raw,
            occurrences: occurrences.get(raw) ?? 0,
          })),
        });
      }

      for (const [index, raw] of group.sources.entries()) {
        const count = occurrences.get(raw) ?? 0;
        if (index > 0) {
          entries.push({ kind, raw, name: group.name, slug, fate: "absorbee", occurrences: count });
          continue;
        }
        const changed = raw !== group.name;
        entries.push({
          kind,
          raw,
          name: group.name,
          slug,
          fate: changed ? "renommee" : "conservee",
          occurrences: count,
        });
        if (changed && group.sources.length === 1) {
          renames.push({ kind, from: raw, to: group.name, occurrences: count });
        }
      }
    }

    const incoming = occurrences.size;
    const resulting = groups.size;
    const absorbed = [...groups.values()].reduce((sum, g) => sum + g.sources.length - 1, 0);

    byKind.push({
      kind,
      incoming,
      discardedAbsence,
      discardedEmptySlug,
      absorbed,
      resulting,
      reconciled: incoming - discardedAbsence - discardedEmptySlug - absorbed === resulting,
    });
  }

  const totals = byKind.reduce(
    (acc, k) => ({
      incoming: acc.incoming + k.incoming,
      discardedAbsence: acc.discardedAbsence + k.discardedAbsence,
      discardedEmptySlug: acc.discardedEmptySlug + k.discardedEmptySlug,
      absorbed: acc.absorbed + k.absorbed,
      resulting: acc.resulting + k.resulting,
      reconciled: acc.reconciled && k.reconciled,
    }),
    {
      incoming: 0,
      discardedAbsence: 0,
      discardedEmptySlug: 0,
      absorbed: 0,
      resulting: 0,
      reconciled: true,
    },
  );

  return { byKind, entries, fusions, renames, totals, reconciled: totals.reconciled };
}

export { EMPTY_MAPPING };
