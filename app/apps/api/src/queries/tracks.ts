import type { Provenance, TrackDetail, TrackStep, TrackSummary } from "@thm/shared";
import { ProvenanceSchema } from "@thm/shared";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { difficulties, rooms, roomTypes, stepRooms, trackSteps, tracks } from "../db/schema.js";

/**
 * Requetes des parcours.
 *
 * Seuls les parcours PUBLIES sortent. `provenance` accompagne systematiquement le
 * parcours : elle n'est pas une metadonnee interne, c'est une information due au
 * lecteur.
 */

/**
 * `provenance` est stockee en `jsonb` : la base ne garantit que « c'est du JSON ».
 * On la revalide a la lecture plutot que de la forcer en type — une donnee ecrite
 * par une version anterieure du seed ne doit pas traverser l'API en silence.
 */
function readProvenance(value: unknown, slug: string): Provenance {
  const parsed = ProvenanceSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new Error(
    `Le parcours "${slug}" a une provenance illisible en base. ` +
      "Relancer `pnpm roadmap:seed --apply` depuis les YAML, qui font foi.",
  );
}

type StepRow = {
  trackSlug: string;
  stepPosition: number;
  stepTitle: string;
  objective: string | null;
  estimatedMinutes: number | null;
  roomPosition: number;
  requirement: "core" | "optional" | "bonus";
  note: string | null;
  code: string;
  title: string;
  durationMinutes: number | null;
  difficultyKey: string;
  difficultyLabel: string;
  difficultyLevel: number;
  typeKey: string;
  typeLabel: string;
};

async function loadSteps(trackIds: number[]): Promise<Map<string, TrackStep[]>> {
  const out = new Map<string, TrackStep[]>();
  if (trackIds.length === 0) return out;

  const rows: StepRow[] = await db
    .select({
      trackSlug: tracks.slug,
      stepPosition: trackSteps.position,
      stepTitle: trackSteps.title,
      objective: trackSteps.objective,
      estimatedMinutes: trackSteps.estimatedMinutes,
      roomPosition: stepRooms.position,
      requirement: stepRooms.requirement,
      note: stepRooms.note,
      code: rooms.code,
      title: rooms.title,
      durationMinutes: rooms.durationMinutes,
      difficultyKey: difficulties.key,
      difficultyLabel: difficulties.label,
      difficultyLevel: difficulties.level,
      typeKey: roomTypes.key,
      typeLabel: roomTypes.label,
    })
    .from(trackSteps)
    .innerJoin(tracks, eq(tracks.id, trackSteps.trackId))
    .innerJoin(stepRooms, eq(stepRooms.stepId, trackSteps.id))
    .innerJoin(rooms, eq(rooms.id, stepRooms.roomId))
    .innerJoin(difficulties, eq(difficulties.id, rooms.difficultyId))
    .innerJoin(roomTypes, eq(roomTypes.id, rooms.roomTypeId))
    .where(inArray(trackSteps.trackId, trackIds))
    // L'ordre EST l'information : ici la numerotation encode une sequence
    // pedagogique, contrairement au catalogue ou elle n'encode rien.
    .orderBy(asc(tracks.position), asc(trackSteps.position), asc(stepRooms.position));

  for (const row of rows) {
    const steps = out.get(row.trackSlug) ?? [];
    let step = steps.find((entry) => entry.position === row.stepPosition);
    if (step === undefined) {
      step = {
        position: row.stepPosition,
        title: row.stepTitle,
        objective: row.objective,
        estimatedMinutes: row.estimatedMinutes,
        rooms: [],
      };
      steps.push(step);
    }
    step.rooms.push({
      code: row.code,
      title: row.title,
      difficulty: {
        key: row.difficultyKey,
        label: row.difficultyLabel,
        level: row.difficultyLevel,
      },
      type: { key: row.typeKey, label: row.typeLabel },
      durationMinutes: row.durationMinutes,
      requirement: row.requirement,
      note: row.note,
    });
    out.set(row.trackSlug, steps);
  }

  return out;
}

function summarise(
  track: {
    slug: string;
    title: string;
    summary: string | null;
    level: "beginner" | "intermediate" | "advanced";
    position: number;
    provenance: unknown;
  },
  steps: TrackStep[],
): TrackSummary {
  let coreRoomCount = 0;
  let totalRoomCount = 0;
  let estimatedMinutes = 0;

  for (const step of steps) {
    totalRoomCount += step.rooms.length;
    coreRoomCount += step.rooms.filter((room) => room.requirement === "core").length;
    estimatedMinutes += step.estimatedMinutes ?? 0;
  }

  return {
    slug: track.slug,
    title: track.title,
    summary: track.summary,
    level: track.level,
    position: track.position,
    stepCount: steps.length,
    coreRoomCount,
    totalRoomCount,
    estimatedMinutes,
    provenance: readProvenance(track.provenance, track.slug),
  };
}

const publishedTrackColumns = {
  id: tracks.id,
  slug: tracks.slug,
  title: tracks.title,
  summary: tracks.summary,
  level: tracks.level,
  position: tracks.position,
  provenance: tracks.provenance,
} as const;

export async function listTracks(): Promise<TrackSummary[]> {
  const rows = await db
    .select(publishedTrackColumns)
    .from(tracks)
    .where(eq(tracks.isPublished, true))
    .orderBy(asc(tracks.position), asc(tracks.slug));

  const steps = await loadSteps(rows.map((row) => row.id));
  return rows.map((row) => summarise(row, steps.get(row.slug) ?? []));
}

export async function findTrackBySlug(slug: string): Promise<TrackDetail | null> {
  const [row] = await db
    .select(publishedTrackColumns)
    .from(tracks)
    .where(and(eq(tracks.slug, slug), eq(tracks.isPublished, true)));

  if (row === undefined) return null;

  const steps = (await loadSteps([row.id])).get(row.slug) ?? [];
  return { ...summarise(row, steps), steps };
}
