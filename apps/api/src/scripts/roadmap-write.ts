import { inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { rooms, stepRooms, trackSteps, tracks } from "../db/schema.js";
import type { LoadedTrack } from "./roadmap-source.js";

/**
 * Ecriture des parcours en base.
 *
 * Extrait de `seed-roadmap.ts` pour etre testable : le script, lui, appelle
 * `process.exit` et ne s'invoque pas depuis un test.
 *
 * REMPLACEMENT COMPLET dans une seule transaction. Les parcours sont un contenu
 * edite a la main : la source de verite est le YAML, pas la base. Une fusion ligne
 * a ligne laisserait vivre en base une etape supprimee du fichier, et personne ne
 * s'en apercevrait.
 *
 * `step_rooms` et `track_steps` partent en cascade depuis `tracks`.
 */
export async function applyTracks(
  loaded: LoadedTrack[],
  idByCode: Map<string, number>,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(tracks);

    for (const { track } of loaded) {
      const [inserted] = await tx
        .insert(tracks)
        .values({
          slug: track.slug,
          title: track.title,
          summary: track.summary ?? null,
          level: track.level,
          position: track.position,
          // Publie des le seed : un parcours depose dans `data/roadmap/tracks/`
          // est un parcours qu'on assume. Le brouillon, c'est la branche Git.
          isPublished: true,
          provenance: track.provenance,
        })
        .returning({ id: tracks.id });

      if (inserted === undefined) throw new Error(`insertion du parcours ${track.slug} echouee`);

      for (const [index, step] of track.steps.entries()) {
        const position = index + 1;

        // Duree estimee d'une etape = somme des rooms `core` UNIQUEMENT. Les
        // `optional` et `bonus` ne sont pas sur le chemin que l'estimation decrit.
        const coreCodes = step.rooms
          .filter((room) => room.requirement === "core")
          .map((room) => room.code);
        const durations =
          coreCodes.length === 0
            ? []
            : await tx
                .select({ minutes: rooms.durationMinutes })
                .from(rooms)
                .where(inArray(rooms.code, coreCodes));
        const estimated = durations.reduce((total, row) => total + (row.minutes ?? 0), 0);

        const [insertedStep] = await tx
          .insert(trackSteps)
          .values({
            trackId: inserted.id,
            position,
            title: step.title,
            objective: step.objective ?? null,
            estimatedMinutes: estimated === 0 ? null : estimated,
          })
          .returning({ id: trackSteps.id });

        if (insertedStep === undefined) {
          throw new Error(`insertion de l'etape ${position} de ${track.slug} echouee`);
        }

        for (const [roomIndex, room] of step.rooms.entries()) {
          const roomId = idByCode.get(room.code);
          if (roomId === undefined) throw new Error(`room ${room.code} introuvable`);

          await tx.insert(stepRooms).values({
            stepId: insertedStep.id,
            roomId,
            position: roomIndex + 1,
            requirement: room.requirement,
            note: room.note ?? null,
          });
        }
      }
    }
  });
}

/** Rooms citees qui manquent en base ou y sont inactives. */
export async function resolveCitedRooms(cited: string[]): Promise<{
  missing: string[];
  inactive: string[];
  idByCode: Map<string, number>;
}> {
  const idByCode = new Map<string, number>();
  const inactive: string[] = [];

  if (cited.length > 0) {
    // Comparaison SENSIBLE A LA CASSE : `rooms.code` est `text`, jamais `citext`.
    const found = await db
      .select({ id: rooms.id, code: rooms.code, isActive: rooms.isActive })
      .from(rooms)
      .where(inArray(rooms.code, cited));

    for (const row of found) {
      idByCode.set(row.code, row.id);
      if (!row.isActive) inactive.push(row.code);
    }
  }

  return {
    missing: cited.filter((code) => !idByCode.has(code)).sort(),
    inactive: inactive.sort(),
    idByCode,
  };
}
