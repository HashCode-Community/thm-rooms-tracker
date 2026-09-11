import { type SQL, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Schema PostgreSQL. SQL-first : on ecrit le schema qu'on veut, l'ORM s'y plie.
 *
 * Deux conventions de casse OPPOSEES coexistent ici volontairement.
 * Voir docs/adr/0001-arbitrages-initiaux.md, section Q1.
 *
 *   rooms.code  -> casse PRESERVEE  (identifiant externe, l'URL TryHackMe en depend)
 *   tags.slug   -> casse REPLIEE    (cle de deduplication interne)
 *
 * Ne pas « harmoniser ».
 */

// --- Types personnalises ---------------------------------------------------

/** `tsvector` natif. Aucun equivalent dans drizzle-orm/pg-core. */
const tsvector = customType<{ data: string; driverData: string }>({
  dataType: () => "tsvector",
});

/** `citext` : comparaison insensible a la casse cote base. Requiert l'extension. */
const citext = customType<{ data: string; driverData: string }>({
  dataType: () => "citext",
});

// --- Enums -----------------------------------------------------------------

export const tagKind = pgEnum("tag_kind", ["technology", "tool", "skill"]);

/**
 * Origine d'une categorisation. OBLIGATOIRE, expose par l'API, visible dans l'UI.
 *   thm     : fourni par TryHackMe
 *   derived : deduit MECANIQUEMENT des metadonnees du dataset
 *   manual  : saisi par un humain, y compris sur la base de connaissances externes
 *
 * `derived` n'est jamais utilise pour un jugement editorial : un regroupement
 * pedagogique releve de `manual`, meme s'il parait evident.
 */
export const categorySource = pgEnum("category_source", ["thm", "derived", "manual"]);

export const trackLevel = pgEnum("track_level", ["beginner", "intermediate", "advanced"]);
export const stepRoomRequirement = pgEnum("step_room_requirement", ["core", "optional", "bonus"]);
export const progressStatus = pgEnum("progress_status", ["todo", "in_progress", "done"]);

// --- Referentiels ----------------------------------------------------------

/**
 * `level` existe parce qu'une enum texte ne se trie pas : `easy` < `hard` en
 * alphabetique est un hasard, `medium` > `hard` est faux. L'ordre pedagogique
 * est une donnee, il lui faut une colonne.
 */
export const difficulties = pgTable("difficulties", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  level: smallint("level").notNull(),
});

export const roomTypes = pgTable("room_types", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
});

export const teams = pgTable("teams", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  /** Couleur d'accent. JAMAIS l'unique porteur d'information : cf. contraste AA. */
  color: text("color").notNull(),
});

// --- Catalogue -------------------------------------------------------------

export const rooms = pgTable(
  "rooms",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    /**
     * Cle primaire metier ET identifiant public (ADR-0001 Q1).
     *
     * `text`, SENSIBLE A LA CASSE. Surtout pas `citext` : 14 des 714 codes
     * contiennent des majuscules, et l'URL TryHackMe est sensible a la casse.
     * Un `citext` ferait passer `/rooms/aiforcyber-...` pour valide alors que
     * le lien sortant tomberait en 404.
     *
     * RIEN ne doit `.toLowerCase()` un code. Nulle part.
     */
    code: text("code").notNull().unique(),

    title: text("title").notNull(),
    description: text("description"),

    difficultyId: integer("difficulty_id")
      .notNull()
      .references(() => difficulties.id),
    roomTypeId: integer("room_type_id")
      .notNull()
      .references(() => roomTypes.id),

    durationMinutes: integer("duration_minutes"),
    usersCount: integer("users_count"),
    /** Date de REpublication, pas de creation. N'en tirer aucune conclusion. */
    publishedAt: date("published_at"),
    thmUrl: text("thm_url").notNull(),

    /**
     * Constante a `true` aujourd'hui : seules les 714 rooms gratuites sont
     * importees (ADR-0001 Q6). Conservee parce qu'une colonne booleenne coute
     * zero alors qu'une migration sur table peuplee, non.
     */
    isFree: boolean("is_free").notNull().default(true),

    /** Une room disparue du scrape est DESACTIVEE, jamais supprimee. */
    isActive: boolean("is_active").notNull().default(true),

    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),

    /**
     * Ligne source telle quelle, pour rejouer une transformation sans re-scraper.
     *
     * QUATRE REGLES, pas des intentions (ADR-0001 D5) :
     *   1. jamais dans un SELECT par defaut  -> utiliser `roomPublicColumns`
     *   2. jamais exposee par l'API
     *   3. jamais indexee
     *   4. jamais lue par le front
     */
    raw: jsonb("raw").notNull(),

    /**
     * Colonne generee : toujours coherente avec title/description, impossible a
     * desynchroniser. Poids A sur le titre, B sur la description.
     * 'english' en litteral explicite : `to_tsvector(regconfig, text)` est
     * IMMUTABLE, contrairement a la forme a un seul argument.
     */
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): SQL =>
        sql`setweight(to_tsvector('english', ${rooms.title}), 'A') || setweight(to_tsvector('english', coalesce(${rooms.description}, '')), 'B')`,
    ),
  },
  (table) => [
    index("rooms_search_vector_idx").using("gin", table.searchVector),
    // Tolerance aux fautes de frappe, en repli quand la recherche plein texte
    // ne ramene rien. Requiert l'extension pg_trgm.
    index("rooms_title_trgm_idx").using("gin", sql`${table.title} gin_trgm_ops`),
    index("rooms_difficulty_id_idx").on(table.difficultyId),
    index("rooms_room_type_id_idx").on(table.roomTypeId),
    index("rooms_active_free_idx").on(table.isActive, table.isFree),
    index("rooms_users_count_idx").on(table.usersCount),
  ],
);

/**
 * Colonnes de `rooms` exposables. Materialise la regle 1 de D5 : passer cet
 * objet a `.select()` rend impossible la fuite accidentelle de `raw` et de
 * `search_vector`, qui n'ont aucun sens cote client.
 */
export const roomPublicColumns = {
  id: rooms.id,
  code: rooms.code,
  title: rooms.title,
  description: rooms.description,
  difficultyId: rooms.difficultyId,
  roomTypeId: rooms.roomTypeId,
  durationMinutes: rooms.durationMinutes,
  usersCount: rooms.usersCount,
  publishedAt: rooms.publishedAt,
  thmUrl: rooms.thmUrl,
  isFree: rooms.isFree,
  isActive: rooms.isActive,
} as const;

/**
 * Technologies, outils et competences dans une seule table.
 *
 * Justification (ADR-0003) : les trois facettes ont un comportement STRICTEMENT
 * identique — liste plate, filtre OU intra-facette, comptage. Trois paires de
 * tables identiques seraient de la duplication pure, et chaque evolution
 * (compteurs, alias, description) devrait etre ecrite trois fois. `kind` porte
 * la seule difference reelle.
 *
 * `slug` est la forme CASEFOLD, sans espaces : c'est la cle de deduplication et
 * la valeur du parametre de filtre dans l'URL. `name` est cosmetique et se
 * change sans migration. Verifie : 180 outils produisent 179 slugs, l'unique
 * collision etant la paire qu'on veut fusionner.
 */
export const tags = pgTable(
  "tags",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    kind: tagKind("kind").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
  },
  (table) => [
    uniqueIndex("tags_kind_slug_idx").on(table.kind, table.slug),
    index("tags_kind_idx").on(table.kind),
  ],
);

export const roomTags = pgTable(
  "room_tags",
  {
    roomId: integer("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.tagId] }),
    // Indispensable : la PK indexe (room_id, tag_id), pas tag_id seul. Sans cet
    // index, filtrer par tag balaierait la table.
    index("room_tags_tag_id_idx").on(table.tagId),
  ],
);

export const roomTeams = pgTable(
  "room_teams",
  {
    roomId: integer("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.teamId] }),
    index("room_teams_team_id_idx").on(table.teamId),
  ],
);

// --- Categorisation metier -------------------------------------------------

export const categories = pgTable(
  "categories",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    /**
     * Auto-reference. `AnyPgColumn` est OBLIGATOIRE ici : sans lui, TypeScript
     * ne peut pas inferer le type d'une table qui se reference dans son propre
     * initialiseur (TS7022). C'est le pattern documente par Drizzle, pas un
     * contournement.
     */
    parentId: integer("parent_id").references((): AnyPgColumn => categories.id),
    position: integer("position").notNull().default(0),
  },
  (table) => [index("categories_parent_id_idx").on(table.parentId)],
);

export const roomCategories = pgTable(
  "room_categories",
  {
    roomId: integer("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    /** OBLIGATOIRE. Expose par l'API, visible dans l'UI. */
    source: categorySource("source").notNull(),
    /** Renseigne uniquement pour `derived`. NULL pour `thm` et `manual`. */
    confidence: numeric("confidence", { precision: 4, scale: 3 }),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.categoryId] }),
    index("room_categories_category_id_idx").on(table.categoryId),
  ],
);

// --- Roadmap ---------------------------------------------------------------

export const tracks = pgTable("tracks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary"),
  level: trackLevel("level").notNull(),
  position: integer("position").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(false),
});

export const trackSteps = pgTable(
  "track_steps",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    trackId: integer("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    objective: text("objective"),
    estimatedMinutes: integer("estimated_minutes"),
  },
  (table) => [uniqueIndex("track_steps_track_position_idx").on(table.trackId, table.position)],
);

export const stepRooms = pgTable(
  "step_rooms",
  {
    stepId: integer("step_id")
      .notNull()
      .references(() => trackSteps.id, { onDelete: "cascade" }),
    roomId: integer("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    requirement: stepRoomRequirement("requirement").notNull().default("core"),
    /**
     * Justification editoriale, redigee par nous. Ce n'est JAMAIS une donnee
     * TryHackMe : « faire X avant Y » est une recommandation, pas un prerequis
     * factuel. Le vocabulaire de l'UI doit le refleter.
     */
    note: text("note"),
  },
  (table) => [
    primaryKey({ columns: [table.stepId, table.roomId] }),
    index("step_rooms_room_id_idx").on(table.roomId),
  ],
);

// --- Utilisateur et progression --------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** `citext` ici EST justifie : une adresse e-mail n'a pas de casse signifiante. */
  email: citext("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userRoomProgress = pgTable(
  "user_room_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roomId: integer("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    status: progressStatus("status").notNull().default("todo"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    notes: text("notes"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.roomId] }),
    index("user_room_progress_room_id_idx").on(table.roomId),
  ],
);

/**
 * PAS de table `user_track_progress`.
 * L'avancement d'un parcours est CALCULE depuis `user_room_progress`. Stocker un
 * derive, c'est garantir qu'il se desynchronisera un jour — et ce jour-la, on ne
 * saura pas laquelle des deux valeurs est la bonne.
 */

// --- Tracabilite des imports -----------------------------------------------

export const importRuns = pgTable("import_runs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  datasetVersion: text("dataset_version").notNull(),
  /** SHA-256 des octets bruts du fichier source (ADR-0001 D2). */
  checksum: text("checksum").notNull(),
  roomsSeen: integer("rooms_seen").notNull().default(0),
  added: integer("added").notNull().default(0),
  updated: integer("updated").notNull().default(0),
  deactivated: integer("deactivated").notNull().default(0),
  report: jsonb("report"),
});
