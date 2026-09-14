export const PROGRESSION_STORAGE_KEY = "thm-roadmap.progression";
export const PROGRESSION_STORAGE_VERSION = 1 as const;

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

export type ProgressionWarning = "unreadable-preserved" | "write-failed";

export type ProgressionSnapshot = Readonly<{
  completedRooms: readonly CompletedRoom[];
  readKind: ProgressionReadKind;
  warning: ProgressionWarning | null;
}>;

export type ProgressionStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

type ReadResult = Readonly<{
  kind: ProgressionReadKind;
  completedRooms: readonly CompletedRoom[];
}>;

type PersistenceMode = "writable" | "preserve-existing" | "write-failed";

const CODE_PATTERN = /^[A-Za-z0-9._~-]{1,120}$/;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const EMPTY_ROOMS: readonly CompletedRoom[] = Object.freeze([]);

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

export type ProgressionStore = Readonly<{
  getSnapshot(): ProgressionSnapshot;
  subscribe(listener: () => void): () => void;
  isCompleted(code: string): boolean;
  setCompleted(code: string, completed: boolean): void;
  dismissWarning(): void;
  reloadFromStorage(): void;
}>;

export function createProgressionStore(
  getStorage: () => ProgressionStorage,
  now: () => Date = () => new Date(),
): ProgressionStore {
  const initial = readProgression(getStorage);
  let persistenceMode: PersistenceMode =
    initial.kind === "absent" || initial.kind === "valid" ? "writable" : "preserve-existing";
  let warningAlreadyShown = false;
  let snapshot: ProgressionSnapshot = {
    completedRooms: initial.completedRooms,
    readKind: initial.kind,
    warning: null,
  };
  const listeners = new Set<() => void>();

  const emit = (): void => {
    for (const listener of listeners) listener();
  };

  const warningForCurrentMode = (): ProgressionWarning | null => {
    if (warningAlreadyShown) return snapshot.warning;
    if (persistenceMode === "preserve-existing") {
      warningAlreadyShown = true;
      return "unreadable-preserved";
    }
    if (persistenceMode === "write-failed") {
      warningAlreadyShown = true;
      return "write-failed";
    }
    return null;
  };

  const persist = (completedRooms: readonly CompletedRoom[]): ProgressionWarning | null => {
    if (persistenceMode === "preserve-existing" || persistenceMode === "write-failed") {
      return warningForCurrentMode();
    }

    try {
      getStorage().setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(payloadFor(completedRooms)));
      return null;
    } catch {
      persistenceMode = "write-failed";
      return warningForCurrentMode();
    }
  };

  const setCompleted = (code: string, completed: boolean): void => {
    if (!CODE_PATTERN.test(code)) throw new Error(`Code de room invalide : ${code}`);

    const existing = snapshot.completedRooms.find((room) => room.code === code);
    if ((existing !== undefined) === completed) return;

    const completedRooms = completed
      ? [...snapshot.completedRooms, { code, completedAt: now().toISOString() }]
      : snapshot.completedRooms.filter((room) => room.code !== code);
    const warning = persist(completedRooms);

    snapshot = {
      completedRooms,
      readKind: snapshot.readKind,
      warning: warning ?? snapshot.warning,
    };
    emit();
  };

  const reloadFromStorage = (): void => {
    const result = readProgression(getStorage);
    if (result.kind === "absent" || result.kind === "valid") {
      persistenceMode = "writable";
      snapshot = {
        completedRooms: result.completedRooms,
        readKind: result.kind,
        warning: snapshot.warning,
      };
      emit();
      return;
    }

    // Une valeur devenue illisible dans un autre onglet ne doit ni remplacer
    // l'etat de cette session, ni etre reecrite automatiquement.
    persistenceMode = "preserve-existing";
    snapshot = { ...snapshot, readKind: result.kind };
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
    dismissWarning: () => {
      if (snapshot.warning === null) return;
      snapshot = { ...snapshot, warning: null };
      emit();
    },
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
