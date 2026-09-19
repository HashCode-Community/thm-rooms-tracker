import { z } from "zod";

/**
 * Contrat des PARCOURS.
 *
 * Les parcours ne se deduisent d'aucune donnee TryHackMe : le dataset ne contient
 * ni prerequis, ni ordre pedagogique, ni notion de parcours. C'est un contenu
 * EDITORIAL, ecrit et valide a la main, versionne dans `data/roadmap/tracks/*.yaml`.
 *
 * Consequence sur le vocabulaire, et ce n'est pas une precaution de style : une
 * etape « recommande » une room, elle ne la « requiert » pas. L'API et l'UI
 * n'emploient jamais le mot prerequis.
 */

export const TRACK_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type TrackLevel = (typeof TRACK_LEVELS)[number];

export const STEP_ROOM_REQUIREMENTS = ["core", "optional", "bonus"] as const;
export type StepRoomRequirement = (typeof STEP_ROOM_REQUIREMENTS)[number];

/**
 * D'ou vient ce parcours et ce qu'il n'est pas.
 *
 * Stocke en base, expose par l'API, AFFICHE dans l'interface. Un parcours dont on
 * ne sait pas comment il a ete construit se lit comme une autorite ; avec sa
 * provenance sous les yeux, il se lit comme une recommandation, ce qu'il est.
 */
/**
 * STRICT, et ca n'est pas une precaution de style.
 *
 * Ce bloc etait un `z.object` ordinaire, qui SUPPRIME une cle inconnue au lieu de
 * la refuser. Les trois parcours du produit ont ete ecrits avec `source:` au
 * singulier et un `review_after:` qui n'a jamais ete au contrat : les deux ont ete
 * manges en silence, `sources` est reste vide, et le bloc « Sur la base de : » de
 * l'interface ne s'affichait jamais. Le seed sortait en code 0 sans rien dire.
 *
 * Le reste du contrat editorial est en `strictObject` depuis le debut. Ce bloc
 * etait le seul trou, et c'est par la que le contenu est passe.
 */
export const ProvenanceSchema = z.strictObject({
  /** Comment les rooms ont ete choisies, en clair. */
  method: z.string().min(1),
  /**
   * Ce sur quoi la selection s'appuie. TEXTE LIBRE destine a l'utilisateur final,
   * rendu sous « Sur la base de : ». A ne pas confondre avec
   * `room_categories.source`, qui est l'enumeration `thm | derived | manual` et
   * ne decrit pas la meme chose.
   */
  sources: z.array(z.string().min(1)).default([]),
  /**
   * `false` tant que l'equipe n'a pas suivi le parcours de bout en bout.
   * OBLIGATOIRE et sans valeur par defaut : personne ne doit pouvoir l'omettre
   * par distraction et laisser croire a une validation qui n'a pas eu lieu.
   */
  validated_by_completion: z.boolean(),
  notes: z.string().optional(),
});

export type Provenance = z.infer<typeof ProvenanceSchema>;

// --- Reponses de l'API -----------------------------------------------------

export const TrackRoomSchema = z.object({
  code: z.string(),
  title: z.string(),
  difficulty: z.object({ key: z.string(), label: z.string(), level: z.number().int() }),
  type: z.object({ key: z.string(), label: z.string() }),
  durationMinutes: z.number().int().nullable(),
  requirement: z.enum(STEP_ROOM_REQUIREMENTS),
  /**
   * Justification editoriale, redigee par nous, DESTINEE A L'UTILISATEUR FINAL.
   * Plusieurs notes signalent que la suite d'une serie est payante : c'est souvent
   * l'information la plus utile de l'etape, elle s'affiche sous la room.
   */
  note: z.string().nullable(),
});

export const TrackStepSchema = z.object({
  position: z.number().int(),
  title: z.string(),
  objective: z.string().nullable(),
  /** Somme des durees des rooms `core` de l'etape. */
  estimatedMinutes: z.number().int().nullable(),
  rooms: z.array(TrackRoomSchema),
});

export const TrackSummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  level: z.enum(TRACK_LEVELS),
  position: z.number().int(),
  stepCount: z.number().int(),
  /** Nombre de rooms `core`. C'est le denominateur de la progression. */
  coreRoomCount: z.number().int(),
  totalRoomCount: z.number().int(),
  estimatedMinutes: z.number().int(),
  provenance: ProvenanceSchema,
});

export const TrackDetailSchema = TrackSummarySchema.extend({
  steps: z.array(TrackStepSchema),
});

export const TrackListResponseSchema = z.object({
  data: z.array(TrackSummarySchema),
  /**
   * Mention OBLIGATOIRE, rendue par l'API pour qu'aucune interface ne puisse
   * l'oublier en la recopiant mal.
   */
  disclaimer: z.string(),
});

export const TrackDetailResponseSchema = z.object({
  data: TrackDetailSchema,
  disclaimer: z.string(),
});

export type TrackRoom = z.infer<typeof TrackRoomSchema>;
export type TrackStep = z.infer<typeof TrackStepSchema>;
export type TrackSummary = z.infer<typeof TrackSummarySchema>;
export type TrackDetail = z.infer<typeof TrackDetailSchema>;
export type TrackListResponse = z.infer<typeof TrackListResponseSchema>;
export type TrackDetailResponse = z.infer<typeof TrackDetailResponseSchema>;

/**
 * Texte impose, mot pour mot. Il vit ici, dans le contrat partage, parce qu'il
 * doit etre identique dans l'API, dans l'UI et dans tout ce qui viendra ensuite.
 */
export const ROADMAP_DISCLAIMER =
  "Parcours construits a partir des metadonnees TryHackMe, du nombre de participants " +
  "par room et d'une progression pedagogique standard. Ils n'ont pas ete integralement " +
  "suivis par notre equipe.";

// --- Progression -----------------------------------------------------------

export type StepProgress = {
  position: number;
  coreTotal: number;
  coreDone: number;
  /** Vrai quand TOUTES les rooms `core` de l'etape sont terminees. */
  complete: boolean;
};

export type TrackProgress = {
  coreTotal: number;
  coreDone: number;
  /** Entier de 0 a 100. Vaut 100 quand il n'y a aucune room `core`. */
  percent: number;
  steps: StepProgress[];
};

/**
 * La PROCHAINE etape : la premiere qui reste a faire.
 *
 * C'est la variable visuelle principale du parcours, pas la difficulte. Mesure
 * sur le dataset : 87,7 % des rooms sont `easy` ou `medium`, donc un chemin
 * colore par la difficulte serait quasi monochrome et n'informerait de rien. Ce
 * que le debutant demande est « ou j'en suis, c'est quoi la suite ».
 *
 * UNE ETAPE SANS AUCUNE ROOM RECOMMANDEE EST SAUTEE. `complete` vaut faux pour
 * elle — c'est voulu, `core.length > 0` est dans sa definition — mais elle n'a
 * rien a faire, donc la bloquer comme « prochaine etape » arreterait le parcours
 * sur une etape ou l'utilisateur ne peut rien cocher. Ce cas n'existe pas dans
 * les trois parcours d'aujourd'hui ; il tiendra le jour ou une etape purement
 * documentaire sera ecrite.
 *
 * Rend `null` quand tout est termine.
 */
export function nextStepPosition(progress: TrackProgress): number | null {
  const next = progress.steps.find((step) => step.coreTotal > 0 && !step.complete);
  return next?.position ?? null;
}

/**
 * Progression d'un parcours a partir des CODES de rooms terminees.
 *
 * DEUX REGLES, et se tromper sur l'une ou l'autre ne se voit pas.
 *
 * 1. Le denominateur ne compte que les rooms `core`. Une room `optional` ou
 *    `bonus` terminee ne gonfle pas le pourcentage : sinon un parcours pourrait
 *    afficher 100 % sans qu'aucune room essentielle soit faite.
 *
 * 2. L'entree est un ensemble de CODES DE ROOMS, jamais de couples
 *    (etape, room). Une meme room apparait dans plusieurs parcours — par exemple
 *    `cyberkillchainzmt`, presente dans Fondamentaux et dans Blue Team. La
 *    terminer quelque part la termine PARTOUT. Scoper la progression a l'etape
 *    casserait ce cas sans rien casser d'autre : le comportement resterait juste
 *    pour toutes les rooms qui n'apparaissent qu'une fois, c'est-a-dire presque
 *    toutes. C'est exactement le genre de defaut qu'on ne remarque pas.
 */
export function computeTrackProgress(
  steps: ReadonlyArray<{ position: number; rooms: ReadonlyArray<TrackRoom> }>,
  completedRoomCodes: ReadonlySet<string>,
): TrackProgress {
  const stepProgress: StepProgress[] = steps.map((step) => {
    const core = step.rooms.filter((room) => room.requirement === "core");
    const done = core.filter((room) => completedRoomCodes.has(room.code)).length;
    return {
      position: step.position,
      coreTotal: core.length,
      coreDone: done,
      complete: core.length > 0 && done === core.length,
    };
  });

  const coreTotal = stepProgress.reduce((total, step) => total + step.coreTotal, 0);
  const coreDone = stepProgress.reduce((total, step) => total + step.coreDone, 0);

  return {
    coreTotal,
    coreDone,
    percent: coreTotal === 0 ? 100 : Math.round((coreDone / coreTotal) * 100),
    steps: stepProgress,
  };
}
