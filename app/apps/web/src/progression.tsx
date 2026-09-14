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
    forget(codes: readonly string[]): void;
  }>;

export function useProgression(): ProgressionState {
  useEffect(attachStorageListener, []);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  return {
    ...snapshot,
    isCompleted: store.isCompleted,
    setCompleted: store.setCompleted,
    forget: store.forget,
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

/**
 * Un message par mode de defaillance, et chacun dit la meme chose en premier :
 * ce qui est perdu, et quand.
 *
 * Le titre porte la consequence, le corps porte la cause. Un utilisateur qui ne
 * lit que la premiere ligne doit deja savoir que rien n'est enregistre.
 */
const WARNING_TEXT: Readonly<
  Record<NonNullable<ProgressionSnapshot["warning"]>, { titre: string; corps: string }>
> = {
  "unreadable-preserved": {
    titre: "Votre progression n'est pas enregistree",
    corps:
      "Une progression existe deja dans ce navigateur, mais elle est illisible. Elle n'a " +
      "pas ete remplacee, au cas ou elle serait recuperable. Ce que vous cochez maintenant " +
      "reste dans cet onglet et disparaitra au rechargement.",
  },
  "storage-unavailable": {
    titre: "Votre progression n'est pas enregistree",
    corps:
      "Ce navigateur n'autorise pas le stockage local, souvent en navigation privee ou " +
      "quand les cookies sont bloques. Rien n'est conserve : ce que vous cochez disparaitra " +
      "au rechargement. Vous pouvez exporter votre progression en JSON avant de fermer.",
  },
  "write-failed": {
    titre: "Votre progression n'est pas enregistree",
    corps:
      "Le stockage local de ce navigateur est plein. Ce que vous cochez reste dans cet " +
      "onglet et disparaitra au rechargement. Liberer de l'espace, ou decocher des rooms, " +
      "suffit a relancer l'enregistrement.",
  },
};

/**
 * Bandeau PERMANENT tant que l'ecriture echoue. Aucun bouton pour le fermer.
 *
 * La version precedente etait fermable, et ne revenait jamais ensuite. Mesure en
 * navigateur, stockage sature : premiere case cochee, alerte correcte ;
 * l'utilisateur ferme ; cinq cases de plus cochees ; six cases affichees a
 * l'ecran, `localStorage` a `null`, plus aucune alerte. Tout etait perdu au
 * rechargement, sans qu'aucun ecran ne l'ait dit.
 *
 * Un avertissement fermable convient a une information. Celui-ci dit « rien de
 * ce que vous faites n'est conserve » : il disparait quand c'est redevenu faux,
 * pas quand on le lui demande.
 */
export function ProgressionPersistenceWarning(): ReactNode {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  if (snapshot.warning === null) return null;

  const { titre, corps } = WARNING_TEXT[snapshot.warning];
  return (
    <div className="alerte-stockage" role="alert">
      <p className="alerte-stockage__titre">{titre}</p>
      <p>{corps}</p>
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
