import { createHash } from "node:crypto";
import type { Dataset, RoomSource } from "@thm/shared";

/**
 * Analyse du dataset brut. AUCUNE CORRECTION N'EST APPLIQUEE ICI.
 * Ce module observe et compte ; il ne modifie jamais une donnee.
 * Les corrections passent par `data/mappings/`, valides a la main.
 *
 * Isole du CLI pour que le test Vitest de la phase 4 importe exactement les
 * memes fonctions que le rapport, sans dupliquer la logique de comptage.
 */

// --- Normalisation des outils (regle officielle, cf. reponses phase 1) -----

/**
 * Regle de normalisation des noms d'outils, dans cet ordre exact :
 *   1. retrait du suffixe d'affichage  /\s*-?\s*NEW$/i
 *   2. trim()
 *   3. comparaison casefold() pour detecter un jumeau
 *
 * C'est elle, et elle seule, qui decide `merge` (le retrait retombe sur une
 * forme deja presente) ou `rename` (aucun jumeau, orphelin).
 *
 * Le tiret est indispensable : sans lui, "Empire - NEW" donne "Empire -" et
 * son jumeau "Empire" n'est jamais trouve.
 */
export const NEW_SUFFIX_PATTERN = /\s*-?\s*NEW$/i;

export function stripNewSuffix(tool: string): string {
  return tool.replace(NEW_SUFFIX_PATTERN, "").trim();
}

export function casefold(value: string): string {
  return value.trim().toLowerCase();
}

// --- Comptage --------------------------------------------------------------

export type Counter = ReadonlyMap<string, number>;

function count(values: readonly string[]): Counter {
  const map = new Map<string, number>();
  for (const value of values) {
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return map;
}

function get(counter: Counter, key: string): number {
  return counter.get(key) ?? 0;
}

export function sortedEntries(counter: Counter): Array<[string, number]> {
  return [...counter.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

const facet = (rooms: readonly RoomSource[], key: "skills" | "technologies" | "tools"): string[] =>
  rooms.flatMap((room) => room[key] ?? []);

// --- Statistiques de controle ---------------------------------------------

export type Stats = {
  roomCount: number;
  byDifficulty: Counter;
  byType: Counter;
  byTeam: Counter;
  roomsWithoutTeam: number;
  technologies: Counter;
  distinctTechnologies: number;
  tools: Counter;
  distinctTools: number;
  skills: Counter;
  distinctSkills: number;
  totalDurationMinutes: number;
  roomsWithoutDuration: number;
};

export function computeStats(rooms: readonly RoomSource[]): Stats {
  const durations = rooms
    .map((room) => room.durationMinutes)
    .filter((value): value is number => typeof value === "number");

  const technologies = count(facet(rooms, "technologies"));
  const tools = count(facet(rooms, "tools"));
  const skills = count(facet(rooms, "skills"));

  return {
    roomCount: rooms.length,
    byDifficulty: count(rooms.map((room) => room.difficulty)),
    byType: count(rooms.map((room) => room.type)),
    byTeam: count(rooms.flatMap((room) => room.teams ?? [])),
    roomsWithoutTeam: rooms.filter((room) => (room.teams ?? []).length === 0).length,
    technologies,
    distinctTechnologies: technologies.size,
    tools,
    distinctTools: tools.size,
    skills,
    distinctSkills: skills.size,
    totalDurationMinutes: durations.reduce((sum, value) => sum + value, 0),
    roomsWithoutDuration: rooms.length - durations.length,
  };
}

/**
 * Valeurs de controle VERIFIEES sur `rooms.v1.json` (dataset 1.0.0,
 * sha256 15b1dd50...). Ce sont les chiffres du rapport d'audit qui font foi,
 * pas ceux du §5 du brief : trois d'entre eux y etaient faux.
 *
 * Toute divergence signifie l'une de deux choses, jamais autre chose :
 *   - le dataset a change (nouveau scrape) -> mettre a jour ces constantes
 *     dans le meme commit que le nouveau dataset, en le justifiant ;
 *   - le code de comptage a regresse -> corriger le code.
 */
export const EXPECTED = {
  roomCount: 714,
  difficulty: { easy: 364, medium: 262, hard: 62, info: 18, insane: 8 },
  type: { walkthrough: 360, challenge: 354 },
  team: { Red: 393, Blue: 201, Purple: 80 },
  roomsWithoutTeam: 54,
  technologies: { Linux: 375, Web: 180, Windows: 116 },
  distinctTechnologies: 15,
  tools: { Nmap: 112, "Burp Suite": 47, Gobuster: 33 },
  distinctTools: 186,
  distinctSkills: 103,
  totalDurationMinutes: 53426,
} as const;

export type Check = { label: string; expected: number; actual: number; ok: boolean };

export function runControlChecks(stats: Stats): Check[] {
  const checks: Check[] = [];
  const add = (label: string, expected: number, actual: number): void => {
    checks.push({ label, expected, actual, ok: expected === actual });
  };

  add("rooms au total", EXPECTED.roomCount, stats.roomCount);
  for (const [key, expected] of Object.entries(EXPECTED.difficulty)) {
    add(`difficulte : ${key}`, expected, get(stats.byDifficulty, key));
  }
  for (const [key, expected] of Object.entries(EXPECTED.type)) {
    add(`type : ${key}`, expected, get(stats.byType, key));
  }
  for (const [key, expected] of Object.entries(EXPECTED.team)) {
    add(`equipe : ${key}`, expected, get(stats.byTeam, key));
  }
  add("rooms sans equipe", EXPECTED.roomsWithoutTeam, stats.roomsWithoutTeam);
  for (const [key, expected] of Object.entries(EXPECTED.technologies)) {
    add(`technologie : ${key}`, expected, get(stats.technologies, key));
  }
  add("technologies distinctes", EXPECTED.distinctTechnologies, stats.distinctTechnologies);
  for (const [key, expected] of Object.entries(EXPECTED.tools)) {
    add(`outil : ${key}`, expected, get(stats.tools, key));
  }
  add("outils distincts", EXPECTED.distinctTools, stats.distinctTools);
  add("competences distinctes", EXPECTED.distinctSkills, stats.distinctSkills);
  add("duree cumulee (minutes)", EXPECTED.totalDurationMinutes, stats.totalDurationMinutes);

  return checks;
}

// --- Anomalies -------------------------------------------------------------

export type Severity = "bloquant" | "a-traiter" | "informatif";

export type Anomaly = {
  id: string;
  title: string;
  severity: Severity;
  count: number;
  treatment: string;
  /** Echantillon lisible. Jamais tronque silencieusement : voir `truncated`. */
  samples: string[];
  truncated: number;
};

const SAMPLE_LIMIT = 20;

function anomaly(
  id: string,
  title: string,
  severity: Severity,
  items: readonly string[],
  treatment: string,
): Anomaly {
  return {
    id,
    title,
    severity,
    count: items.length,
    treatment,
    samples: items.slice(0, SAMPLE_LIMIT),
    truncated: Math.max(0, items.length - SAMPLE_LIMIT),
  };
}

export type ToolPair = { canonical: string; variants: string[]; occurrences: number[] };

/**
 * Applique la regle de normalisation et separe les deux cas.
 * Ne modifie rien : produit la liste des decisions a inscrire dans le mapping.
 */
export function analyseToolNames(rooms: readonly RoomSource[]): {
  merges: ToolPair[];
  renames: Array<{ from: string; to: string; occurrences: number }>;
  spelling: ToolPair[];
} {
  const occurrences = facet(rooms, "tools");
  const distinct = [...new Set(occurrences)];
  const occurrencesOf = (tool: string): number => occurrences.filter((t) => t === tool).length;

  const byFold = new Map<string, string[]>();
  for (const tool of distinct) {
    const key = casefold(tool);
    byFold.set(key, [...(byFold.get(key) ?? []), tool]);
  }

  const merges: ToolPair[] = [];
  const renames: Array<{ from: string; to: string; occurrences: number }> = [];

  for (const tool of distinct.filter((t) => NEW_SUFFIX_PATTERN.test(t))) {
    const stripped = stripNewSuffix(tool);
    const twins = (byFold.get(casefold(stripped)) ?? []).filter((t) => t !== tool);
    if (twins.length > 0) {
      merges.push({
        canonical: stripped,
        variants: [...twins, tool],
        occurrences: [...twins, tool].map(occurrencesOf),
      });
    } else {
      renames.push({ from: tool, to: stripped, occurrences: occurrencesOf(tool) });
    }
  }

  /**
   * Fautes de frappe averees. Liste CLOSE et saisie a la main : aucune
   * detection automatique par distance d'edition ne sera appliquee, parce
   * qu'elle fusionnerait LinPeas/WinPeas et LECmd.exe/PECmd.exe, qui sont des
   * outils reellement distincts.
   */
  const spellingPairs: Array<[string, string]> = [
    ["Burp Suite", "Burpe Suite"],
    ["Autopsy", "Autospy"],
  ];
  const spelling: ToolPair[] = spellingPairs
    .filter(([a, b]) => distinct.includes(a) && distinct.includes(b))
    .map(([a, b]) => ({ canonical: a, variants: [a, b], occurrences: [a, b].map(occurrencesOf) }));

  return { merges, renames, spelling };
}

export function detectAnomalies(dataset: Dataset): Anomaly[] {
  const { rooms, meta } = dataset;
  const out: Anomaly[] = [];

  // --- Espaces parasites ---------------------------------------------------
  out.push(
    anomaly(
      "titres-espaces",
      "Titres avec espaces de debut ou de fin",
      "a-traiter",
      rooms
        .filter((r) => r.title !== r.title.trim())
        .map((r) => `${r.code} : ${JSON.stringify(r.title)}`),
      "trim() a l'import. Sans risque, mais liste ici pour tracabilite.",
    ),
  );
  out.push(
    anomaly(
      "descriptions-espaces",
      "Descriptions avec espaces de debut ou de fin",
      "a-traiter",
      rooms
        .filter((r) => r.description && r.description !== r.description.trim())
        .map((r) => r.code),
      "trim() a l'import. NON SIGNALE dans le brief : trouve par l'audit.",
    ),
  );

  // --- Absences assumees ---------------------------------------------------
  const absences: Array<[string, string, (r: RoomSource) => boolean]> = [
    ["technologie", "Rooms sans technologie", (r) => (r.technologies ?? []).length === 0],
    ["competence", "Rooms sans competence", (r) => (r.skills ?? []).length === 0],
    ["equipe", "Rooms sans equipe", (r) => (r.teams ?? []).length === 0],
    ["outil", "Rooms sans outil", (r) => (r.tools ?? []).length === 0],
  ];
  for (const [id, title, predicate] of absences) {
    out.push(
      anomaly(
        `sans-${id}`,
        title,
        "informatif",
        rooms.filter(predicate).map((r) => r.code),
        "NE RIEN INVENTER. Absence assumee, exposee comme facette « non renseigne ».",
      ),
    );
  }

  out.push(
    anomaly(
      "description-vide",
      "Description vide",
      "a-traiter",
      rooms
        .filter((r) => !r.description || r.description.trim() === "")
        .map((r) => `${r.code} (${r.title.trim()})`),
      "NE PAS inventer de texte. La fiche affiche l'absence explicitement.",
    ),
  );

  // --- Sentinelles ---------------------------------------------------------
  out.push(
    anomaly(
      "techno-na",
      'Technologie litterale "N/A"',
      "a-traiter",
      rooms.filter((r) => (r.technologies ?? []).includes("N/A")).map((r) => r.code),
      'Traiter comme une absence, jamais comme un tag. "N/A" ne doit pas apparaitre dans les facettes.',
    ),
  );

  // --- Durees hors norme ---------------------------------------------------
  out.push(
    anomaly(
      "durees-evenement",
      "Durees >= 1337 minutes (format evenement)",
      "informatif",
      rooms
        .filter((r) => (r.durationMinutes ?? 0) >= 1337)
        .map((r) => `${r.code} : ${r.durationMinutes} min (${r.title.trim()})`),
      "NE PAS corriger. Evenements de 24 jours. Exclure des moyennes, marquer « format evenement ».",
    ),
  );

  // --- Noms d'outils -------------------------------------------------------
  const { merges, renames, spelling } = analyseToolNames(rooms);
  const newOccurrences = facet(rooms, "tools").filter((t) => NEW_SUFFIX_PATTERN.test(t));
  out.push(
    anomaly(
      "outils-new",
      `Outils portant le suffixe d'affichage " NEW"`,
      "a-traiter",
      [
        ...merges.map((m) => `MERGE  ${JSON.stringify(m.variants)} -> "${m.canonical}"`),
        ...renames.map(
          (r) => `RENAME "${r.from}" -> "${r.to}" (${r.occurrences} occ., aucun jumeau)`,
        ),
      ],
      `${merges.length + renames.length} valeurs distinctes, ${newOccurrences.length} occurrences, ` +
        `${rooms.filter((r) => (r.tools ?? []).some((t) => NEW_SUFFIX_PATTERN.test(t))).length} rooms. ` +
        "A traiter par data/mappings/normalisation-outils.yaml, jamais en dur dans le code.",
    ),
  );
  out.push(
    anomaly(
      "outils-espaces",
      "Outils avec espace parasite",
      "a-traiter",
      [...new Set(facet(rooms, "tools"))]
        .filter((t) => t !== t.trim())
        .map((t) => JSON.stringify(t)),
      "trim() a l'import.",
    ),
  );
  out.push(
    anomaly(
      "outils-orthographe",
      "Fautes de frappe sur des noms d'outils",
      "a-traiter",
      spelling.map(
        (p) =>
          `${JSON.stringify(p.variants)} (${p.occurrences.join(" / ")} occ.) -> "${p.canonical}"`,
      ),
      "Liste close, saisie a la main. AUCUNE detection par distance d'edition : elle fusionnerait " +
        "LinPeas/WinPeas et LECmd.exe/PECmd.exe, qui sont des outils distincts.",
    ),
  );

  // --- Integrite des cles --------------------------------------------------
  const codes = rooms.map((r) => r.code);
  const duplicateCodes = codes.filter((code, index) => codes.indexOf(code) !== index);
  out.push(
    anomaly(
      "codes-dupliques",
      "Codes dupliques",
      "bloquant",
      [...new Set(duplicateCodes)],
      "`code` est la cle primaire. Un doublon invalide le dataset : l'import doit refuser de tourner.",
    ),
  );

  const titleGroups = new Map<string, string[]>();
  for (const room of rooms) {
    const key = room.title.trim();
    titleGroups.set(key, [...(titleGroups.get(key) ?? []), room.code]);
  }
  out.push(
    anomaly(
      "titres-identiques",
      "Titres identiques portes par des codes distincts",
      "informatif",
      [...titleGroups.entries()]
        .filter(([, list]) => list.length > 1)
        .map(([title, list]) => `${JSON.stringify(title)} -> ${list.join(", ")}`),
      "CE NE SONT PAS DES DOUBLONS. Ne jamais dedupliquer sur le titre. " +
        "C'est aussi la raison pour laquelle on route sur `code` et non sur un slug derive du titre.",
    ),
  );

  out.push(
    anomaly(
      "url-incoherente",
      "URL incoherente avec le code",
      "bloquant",
      rooms
        .filter((r) => r.url !== `https://tryhackme.com/room/${r.code}`)
        .map((r) => `${r.code} -> ${r.url}`),
      "L'URL doit se deduire du code. Une divergence casse le lien sortant vers TryHackMe.",
    ),
  );

  // --- Dates ---------------------------------------------------------------
  out.push(
    anomaly(
      "publishedat-2026",
      "Rooms datees 2026",
      "informatif",
      rooms.filter((r) => r.publishedAt?.startsWith("2026")).map((r) => r.code),
      "`publishedAt` est une date de republication, pas de creation. Exposer tel quel, " +
        "n'en tirer aucune conclusion, ne pas s'en servir pour trier par nouveaute.",
    ),
  );

  // --- Contrat -------------------------------------------------------------
  const knownMetaKeys = new Set([
    "datasetVersion",
    "scrapedAt",
    "source",
    "scope",
    "totalRoomsInCatalog",
    "catalogCountReportedByApi",
    "freeRoomsCount",
    "checksum",
    "checksumAlgorithm",
    "notes",
  ]);
  out.push(
    anomaly(
      "meta-cles-inconnues",
      "Cles non declarees dans `meta`",
      "informatif",
      Object.keys(meta).filter((key) => !knownMetaKeys.has(key)),
      "Le JSON Schema ne pose pas `additionalProperties: false` sur `meta` : ces cles sont " +
        "acceptees par le contrat. A trancher pour la v2 du schema.",
    ),
  );

  const scrapedAtValid =
    !Number.isNaN(Date.parse(meta.scrapedAt)) && /^\d{4}-\d{2}-\d{2}T/.test(meta.scrapedAt);
  out.push(
    anomaly(
      "meta-scrapedat-format",
      "`meta.scrapedAt` non conforme au format date-time",
      "a-traiter",
      scrapedAtValid ? [] : [JSON.stringify(meta.scrapedAt)],
      "`format` est une annotation en draft 2020-12, pas une assertion : Zod ne bloque pas. " +
        "Signale ici pour que l'ecart reste visible.",
    ),
  );

  // --- Ordre ---------------------------------------------------------------
  const sorted = [...codes].sort();
  out.push(
    anomaly(
      "rooms-non-triees",
      "Rooms non triees par code croissant",
      "informatif",
      codes.every((code, index) => code === sorted[index])
        ? []
        : ["l'ordre du tableau `rooms` diverge"],
      "Le contrat annonce un tri par `code` croissant. Un ordre stable rend les diffs lisibles.",
    ),
  );

  return out;
}

// --- Integrite -------------------------------------------------------------

export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Recalcule `meta.checksum` selon la definition historique :
 * sha256 de JSON.stringify(rooms), cles triees RECURSIVEMENT, separateurs compacts.
 *
 * Conserve uniquement pour verifier a titre INFORMATIF que le champ herite reste
 * coherent. L'integrite qui bloque, c'est le sidecar sur octets bruts (D2) :
 * cette definition-ci est ambigue sur le tri, l'encodage et la normalisation
 * Unicode, et cassera le jour ou un titre contiendra un caractere non-ASCII.
 */
export function recomputeMetaChecksum(rooms: readonly RoomSource[]): string {
  const sortKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value !== null && typeof value === "object") {
      const source = value as Record<string, unknown>;
      const target: Record<string, unknown> = {};
      for (const key of Object.keys(source).sort()) target[key] = sortKeys(source[key]);
      return target;
    }
    return value;
  };
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(sortKeys(rooms)), "utf8")
    .digest("hex")}`;
}
