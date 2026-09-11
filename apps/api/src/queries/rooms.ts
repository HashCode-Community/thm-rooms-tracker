import type { RoomFilters, SortKey } from "@thm/shared";
import { and, asc, countDistinct, eq, inArray, type SQL, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  categories,
  type categorySource,
  difficulties,
  roomCategories,
  rooms,
  roomTags,
  roomTeams,
  roomTypes,
  type stepRoomRequirement,
  stepRooms,
  tags,
  teams,
  trackSteps,
  tracks,
} from "../db/schema.js";
import { buildOrderBy, buildRoomConditions, resolveSearchStrategy } from "./room-filters.js";

/**
 * Requetes du catalogue.
 *
 * `rooms.id` n'est JAMAIS expose : l'identifiant public est `code` (ADR-0001 Q1).
 * `raw` et `search_vector` non plus — ils sont hors de `roomPublicColumns`, et ce
 * module ne selectionne que des colonnes nommees une a une.
 */

/** Reprend les enums PostgreSQL, pas un `string` qui perdrait l'information. */
export type CategorySource = (typeof categorySource.enumValues)[number];
export type StepRequirement = (typeof stepRoomRequirement.enumValues)[number];

export type TagRef = { slug: string; name: string };
export type RoomTags = { technology: TagRef[]; tool: TagRef[]; skill: TagRef[] };

export type RoomSummary = {
  code: string;
  title: string;
  description: string | null;
  difficulty: { key: string; label: string; level: number };
  type: { key: string; label: string };
  teams: Array<{ key: string; label: string; color: string }>;
  durationMinutes: number | null;
  usersCount: number | null;
  publishedAt: string | null;
  thmUrl: string;
  tags: RoomTags;
};

const emptyTags = (): RoomTags => ({ technology: [], tool: [], skill: [] });

/** Colonnes de base d'une room, jointes a ses referentiels. */
const roomSelection = {
  id: rooms.id,
  code: rooms.code,
  title: rooms.title,
  description: rooms.description,
  durationMinutes: rooms.durationMinutes,
  usersCount: rooms.usersCount,
  publishedAt: rooms.publishedAt,
  thmUrl: rooms.thmUrl,
  difficultyKey: difficulties.key,
  difficultyLabel: difficulties.label,
  difficultyLevel: difficulties.level,
  typeKey: roomTypes.key,
  typeLabel: roomTypes.label,
} as const;

type RoomRow = {
  id: number;
  code: string;
  title: string;
  description: string | null;
  durationMinutes: number | null;
  usersCount: number | null;
  publishedAt: string | null;
  thmUrl: string;
  difficultyKey: string;
  difficultyLabel: string;
  difficultyLevel: number;
  typeKey: string;
  typeLabel: string;
};

async function teamsByRoom(roomIds: number[]): Promise<Map<number, RoomSummary["teams"]>> {
  const out = new Map<number, RoomSummary["teams"]>();
  if (roomIds.length === 0) return out;

  const rows = await db
    .select({
      roomId: roomTeams.roomId,
      key: teams.key,
      label: teams.label,
      color: teams.color,
    })
    .from(roomTeams)
    .innerJoin(teams, eq(teams.id, roomTeams.teamId))
    .where(inArray(roomTeams.roomId, roomIds))
    .orderBy(asc(teams.key));

  for (const row of rows) {
    const list = out.get(row.roomId) ?? [];
    list.push({ key: row.key, label: row.label, color: row.color });
    out.set(row.roomId, list);
  }
  return out;
}

async function tagsByRoom(roomIds: number[]): Promise<Map<number, RoomTags>> {
  const out = new Map<number, RoomTags>();
  if (roomIds.length === 0) return out;

  const rows = await db
    .select({ roomId: roomTags.roomId, kind: tags.kind, slug: tags.slug, name: tags.name })
    .from(roomTags)
    .innerJoin(tags, eq(tags.id, roomTags.tagId))
    .where(inArray(roomTags.roomId, roomIds))
    .orderBy(asc(tags.kind), asc(tags.slug));

  for (const row of rows) {
    const bucket = out.get(row.roomId) ?? emptyTags();
    bucket[row.kind].push({ slug: row.slug, name: row.name });
    out.set(row.roomId, bucket);
  }
  return out;
}

function toSummary(
  row: RoomRow,
  teamMap: Map<number, RoomSummary["teams"]>,
  tagMap: Map<number, RoomTags>,
): RoomSummary {
  return {
    code: row.code,
    title: row.title,
    description: row.description,
    difficulty: {
      key: row.difficultyKey,
      label: row.difficultyLabel,
      level: row.difficultyLevel,
    },
    type: { key: row.typeKey, label: row.typeLabel },
    teams: teamMap.get(row.id) ?? [],
    durationMinutes: row.durationMinutes,
    usersCount: row.usersCount,
    publishedAt: row.publishedAt,
    thmUrl: row.thmUrl,
    tags: tagMap.get(row.id) ?? emptyTags(),
  };
}

export type RoomListResult = {
  data: RoomSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  search: { term: string; strategy: "fulltext" | "trigram" } | null;
};

export async function listRooms(
  filters: RoomFilters,
  options: { sort: SortKey; page: number; limit: number },
): Promise<RoomListResult> {
  const strategy = await resolveSearchStrategy(filters.q);
  const conditions: SQL[] = buildRoomConditions(filters, { strategy });
  const where = and(...conditions);

  const [totals] = await db
    .select({ total: countDistinct(rooms.id) })
    .from(rooms)
    .where(where);

  const total = totals?.total ?? 0;

  const rows: RoomRow[] = await db
    .select(roomSelection)
    .from(rooms)
    .innerJoin(difficulties, eq(difficulties.id, rooms.difficultyId))
    .innerJoin(roomTypes, eq(roomTypes.id, rooms.roomTypeId))
    .where(where)
    .orderBy(...buildOrderBy(options.sort))
    .limit(options.limit)
    .offset((options.page - 1) * options.limit);

  const ids = rows.map((row) => row.id);
  const [teamMap, tagMap] = await Promise.all([teamsByRoom(ids), tagsByRoom(ids)]);

  return {
    data: rows.map((row) => toSummary(row, teamMap, tagMap)),
    pagination: {
      page: options.page,
      limit: options.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / options.limit),
    },
    search: filters.q !== undefined && strategy !== "none" ? { term: filters.q, strategy } : null,
  };
}

export type RoomDetail = RoomSummary & {
  isActive: boolean;
  isFree: boolean;
  categories: Array<{ slug: string; name: string; source: CategorySource }>;
  trackSteps: Array<{
    trackSlug: string;
    trackTitle: string;
    stepPosition: number;
    stepTitle: string;
    requirement: StepRequirement;
    note: string | null;
  }>;
};

export async function findRoomByCode(code: string): Promise<RoomDetail | null> {
  const [row] = await db
    .select({ ...roomSelection, isActive: rooms.isActive, isFree: rooms.isFree })
    .from(rooms)
    .innerJoin(difficulties, eq(difficulties.id, rooms.difficultyId))
    .innerJoin(roomTypes, eq(roomTypes.id, rooms.roomTypeId))
    // Comparaison SENSIBLE A LA CASSE : `code` est `text`, jamais `citext`. Un code
    // mal casse doit tomber en 404 ici plutot que renvoyer une room dont le lien
    // sortant vers TryHackMe, lui, repondrait 404 (ADR-0001 Q1).
    .where(eq(rooms.code, code));

  if (row === undefined) return null;

  const [teamMap, tagMap, categoryRows, stepRows] = await Promise.all([
    teamsByRoom([row.id]),
    tagsByRoom([row.id]),
    db
      .select({ slug: categories.slug, name: categories.name, source: roomCategories.source })
      .from(roomCategories)
      .innerJoin(categories, eq(categories.id, roomCategories.categoryId))
      .where(eq(roomCategories.roomId, row.id))
      .orderBy(asc(categories.slug)),
    db
      .select({
        trackSlug: tracks.slug,
        trackTitle: tracks.title,
        stepPosition: trackSteps.position,
        stepTitle: trackSteps.title,
        requirement: stepRooms.requirement,
        note: stepRooms.note,
      })
      .from(stepRooms)
      .innerJoin(trackSteps, eq(trackSteps.id, stepRooms.stepId))
      .innerJoin(tracks, eq(tracks.id, trackSteps.trackId))
      .where(and(eq(stepRooms.roomId, row.id), eq(tracks.isPublished, true)))
      .orderBy(asc(tracks.position), asc(trackSteps.position)),
  ]);

  return {
    ...toSummary(row, teamMap, tagMap),
    isActive: row.isActive,
    isFree: row.isFree,
    categories: categoryRows,
    trackSteps: stepRows,
  };
}

export type CatalogStats = {
  rooms: { total: number; withoutTeam: number };
  durationMinutes: { total: number; min: number | null; max: number | null };
  byDifficulty: Array<{ key: string; label: string; level: number; count: number }>;
  byType: Array<{ key: string; label: string; count: number }>;
  byTeam: Array<{ key: string; label: string; color: string; count: number }>;
  tags: { technology: number; tool: number; skill: number };
};

export async function computeStats(): Promise<CatalogStats> {
  const active = eq(rooms.isActive, true);

  const [totals] = await db
    .select({
      total: countDistinct(rooms.id),
      duration: sql<number>`coalesce(sum(${rooms.durationMinutes}), 0)::int`,
      minDuration: sql<number | null>`min(${rooms.durationMinutes})`,
      maxDuration: sql<number | null>`max(${rooms.durationMinutes})`,
    })
    .from(rooms)
    .where(active);

  const [withoutTeam] = await db
    .select({ total: countDistinct(rooms.id) })
    .from(rooms)
    .leftJoin(roomTeams, eq(roomTeams.roomId, rooms.id))
    .where(and(active, sql`${roomTeams.roomId} is null`));

  const [byDifficulty, byType, byTeam, tagCounts] = await Promise.all([
    db
      .select({
        key: difficulties.key,
        label: difficulties.label,
        level: difficulties.level,
        count: countDistinct(rooms.id),
      })
      .from(difficulties)
      .leftJoin(rooms, and(eq(rooms.difficultyId, difficulties.id), active))
      .groupBy(difficulties.id, difficulties.key, difficulties.label, difficulties.level)
      .orderBy(asc(difficulties.level)),
    db
      .select({ key: roomTypes.key, label: roomTypes.label, count: countDistinct(rooms.id) })
      .from(roomTypes)
      .leftJoin(rooms, and(eq(rooms.roomTypeId, roomTypes.id), active))
      .groupBy(roomTypes.id, roomTypes.key, roomTypes.label)
      .orderBy(asc(roomTypes.key)),
    db
      .select({
        key: teams.key,
        label: teams.label,
        color: teams.color,
        count: countDistinct(rooms.id),
      })
      .from(teams)
      .leftJoin(roomTeams, eq(roomTeams.teamId, teams.id))
      .leftJoin(rooms, and(eq(rooms.id, roomTeams.roomId), active))
      .groupBy(teams.id, teams.key, teams.label, teams.color)
      .orderBy(asc(teams.key)),
    db
      .select({ kind: tags.kind, count: countDistinct(tags.id) })
      .from(tags)
      .groupBy(tags.kind),
  ]);

  const tagsByKind = { technology: 0, tool: 0, skill: 0 };
  for (const row of tagCounts) tagsByKind[row.kind] = row.count;

  return {
    rooms: { total: totals?.total ?? 0, withoutTeam: withoutTeam?.total ?? 0 },
    durationMinutes: {
      total: totals?.duration ?? 0,
      min: totals?.minDuration ?? null,
      max: totals?.maxDuration ?? null,
    },
    byDifficulty,
    byType,
    byTeam,
    tags: tagsByKind,
  };
}

export type TagKind = "technology" | "tool" | "skill";
export type TagListEntry = { kind: TagKind; slug: string; name: string; count: number };

export async function listTags(kind?: TagKind): Promise<TagListEntry[]> {
  return db
    .select({
      kind: tags.kind,
      slug: tags.slug,
      name: tags.name,
      count: countDistinct(rooms.id),
    })
    .from(tags)
    .leftJoin(roomTags, eq(roomTags.tagId, tags.id))
    .leftJoin(rooms, and(eq(rooms.id, roomTags.roomId), eq(rooms.isActive, true)))
    .where(kind === undefined ? undefined : eq(tags.kind, kind))
    .groupBy(tags.id, tags.kind, tags.slug, tags.name)
    .orderBy(asc(tags.kind), asc(tags.slug));
}

export type CategoryEntry = {
  slug: string;
  name: string;
  description: string | null;
  position: number;
  parentSlug: string | null;
  count: number;
};

export async function listCategories(): Promise<CategoryEntry[]> {
  const rows = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      description: categories.description,
      position: categories.position,
      parentId: categories.parentId,
      count: countDistinct(rooms.id),
    })
    .from(categories)
    .leftJoin(roomCategories, eq(roomCategories.categoryId, categories.id))
    .leftJoin(rooms, and(eq(rooms.id, roomCategories.roomId), eq(rooms.isActive, true)))
    .groupBy(
      categories.id,
      categories.slug,
      categories.name,
      categories.description,
      categories.position,
      categories.parentId,
    )
    .orderBy(asc(categories.position), asc(categories.slug));

  const slugById = new Map(rows.map((row) => [row.id, row.slug]));

  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    description: row.description,
    position: row.position,
    parentSlug: row.parentId === null ? null : (slugById.get(row.parentId) ?? null),
    count: row.count,
  }));
}
