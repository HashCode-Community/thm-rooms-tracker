import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { ProvenanceSchema, STEP_ROOM_REQUIREMENTS, TRACK_LEVELS } from "@thm/shared";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

/**
 * Lecture des parcours editoriaux.
 *
 * Ces fichiers ne sont PAS des donnees TryHackMe : ils sont ecrits et valides a la
 * main. Le dataset ne contient ni prerequis, ni ordre pedagogique, ni parcours, et
 * rien ici ne pretend le contraire.
 *
 * Le schema est STRICT et les messages d'erreur nomment le fichier, le chemin dans
 * le document et ce qui etait attendu. Un contenu editorial mal forme doit
 * s'arreter bruyamment : personne ne relit un avertissement.
 */

const SlugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug attendu : minuscules, chiffres et tirets");

/**
 * `code` de room, casse PRESERVEE (ADR-0001 Q1). Rien ne doit le replier : 14 des
 * 714 codes portent des majuscules et l'URL TryHackMe en depend.
 */
const RoomCodeSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9._~-]+$/, "code de room invalide");

const StepRoomSchema = z.strictObject({
  code: RoomCodeSchema,
  requirement: z.enum(STEP_ROOM_REQUIREMENTS).default("core"),
  /**
   * Texte destine a l'UTILISATEUR FINAL, affiche sous la room. Plusieurs notes
   * signalent que la suite d'une serie est payante : c'est souvent l'information
   * la plus utile de l'etape, elle ne doit jamais etre masquee.
   */
  note: z.string().min(1).optional(),
});

const StepSchema = z.strictObject({
  title: z.string().min(1),
  objective: z.string().min(1).optional(),
  rooms: z.array(StepRoomSchema).min(1, "une etape sans room n'a pas de sens"),
});

export const TrackFileSchema = z.strictObject({
  slug: SlugSchema,
  title: z.string().min(1),
  level: z.enum(TRACK_LEVELS),
  position: z.number().int().min(1),
  summary: z.string().min(1).optional(),
  provenance: ProvenanceSchema,
  steps: z.array(StepSchema).min(1, "un parcours sans etape n'a pas de sens"),
});

export type TrackFile = z.infer<typeof TrackFileSchema>;
export type LoadedTrack = { file: string; track: TrackFile };

export const TRACKS_DIR = "data/roadmap/tracks";

/** Erreur de contenu editorial. Distincte d'une panne technique. */
export class RoadmapSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoadmapSourceError";
  }
}

function formatIssues(file: string, error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.length === 0 ? "(racine)" : issue.path.join(".");
    return `    ${path} : ${issue.message}`;
  });
  return `  ${file}\n${lines.join("\n")}`;
}

/**
 * Charge tous les parcours d'un repertoire, tries par `position`.
 *
 * Un repertoire vide n'est PAS une erreur silencieuse : la fonction rend une liste
 * vide et c'est a l'appelant de decider. `roadmap:seed` refuse de tourner ;
 * l'API, elle, sert simplement zero parcours.
 */
export function loadTrackFiles(directory: string = TRACKS_DIR): LoadedTrack[] {
  let entries: string[];
  try {
    entries = readdirSync(directory).filter((name) => name.endsWith(".yaml"));
  } catch (error) {
    throw new RoadmapSourceError(
      `Repertoire de parcours introuvable : ${directory}\n` +
        `Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const loaded: LoadedTrack[] = [];
  const problems: string[] = [];

  for (const name of entries.sort()) {
    const raw: unknown = parseYaml(readFileSync(join(directory, name), "utf8"));
    const parsed = TrackFileSchema.safeParse(raw);
    if (parsed.success) {
      loaded.push({ file: name, track: parsed.data });
    } else {
      problems.push(formatIssues(name, parsed.error));
    }
  }

  if (problems.length > 0) {
    throw new RoadmapSourceError(
      `${problems.length} fichier(s) de parcours ne respectent pas le contrat :\n\n${problems.join("\n\n")}\n\n` +
        "Le contenu editorial n'est PAS corrige automatiquement. Corriger le YAML.",
    );
  }

  return loaded.sort((a, b) => a.track.position - b.track.position);
}

export type SourceIssue = { kind: string; detail: string };

/**
 * Verifications de COHERENCE, au-dela de la forme.
 *
 * Elles ne modifient rien : elles rendent la liste de ce qui cloche, et
 * l'appelant refuse de tourner. Corriger du contenu editorial en silence serait
 * exactement ce que le brief interdit.
 */
export function checkTrackCoherence(tracks: LoadedTrack[]): SourceIssue[] {
  const issues: SourceIssue[] = [];
  const bySlug = new Map<string, string>();
  const byPosition = new Map<number, string>();

  for (const { file, track } of tracks) {
    const previousSlug = bySlug.get(track.slug);
    if (previousSlug !== undefined) {
      issues.push({
        kind: "slug-duplique",
        detail: `"${track.slug}" est declare dans ${previousSlug} et dans ${file}.`,
      });
    }
    bySlug.set(track.slug, file);

    const previousPosition = byPosition.get(track.position);
    if (previousPosition !== undefined) {
      issues.push({
        kind: "position-dupliquee",
        detail: `position ${track.position} partagee par ${previousPosition} et ${file}.`,
      });
    }
    byPosition.set(track.position, file);

    // Une meme room DEUX FOIS dans le meme parcours : le compteur de progression
    // la compterait deux fois au denominateur et une seule au numerateur.
    const seen = new Map<string, number>();
    track.steps.forEach((step, index) => {
      for (const room of step.rooms) {
        const firstStep = seen.get(room.code);
        if (firstStep !== undefined) {
          issues.push({
            kind: "room-dupliquee-dans-parcours",
            detail: `${file} : "${room.code}" apparait aux etapes ${firstStep + 1} et ${index + 1}.`,
          });
        } else {
          seen.set(room.code, index);
        }
      }

      if (!step.rooms.some((room) => room.requirement === "core")) {
        issues.push({
          kind: "etape-sans-room-core",
          detail:
            `${file} : etape ${index + 1} « ${step.title} » n'a aucune room \`core\`. ` +
            "Elle ne compterait pour rien dans la progression.",
        });
      }
    });
  }

  return issues;
}

/** Toutes les rooms citees, tous parcours confondus, dedupliquees. */
export function citedRoomCodes(tracks: LoadedTrack[]): Set<string> {
  const codes = new Set<string>();
  for (const { track } of tracks) {
    for (const step of track.steps) {
      for (const room of step.rooms) codes.add(room.code);
    }
  }
  return codes;
}

export function describeSource(path: string): string {
  return basename(path);
}
