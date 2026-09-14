export const PROGRESSION_STORAGE_KEY = "thm-roadmap.progression";
export const PROGRESSION_STORAGE_VERSION = 1 as const;

/**
 * Cle de la sonde d'ecriture, distincte de celle de la progression.
 *
 * Elle ne doit JAMAIS toucher la vraie cle : ecrire sur `PROGRESSION_STORAGE_KEY`
 * pour tester l'ecriture detruirait precisement la donnee qu'on protege.
 */
export const PROGRESSION_PROBE_KEY = `${PROGRESSION_STORAGE_KEY}.probe`;

export type CompletedRoom = Readonly<{
  code: string;
  completedAt: string;
}>;

export type ProgressionPayload = Readonly<{
  version: typeof PROGRESSION_STORAGE_VERSION;
  completedRooms: readonly CompletedRoom[];
}>;

export type ProgressionReadKind =
  | "absent"
  | "valid"
  | "storage-unavailable"
  | "malformed-json"
  | "unknown-version"
  | "unexpected-shape";

/**
 * Les trois modes de defaillance, DISTINCTS.
 *
 * Ils l'etaient deja a la lecture, via `readKind`, mais l'interface les
 * confondait en un seul message. Resultat mesure en navigation privee :
 * l'utilisateur lisait « la progression locale EXISTANTE n'a pas pu etre lue,
 * la donnee existante n'a pas ete remplacee » alors que rien n'existait et que
 * rien ne serait jamais enregistre. Le message affirmait la survie de donnees
 * inexistantes et taisait la seule chose qui comptait.
 */
export type ProgressionWarning =
  /** Une valeur EXISTE dans le stockage mais est illisible. On n'ecrit pas par-dessus. */
  | "unreadable-preserved"
  /** Le stockage lui-meme refuse l'acces : navigation privee, cookies bloques. */
  | "storage-unavailable"
  /** Le stockage repond mais l'ecriture echoue : quota atteint. */
  | "write-failed";

export type ProgressionSnapshot = Readonly<{
  completedRooms: readonly CompletedRoom[];
  readKind: ProgressionReadKind;
  warning: ProgressionWarning | null;
}>;

export type ProgressionStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type ReadResult = Readonly<{
  kind: ProgressionReadKind;
  completedRooms: readonly CompletedRoom[];
}>;

/**
 * `preserve-existing` est le SEUL cas ou l'on renonce a ecrire.
 *
 * Il ne se declenche que lorsqu'une valeur est presente et illisible : la
 * remplacer detruirait une donnee peut-etre recuperable a la main. Partout
 * ailleurs on reessaie a chaque mutation — y compris quand la precedente a
 * echoue. Decocher une room est precisement l'action qui libere de la place
 * apres un quota atteint ; refuser de la persister serait tenir l'utilisateur
 * prisonnier de la panne qu'il est en train de reparer.
 */
type PersistencePolicy = "writable" | "preserve-existing";

type WriteOutcome = "ok" | "storage-unavailable" | "write-failed";

const CODE_PATTERN = /^[A-Za-z0-9._~-]{1,120}$/;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const EMPTY_ROOMS: readonly CompletedRoom[] = Object.freeze([]);

/** Les lectures qui autorisent l'ecriture : rien a preserver. */
const WRITABLE_READS: ReadonlySet<ProgressionReadKind> = new Set([
  "absent",
  "valid",
  // Le stockage est inaccessible : il n'y a aucune valeur connue a proteger, et
  // l'acces peut redevenir possible. On tentera, et l'echec sera nomme pour ce
  // qu'il est.
  "storage-unavailable",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function isIsoUtc(value: unknown): value is string {
  return (
    typeof value === "string" && ISO_UTC_PATTERN.test(value) && Number.isFinite(Date.parse(value))
  );
}

/**
 * Valide UNE entree.
 *
 * Ce controle n'est pas cosmetique : `completedAt` part directement dans
 * `Intl.DateTimeFormat.format(new Date(value))`, qui leve
 * `RangeError: Invalid time value` sur une date invalide. Sans cette barriere,
 * une seule entree malformee dans le stockage ferait tomber toute la page de
 * progression.
 */
function isCompletedRoom(value: unknown): value is CompletedRoom {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["code", "completedAt"]) &&
    typeof value.code === "string" &&
    CODE_PATTERN.test(value.code) &&
    isIsoUtc(value.completedAt)
  );
}

function parsePayload(value: unknown): ReadResult {
  if (isRecord(value) && "version" in value && value.version !== PROGRESSION_STORAGE_VERSION) {
    return { kind: "unknown-version", completedRooms: EMPTY_ROOMS };
  }

  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["version", "completedRooms"]) ||
    value.version !== PROGRESSION_STORAGE_VERSION ||
    !Array.isArray(value.completedRooms) ||
    !value.completedRooms.every(isCompletedRoom)
  ) {
    return { kind: "unexpected-shape", completedRooms: EMPTY_ROOMS };
  }

  // Un meme code deux fois n'est pas reparable sans arbitrer quelle date garder.
  // On ne devine pas : la valeur est classee illisible et laissee intacte.
  const codes = new Set(value.completedRooms.map((room) => room.code));
  if (codes.size !== value.completedRooms.length) {
    return { kind: "unexpected-shape", completedRooms: EMPTY_ROOMS };
  }

  return {
    kind: "valid",
    completedRooms: value.completedRooms.map((room) => ({ ...room })),
  };
}

/**
 * Lit la progression sans JAMAIS reparer ni reecrire la cle.
 *
 * Une valeur illisible peut encore etre recuperable manuellement. La remplacer
 * par un objet vide pendant le chargement detruirait des donnees sans action de
 * l'utilisateur. Tous les acces au stockage restent donc dans ce `try/catch`, et
 * les erreurs de forme sont seulement classees.
 */
export function readProgression(getStorage: () => ProgressionStorage): ReadResult {
  let raw: string | null;
  try {
    raw = getStorage().getItem(PROGRESSION_STORAGE_KEY);
  } catch {
    return { kind: "storage-unavailable", completedRooms: EMPTY_ROOMS };
  }

  if (raw === null) return { kind: "absent", completedRooms: EMPTY_ROOMS };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "malformed-json", completedRooms: EMPTY_ROOMS };
  }

  return parsePayload(parsed);
}

function payloadFor(completedRooms: readonly CompletedRoom[]): ProgressionPayload {
  return {
    version: PROGRESSION_STORAGE_VERSION,
    completedRooms,
  };
}

/**
 * Verifie AU DEMARRAGE que le stockage accepte reellement une ecriture.
 *
 * POURQUOI ELLE EXISTE. Sans elle, l'etat vide est muet quand il ment. Mesure en
 * navigateur, stockage sature : l'utilisateur coche trois rooms, l'alerte est
 * correcte ; il recharge ; la cle n'a jamais pu etre ecrite, donc elle est
 * ABSENTE ; `readKind` vaut `absent`, ce qui est exact a la lettre, et la page
 * affiche « Aucune room terminee pour l'instant » sans le moindre avertissement.
 * Le stockage est toujours plein, rien ne sera enregistre, et l'ecran l'annonce
 * comme une situation normale.
 *
 * Une lecture ne peut pas distinguer « rien n'a jamais ete enregistre » de
 * « rien n'a PU etre enregistre » : les deux laissent la cle absente. Seule une
 * ecriture tranche. La sonde ecrit donc un octet sur une cle a elle, puis le
 * retire.
 */
function probeWrite(getStorage: () => ProgressionStorage): WriteOutcome {
  let storage: ProgressionStorage;
  try {
    storage = getStorage();
  } catch {
    return "storage-unavailable";
  }

  try {
    storage.setItem(PROGRESSION_PROBE_KEY, "1");
  } catch {
    return "write-failed";
  }

  // Le retrait est du menage, pas le resultat de la sonde : son echec ne doit
  // pas faire croire que l'ecriture ne marche pas, puisqu'elle vient de marcher.
  try {
    storage.removeItem(PROGRESSION_PROBE_KEY);
  } catch {
    // Une cle d'un octet laissee derriere ne coute rien a personne.
  }
  return "ok";
}
/**
 * Tente l'ecriture et NOMME l'echec.
 *
 * Les deux `try` sont separes a dessein : ils distinguent « le stockage refuse
 * qu'on le touche » de « le stockage repond mais n'a plus de place ». Un seul
 * `try` autour des deux rendrait les deux pannes indiscernables, et c'est
 * exactement le defaut qu'on corrige.
 */
function attemptWrite(
  getStorage: () => ProgressionStorage,
  completedRooms: readonly CompletedRoom[],
): WriteOutcome {
  let storage: ProgressionStorage;
  try {
    storage = getStorage();
  } catch {
    return "storage-unavailable";
  }

  try {
    storage.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(payloadFor(completedRooms)));
    return "ok";
  } catch {
    return "write-failed";
  }
}

export type ProgressionStore = Readonly<{
  getSnapshot(): ProgressionSnapshot;
  subscribe(listener: () => void): () => void;
  isCompleted(code: string): boolean;
  setCompleted(code: string, completed: boolean): void;
  /** Retire des codes sans jamais toucher aux autres. Utilise pour les rooms disparues. */
  forget(codes: readonly string[]): void;
  reloadFromStorage(): void;
}>;

export function createProgressionStore(
  getStorage: () => ProgressionStorage,
  now: () => Date = () => new Date(),
): ProgressionStore {
  /**
   * Ce que l'utilisateur doit savoir AVANT d'avoir touche a quoi que ce soit.
   *
   * L'ecran vide n'est jamais muet quand il ment, et il ment de deux facons :
   * une valeur existe mais est illisible (la page dirait « aucune room terminee »
   * alors qu'il y en a), ou le stockage n'accepte pas l'ecriture (la page dirait
   * la meme chose, et rien de ce qui suivra ne sera conserve). Attendre la
   * premiere mutation pour le dire, c'est laisser l'utilisateur travailler sur
   * une base fausse.
   */
  const diagnose = (readKind: ProgressionReadKind): ProgressionWarning | null => {
    if (!WRITABLE_READS.has(readKind)) return "unreadable-preserved";

    const outcome = probeWrite(getStorage);
    if (outcome === "ok") return null;
    if (outcome === "storage-unavailable" || readKind === "storage-unavailable") {
      return "storage-unavailable";
    }
    return "write-failed";
  };

  const initial = readProgression(getStorage);
  let policy: PersistencePolicy = WRITABLE_READS.has(initial.kind)
    ? "writable"
    : "preserve-existing";
  let snapshot: ProgressionSnapshot = {
    completedRooms: initial.completedRooms,
    readKind: initial.kind,
    warning: diagnose(initial.kind),
  };
  const listeners = new Set<() => void>();

  const emit = (): void => {
    for (const listener of listeners) listener();
  };

  /**
   * Ecrit si la politique l'autorise, et rend l'avertissement qui en decoule.
   *
   * Appelee a CHAQUE mutation, y compris apres un echec. Il n'y a pas de verrou
   * « on a deja echoue une fois » : une panne de quota se repare en retirant des
   * entrees, et il faut donc que le retrait soit tente.
   */
  const persist = (completedRooms: readonly CompletedRoom[]): ProgressionWarning | null => {
    if (policy === "preserve-existing") return "unreadable-preserved";

    const outcome = attemptWrite(getStorage, completedRooms);
    if (outcome === "ok") return null;
    // Un stockage qu'on n'a pas pu lire et dans lequel on ne peut pas ecrire est
    // indisponible, pas plein. Le distinguer change le message affiche.
    if (outcome === "storage-unavailable" || snapshot.readKind === "storage-unavailable") {
      return "storage-unavailable";
    }
    return "write-failed";
  };

  const commit = (completedRooms: readonly CompletedRoom[]): void => {
    const warning = persist(completedRooms);
    snapshot = { completedRooms, readKind: snapshot.readKind, warning };
    emit();
  };

  const setCompleted = (code: string, completed: boolean): void => {
    if (!CODE_PATTERN.test(code)) throw new Error(`Code de room invalide : ${code}`);

    // Comparaison SENSIBLE A LA CASSE : `csrfV2` et `csrfv2` sont deux rooms
    // differentes (ADR-0001 Q1).
    const existing = snapshot.completedRooms.find((room) => room.code === code);
    if ((existing !== undefined) === completed) return;

    commit(
      completed
        ? [...snapshot.completedRooms, { code, completedAt: now().toISOString() }]
        : snapshot.completedRooms.filter((room) => room.code !== code),
    );
  };

  const forget = (codes: readonly string[]): void => {
    const doomed = new Set(codes);
    const remaining = snapshot.completedRooms.filter((room) => !doomed.has(room.code));
    if (remaining.length === snapshot.completedRooms.length) return;
    commit(remaining);
  };

  const reloadFromStorage = (): void => {
    const result = readProgression(getStorage);

    if (WRITABLE_READS.has(result.kind)) {
      policy = "writable";
      snapshot = {
        completedRooms: result.completedRooms,
        readKind: result.kind,
        // Une lecture redevenue saine n'efface l'avertissement que si l'ecriture
        // est redevenue possible. Relire n'est pas ecrire : un stockage plein
        // se relit parfaitement.
        warning: diagnose(result.kind),
      };
      emit();
      return;
    }

    // Une valeur devenue illisible dans un autre onglet ne doit ni remplacer
    // l'etat de cette session, ni etre reecrite automatiquement.
    policy = "preserve-existing";
    snapshot = { ...snapshot, readKind: result.kind, warning: diagnose(result.kind) };
    emit();
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isCompleted: (code) => snapshot.completedRooms.some((room) => room.code === code),
    setCompleted,
    forget,
    reloadFromStorage,
  };
}

export function createProgressionExport(
  completedRooms: readonly CompletedRoom[],
  exportedAt: Date = new Date(),
): string {
  return `${JSON.stringify(
    {
      version: PROGRESSION_STORAGE_VERSION,
      exportedAt: exportedAt.toISOString(),
      completedRooms,
    },
    null,
    2,
  )}\n`;
}
