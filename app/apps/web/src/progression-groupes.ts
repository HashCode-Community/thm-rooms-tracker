import type { RoomBrief, TrackDetail } from "@thm/shared";

/**
 * Regroupement des rooms terminees POUR L'AFFICHAGE.
 *
 * Le produit vend un parcours, pas un journal. Trier la page par date repond a
 * « qu'ai-je fait recemment » ; la question du debutant est « ou j'en suis,
 * c'est quoi la suite ». Les rooms sont donc groupees par parcours, chaque
 * groupe dans l'ordre du parcours, et ce qui n'appartient a aucun parcours va
 * dans une section a part, celle-la triee par date decroissante.
 *
 * DUPLICATION D'AFFICHAGE ASSUMEE. Une room presente dans deux parcours apparait
 * dans les deux groupes. La progression, elle, reste stockee PAR ROOM : la regle
 * « on compte par code de room, jamais par (etape, room) » ne bouge pas, et les
 * totaux de la page continuent de compter chaque room une seule fois.
 */

export type RoomTerminee = Readonly<{
  room: RoomBrief;
  /** `null` quand l'horodatage est inutilisable. Jamais efface du stockage. */
  completedAt: string | null;
}>;

export type GroupeParcours = Readonly<{
  slug: string;
  titre: string;
  rooms: readonly RoomTerminee[];
}>;

export type Groupes = Readonly<{
  parcours: readonly GroupeParcours[];
  horsParcours: readonly RoomTerminee[];
}>;

/**
 * Au-dela de quoi un horodatage est tenu pour inutilisable.
 *
 * Une horloge machine decalee produit une date VALIDE et dans le futur. Le
 * format ISO UTC est respecte, la validation du magasin la laisse passer a juste
 * titre — et elle remonte en tete d'un tri decroissant, definitivement. Une
 * marge est necessaire parce qu'un decalage de quelques minutes entre la machine
 * et l'utilisateur est banal et sans consequence ; 24 heures separe le bruit de
 * l'horloge reglee sur la mauvaise annee.
 */
const AVANCE_TOLEREE_MS = 24 * 60 * 60 * 1000;

/**
 * Un horodatage dans un futur lointain est traite comme INCONNU.
 *
 * Il n'est ni supprime ni reecrit : la donnee de l'utilisateur ne se corrige pas
 * toute seule. Il est seulement retire du tri et sa date n'est pas affichee,
 * pour qu'une horloge fausse ne puisse pas desordonner la vue principale.
 */
export function horodatageUtilisable(valeur: string, maintenant: Date): boolean {
  const instant = Date.parse(valeur);
  if (!Number.isFinite(instant)) return false;
  return instant - maintenant.getTime() <= AVANCE_TOLEREE_MS;
}

/** Ordre du parcours : etape croissante, puis ordre des rooms dans l'etape. */
function codesDansOrdreDuParcours(track: TrackDetail): readonly string[] {
  const codes: string[] = [];
  for (const step of [...track.steps].sort((a, b) => a.position - b.position)) {
    for (const room of step.rooms) codes.push(room.code);
  }
  return codes;
}

/**
 * Le plus recent d'abord. Les horodatages inutilisables ferment la marche, dans
 * un ordre stable — celui des codes — pour que deux affichages successifs de la
 * meme progression ne se contredisent pas.
 */
function parDateDecroissante(gauche: RoomTerminee, droite: RoomTerminee): number {
  if (gauche.completedAt === null && droite.completedAt === null) {
    return gauche.room.code.localeCompare(droite.room.code);
  }
  if (gauche.completedAt === null) return 1;
  if (droite.completedAt === null) return -1;
  return droite.completedAt.localeCompare(gauche.completedAt);
}

export function grouperParParcours(
  rooms: readonly RoomBrief[],
  completionParCode: ReadonlyMap<string, string>,
  tracks: readonly TrackDetail[],
  maintenant: Date = new Date(),
): Groupes {
  const parCode = new Map(rooms.map((room) => [room.code, room]));

  const terminee = (room: RoomBrief): RoomTerminee => {
    const brut = completionParCode.get(room.code);
    const utilisable = brut !== undefined && horodatageUtilisable(brut, maintenant);
    return { room, completedAt: utilisable ? brut : null };
  };

  const placees = new Set<string>();
  const parcours: GroupeParcours[] = [];

  for (const track of tracks) {
    const dansLeParcours: RoomTerminee[] = [];
    // Un meme code peut apparaitre a deux etapes d'un MEME parcours : il ne doit
    // alors figurer qu'une fois dans son groupe.
    const vus = new Set<string>();
    for (const code of codesDansOrdreDuParcours(track)) {
      if (vus.has(code)) continue;
      const room = parCode.get(code);
      if (room === undefined) continue;
      vus.add(code);
      placees.add(code);
      dansLeParcours.push(terminee(room));
    }
    if (dansLeParcours.length > 0) {
      parcours.push({ slug: track.slug, titre: track.title, rooms: dansLeParcours });
    }
  }

  const horsParcours = rooms
    .filter((room) => !placees.has(room.code))
    .map(terminee)
    .sort(parDateDecroissante);

  return { parcours, horsParcours };
}
