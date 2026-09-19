export type CompletionSummary = Readonly<{
  roomCount: number;
  totalMinutes: number;
  unknownDurationCount: number;
}>;

/** Compte chaque code une seule fois, quelle que soit sa presence dans les parcours. */
export function summarizeCompletedRooms(
  rooms: ReadonlyArray<{ code: string; durationMinutes: number | null }>,
): CompletionSummary {
  const seen = new Set<string>();
  let totalMinutes = 0;
  let unknownDurationCount = 0;

  for (const room of rooms) {
    if (seen.has(room.code)) continue;
    seen.add(room.code);
    if (room.durationMinutes === null) unknownDurationCount += 1;
    else totalMinutes += room.durationMinutes;
  }

  return { roomCount: seen.size, totalMinutes, unknownDurationCount };
}
