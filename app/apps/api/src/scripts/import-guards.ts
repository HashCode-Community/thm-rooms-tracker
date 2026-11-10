export const MODIFIED_ROOMS_THRESHOLD_PERCENT = 25;
export const DIFFICULTY_SHIFT_THRESHOLD_POINTS = 10;

export type ExistingRoomSnapshot = {
  code: string;
  isActive: boolean;
  raw: unknown;
};

export type IncomingRoomSnapshot = {
  code: string;
  raw: unknown;
};

export type RoomChange = { code: string };

export type DifficultyShift = {
  difficulty: string;
  beforePercent: number;
  afterPercent: number;
  deltaPoints: number;
};

export type CorruptionAssessment = {
  activeKnownRooms: number;
  modifiedKnownCodes: string[];
  modifiedPercent: number;
  difficultyShifts: DifficultyShift[];
  suspiciousDifficultyShifts: DifficultyShift[];
  suspicious: boolean;
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sortedStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string").toSorted()
    : [];
}

/**
 * Compare les valeurs metier, pas l'ordre des cles JSON ni celui des listes de
 * tags. PostgreSQL jsonb reordonne les cles et l'ordre des tags n'a pas de sens.
 */
function roomFingerprint(value: unknown): string {
  const room = record(value);
  return JSON.stringify({
    title: room.title ?? null,
    description: room.description ?? null,
    difficulty: room.difficulty ?? null,
    type: room.type ?? null,
    durationMinutes: room.durationMinutes ?? null,
    usersCount: room.usersCount ?? null,
    publishedAt: room.publishedAt ?? null,
    url: room.url ?? null,
    teams: sortedStrings(room.teams),
    skills: sortedStrings(room.skills),
    technologies: sortedStrings(room.technologies),
    tools: sortedStrings(room.tools),
  });
}

function difficulty(value: unknown): string {
  const candidate = record(value).difficulty;
  return typeof candidate === "string" ? candidate : "(inconnue)";
}

function distribution(values: readonly unknown[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = difficulty(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = values.length;
  return new Map(
    [...counts].map(([key, count]) => [key, total === 0 ? 0 : (count / total) * 100]),
  );
}

export function assessImportCorruption(
  existing: readonly ExistingRoomSnapshot[],
  incoming: readonly IncomingRoomSnapshot[],
  fieldChanges: readonly RoomChange[],
): CorruptionAssessment {
  const active = existing.filter((room) => room.isActive);
  const incomingByCode = new Map(incoming.map((room) => [room.code, room]));
  const fieldChangedCodes = new Set(fieldChanges.map((change) => change.code));

  const modifiedKnownCodes = active
    .filter((current) => {
      const next = incomingByCode.get(current.code);
      if (next === undefined) return false;
      return (
        fieldChangedCodes.has(current.code) ||
        roomFingerprint(current.raw) !== roomFingerprint(next.raw)
      );
    })
    .map((room) => room.code)
    .sort();

  const modifiedPercent =
    active.length === 0 ? 0 : (modifiedKnownCodes.length / active.length) * 100;

  const before = distribution(active.map((room) => room.raw));
  const after = distribution(incoming.map((room) => room.raw));
  const difficulties = new Set([...before.keys(), ...after.keys()]);
  const difficultyShifts = [...difficulties]
    .map((key) => {
      const beforePercent = before.get(key) ?? 0;
      const afterPercent = after.get(key) ?? 0;
      return {
        difficulty: key,
        beforePercent,
        afterPercent,
        deltaPoints: Math.abs(afterPercent - beforePercent),
      };
    })
    .filter((shift) => shift.deltaPoints > 0)
    .sort((left, right) => right.deltaPoints - left.deltaPoints);

  const suspiciousDifficultyShifts =
    active.length === 0
      ? []
      : difficultyShifts.filter(
          (shift) => shift.deltaPoints > DIFFICULTY_SHIFT_THRESHOLD_POINTS,
        );

  return {
    activeKnownRooms: active.length,
    modifiedKnownCodes,
    modifiedPercent,
    difficultyShifts,
    suspiciousDifficultyShifts,
    suspicious:
      modifiedPercent > MODIFIED_ROOMS_THRESHOLD_PERCENT ||
      suspiciousDifficultyShifts.length > 0,
  };
}
