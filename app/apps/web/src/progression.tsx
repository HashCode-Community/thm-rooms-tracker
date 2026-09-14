import type { ReactNode } from "react";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  type CompletedRoom,
  createProgressionExport,
  createProgressionStore,
  PROGRESSION_STORAGE_KEY,
  type ProgressionSnapshot,
} from "./progression-store.js";

const store = createProgressionStore(() => window.localStorage);
let storageListenerAttached = false;

function attachStorageListener(): void {
  if (storageListenerAttached || typeof window === "undefined") return;
  window.addEventListener("storage", (event) => {
    if (event.key === PROGRESSION_STORAGE_KEY) store.reloadFromStorage();
  });
  storageListenerAttached = true;
}

export type ProgressionState = ProgressionSnapshot &
  Readonly<{
    isCompleted(code: string): boolean;
    setCompleted(code: string, completed: boolean): void;
  }>;

export function useProgression(): ProgressionState {
  useEffect(attachStorageListener, []);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  return {
    ...snapshot,
    isCompleted: store.isCompleted,
    setCompleted: store.setCompleted,
  };
}

export function RoomCompletionControl({
  code,
  presentation = "button",
}: {
  code: string;
  presentation?: "button" | "checkbox";
}): ReactNode {
  const progression = useProgression();
  const completed = progression.isCompleted(code);

  if (presentation === "checkbox") {
    return (
      <label className="progression-case">
        <input
          type="checkbox"
          checked={completed}
          onChange={(event) => {
            progression.setCompleted(code, event.target.checked);
          }}
        />
        <span>Terminee</span>
      </label>
    );
  }

  return (
    <button
      type="button"
      className={`bouton${completed ? " bouton--actif" : ""}`}
      aria-pressed={completed}
      onClick={() => {
        progression.setCompleted(code, !completed);
      }}
    >
      {completed ? "Marquee comme terminee" : "Marquer comme terminee"}
    </button>
  );
}

const WARNING_TEXT: Readonly<Record<NonNullable<ProgressionSnapshot["warning"]>, string>> = {
  "unreadable-preserved":
    "La progression locale existante n'a pas pu etre lue. Ce changement reste utilisable " +
    "dans cet onglet, mais la donnee existante n'a pas ete remplacee.",
  "write-failed":
    "Votre progression fonctionne pour cette session, mais le navigateur n'a pas pu " +
    "l'enregistrer. Elle risque de disparaitre au rechargement.",
};

export function ProgressionPersistenceWarning(): ReactNode {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  if (snapshot.warning === null) return null;

  return (
    <div className="alerte-stockage" role="alert">
      <p>{WARNING_TEXT[snapshot.warning]}</p>
      <button type="button" className="bouton bouton--lien" onClick={store.dismissWarning}>
        Fermer
      </button>
    </div>
  );
}

export function ProgressionDownloadLink({
  completedRooms,
}: {
  completedRooms: readonly CompletedRoom[];
}): ReactNode {
  const [download, setDownload] = useState<Readonly<{ href: string; filename: string }> | null>(
    null,
  );

  useEffect(() => {
    const now = new Date();
    const href = URL.createObjectURL(
      new Blob([createProgressionExport(completedRooms, now)], {
        type: "application/json;charset=utf-8",
      }),
    );
    setDownload({
      href,
      filename: `thm-roadmap-progression-${now.toISOString().slice(0, 10)}.json`,
    });
    return () => URL.revokeObjectURL(href);
  }, [completedRooms]);

  return (
    <a
      className="bouton"
      href={download?.href}
      download={download?.filename}
      aria-disabled={download === null}
    >
      Exporter en JSON
    </a>
  );
}
