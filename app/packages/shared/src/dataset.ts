import { z } from "zod";

/**
 * Contrat de donnees entre le scraper de Malick et l'importer.
 *
 * REGLE ABSOLUE : `data/datasets/rooms.schema.json` (JSON Schema draft 2020-12)
 * FAIT FOI. Ce fichier en est la transcription Zod, pas une reinterpretation.
 * Toute divergence est un bug de ce fichier, jamais du JSON Schema.
 *
 * Les ecarts assumes sont listes en bas de fichier, dans CONTRACT_NOTES, et
 * repris dans le rapport d'audit pour qu'ils restent visibles.
 */

// --- Valeurs fermees -------------------------------------------------------

export const DIFFICULTIES = ["info", "easy", "medium", "hard", "insane"] as const;
export const ROOM_TYPES = ["walkthrough", "challenge"] as const;
export const TEAMS = ["Red", "Blue", "Purple"] as const;

export const DifficultySchema = z.enum(DIFFICULTIES);
export const RoomTypeSchema = z.enum(ROOM_TYPES);
export const TeamSchema = z.enum(TEAMS);

export type Difficulty = z.infer<typeof DifficultySchema>;
export type RoomType = z.infer<typeof RoomTypeSchema>;
export type Team = z.infer<typeof TeamSchema>;

/**
 * Ordre pedagogique des difficultes. Le JSON Schema ne definit qu'un ensemble
 * non ordonne : l'ordre est une decision de notre cote, materialisee en base par
 * `difficulties.level` (cf. phase 3). Une enum texte seule ne permet pas de trier.
 */
export const DIFFICULTY_LEVEL: Readonly<Record<Difficulty, number>> = {
  info: 0,
  easy: 1,
  medium: 2,
  hard: 3,
  insane: 4,
};

// --- Motifs imposes par le JSON Schema -------------------------------------

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const CHECKSUM_PATTERN = /^sha256:[0-9a-f]{64}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ROOM_URL_PATTERN = /^https:\/\/tryhackme\.com\/room\//;

// --- Room ------------------------------------------------------------------

/**
 * Une room telle que livree par le scraper : BRUTE.
 *
 * Ce schema ne normalise rien et ne corrige rien. Les titres a espaces
 * parasites, les outils suffixes " NEW" et la technologie litterale "N/A"
 * passent la validation : ce sont des anomalies de qualite, pas des violations
 * de contrat. Leur traitement releve des mappings versionnes, jamais d'ici.
 *
 * `strictObject` : le JSON Schema declare `additionalProperties: false` sur les
 * items de `rooms`. Un champ inconnu est donc un rejet, pas un avertissement.
 */
export const RoomSourceSchema = z.strictObject({
  /** Cle primaire naturelle. Stable, unique, jamais le titre. */
  code: z.string().min(1).max(128),
  title: z.string().min(1),
  description: z.string().optional(),
  difficulty: DifficultySchema,
  type: RoomTypeSchema,
  durationMinutes: z.int().min(0).nullable().optional(),
  usersCount: z.int().min(0).nullable().optional(),
  /**
   * Date de (re)publication, pas de creation. Peu fiable : ne rien en deduire.
   * Exposee telle quelle.
   */
  publishedAt: z.string().regex(DATE_PATTERN).nullable().optional(),
  teams: z.array(TeamSchema).max(3).optional(),
  skills: z.array(z.string()).optional(),
  technologies: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  url: z.string().regex(ROOM_URL_PATTERN),
});

export type RoomSource = z.infer<typeof RoomSourceSchema>;

// --- Meta ------------------------------------------------------------------

/**
 * `looseObject` volontaire : le JSON Schema ne declare PAS
 * `additionalProperties: false` sur `meta` (contrairement a la racine et aux
 * items de `rooms`). Etre plus strict ici divergerait du contrat.
 *
 * Consequence a connaitre : le scraper peut ajouter des cles dans `meta` sans
 * etre rejete. L'audit les signale. C'est un point a trancher pour la v2 du
 * schema, cf. CONTRACT_NOTES.
 */
export const DatasetMetaSchema = z.looseObject({
  datasetVersion: z.string().regex(SEMVER_PATTERN),
  scrapedAt: z.string(),
  source: z.string(),
  scope: z.string().optional(),
  totalRoomsInCatalog: z.int().min(0).optional(),
  catalogCountReportedByApi: z.int().min(0).optional(),
  freeRoomsCount: z.int().min(0),
  /**
   * DECLASSE EN INFORMATIF (decision D2). L'integrite est verifiee par le
   * fichier voisin `rooms.v1.json.sha256`, qui porte sur les OCTETS BRUTS et
   * ne souffre d'aucune ambiguite de serialisation. Ce champ reste valide sur
   * sa forme mais ne bloque plus l'import. Il disparaitra en v2.
   */
  checksum: z.string().regex(CHECKSUM_PATTERN),
  checksumAlgorithm: z.string().optional(),
  notes: z.array(z.string()).optional(),
});

export type DatasetMeta = z.infer<typeof DatasetMetaSchema>;

// --- Dataset ---------------------------------------------------------------

export const DatasetSchema = z.strictObject({
  meta: DatasetMetaSchema,
  rooms: z.array(RoomSourceSchema).min(1),
});

export type Dataset = z.infer<typeof DatasetSchema>;

// --- Ecarts assumes vis-a-vis du JSON Schema -------------------------------

/**
 * Divergences connues entre ce contrat Zod et `rooms.schema.json`, avec leur
 * justification. Reprises telles quelles dans le rapport d'audit : un ecart tu
 * est un ecart qui devient faux.
 */
export const CONTRACT_NOTES: readonly string[] = [
  "`meta` accepte des cles non declarees : le JSON Schema ne pose pas " +
    "`additionalProperties: false` dessus, contrairement a la racine et aux items de `rooms`. " +
    "A trancher pour la v2 du schema (zone partagee Malick/Nel).",
  "Les `format` du JSON Schema (`date-time` sur `meta.scrapedAt`, `uri` sur `room.url`) ne sont " +
    "PAS transformes en assertions Zod. En draft 2020-12, `format` est une annotation, pas une " +
    "contrainte, sauf vocabulaire d'assertion active. Les rendre bloquants nous ferait rejeter " +
    "des donnees que le contrat autorise. L'audit les signale comme anomalies de qualite.",
  "`room.url` reste contraint par son `pattern` (`^https://tryhackme.com/room/`), qui est bien " +
    "une assertion du JSON Schema.",
  "Aucune normalisation dans ce schema : trim, fusion d'outils et mapping sont la charge de " +
    "l'importer, via des fichiers versionnes. La donnee source doit rester rejouable.",
];
