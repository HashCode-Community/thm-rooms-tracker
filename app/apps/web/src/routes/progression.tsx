import { createRoute, Link } from "@tanstack/react-router";
import { computeTrackProgress, type RoomDetail } from "@thm/shared";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type Async, loadProgressionResources, type ProgressionResources } from "../api.js";
import { formatDuration } from "../components/badges.js";
import { Empty, ErrorState, Loading } from "../components/states.js";
import { ProgressionDownloadLink, RoomCompletionControl, useProgression } from "../progression.js";
import { summarizeCompletedRooms } from "../progression-summary.js";
import { rootRoute } from "./root.js";

const EMPTY_RESOURCES: ProgressionResources = { rooms: [], tracks: [] };

function useProgressionResources(codes: readonly string[]): Async<ProgressionResources> & {
  reload(): void;
} {
  const key = codes.join("\u0000");
  const [state, setState] = useState<Async<ProgressionResources>>(
    codes.length === 0
      ? { status: "ok", data: EMPTY_RESOURCES }
      : { status: "loading", data: null },
  );

  const run = useCallback((): (() => void) => {
    if (key === "") {
      setState({ status: "ok", data: EMPTY_RESOURCES });
      return () => {};
    }

    const controller = new AbortController();
    const requestedCodes = key.split("\u0000");
    setState((previous) => ({ status: "loading", data: previous.data }));
    loadProgressionResources(requestedCodes, controller.signal)
      .then((data) => {
        setState({ status: "ok", data });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState((previous) => ({
          status: "error",
          error: error instanceof Error ? error : new Error(String(error)),
          data: previous.data,
        }));
      });

    return () => controller.abort();
  }, [key]);

  useEffect(() => run(), [run]);

  const reload = useCallback(() => {
    run();
  }, [run]);
  return { ...state, reload };
}

function formatCompletedAt(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function CompletedRoomRow({
  room,
  completedAt,
}: {
  room: RoomDetail;
  completedAt: string;
}): ReactNode {
  return (
    <li className="progression-room">
      <div className="progression-room__corps">
        <div className="rang">
          <Link to="/rooms/$code" params={{ code: room.code }} className="progression-room__titre">
            {room.title}
          </Link>
          {!room.isActive && <span className="badge badge--retiree">Retiree du catalogue</span>}
        </div>
        <p className="petit doux">
          Terminee le {formatCompletedAt(completedAt)} · {formatDuration(room.durationMinutes)}
        </p>
      </div>
      <RoomCompletionControl code={room.code} />
    </li>
  );
}

function ProgressionPage(): ReactNode {
  const progression = useProgression();
  const completedCodes = progression.completedRooms.map((room) => room.code);
  const resources = useProgressionResources(completedCodes);
  const completedSet = useMemo(() => new Set(completedCodes), [completedCodes]);
  const completionByCode = useMemo(
    () => new Map(progression.completedRooms.map((room) => [room.code, room.completedAt])),
    [progression.completedRooms],
  );

  if (progression.completedRooms.length === 0) {
    return (
      <>
        <div className="intro">
          <h1>Ma progression</h1>
          <p className="doux">Votre progression reste dans ce navigateur, sans compte.</p>
        </div>
        <Empty title="Aucune room terminee pour l'instant">
          <p className="petit doux">
            Commencez par un parcours pour savoir dans quel ordre avancer, ou choisissez librement
            une room dans le catalogue. Vous pourrez la marquer comme terminee depuis sa fiche.
          </p>
          <p className="rang" style={{ marginTop: 12 }}>
            <Link to="/roadmap">Voir les parcours</Link>
            <Link to="/rooms">Explorer le catalogue</Link>
          </p>
        </Empty>
      </>
    );
  }

  return (
    <>
      <div className="progression-entete">
        <div className="intro">
          <h1>Ma progression</h1>
          <p className="doux">Enregistree dans ce navigateur, sans compte.</p>
        </div>
        <ProgressionDownloadLink completedRooms={progression.completedRooms} />
      </div>

      {resources.status === "loading" && resources.data === null && (
        <Loading label="Chargement de votre progression" />
      )}
      {resources.status === "error" && resources.data === null && (
        <ErrorState error={resources.error} onRetry={resources.reload} />
      )}

      {resources.data !== null && (
        <ProgressionContent
          resources={resources.data}
          completedSet={completedSet}
          completionByCode={completionByCode}
          stale={resources.status === "loading"}
        />
      )}
    </>
  );
}

function ProgressionContent({
  resources,
  completedSet,
  completionByCode,
  stale,
}: {
  resources: ProgressionResources;
  completedSet: ReadonlySet<string>;
  completionByCode: ReadonlyMap<string, string>;
  stale: boolean;
}): ReactNode {
  const completedRooms = resources.rooms
    .filter((room) => completedSet.has(room.code))
    .toSorted((left, right) => {
      const leftDate = completionByCode.get(left.code) ?? "";
      const rightDate = completionByCode.get(right.code) ?? "";
      return rightDate.localeCompare(leftDate);
    });
  const summary = summarizeCompletedRooms(completedRooms);

  return (
    <div className={stale ? "perime" : undefined}>
      <ul className="progression-chiffres" aria-label="Resume de la progression">
        <li>
          <strong>{summary.roomCount}</strong>
          <span>
            room{summary.roomCount > 1 ? "s" : ""} terminee{summary.roomCount > 1 ? "s" : ""}
          </span>
        </li>
        <li>
          <strong>{formatDuration(summary.totalMinutes)}</strong>
          <span>cumulees</span>
        </li>
      </ul>
      {summary.unknownDurationCount > 0 && (
        <p className="petit doux" style={{ marginTop: 8 }}>
          {summary.unknownDurationCount} room
          {summary.unknownDurationCount > 1 ? "s ont" : " a"} une duree non renseignee et
          {summary.unknownDurationCount > 1 ? " ne sont" : " n'est"} pas incluse
          {summary.unknownDurationCount > 1 ? "s" : ""} dans le total.
        </p>
      )}

      <section className="progression-section">
        <h2>Avancement par parcours</h2>
        <ul className="progression-parcours">
          {resources.tracks.map(({ data: track }) => {
            const trackProgress = computeTrackProgress(track.steps, completedSet);
            return (
              <li key={track.slug}>
                <div className="rang progression-parcours__ligne">
                  <Link to="/roadmap/$slug" params={{ slug: track.slug }}>
                    {track.title}
                  </Link>
                  <strong>{trackProgress.percent} %</strong>
                </div>
                <progress value={trackProgress.coreDone} max={trackProgress.coreTotal || 1}>
                  {trackProgress.percent} %
                </progress>
                <p className="petit doux">
                  {trackProgress.coreDone} sur {trackProgress.coreTotal} rooms recommandees
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="progression-section">
        <h2>Rooms terminees</h2>
        <ul className="progression-rooms">
          {completedRooms.map((room) => (
            <CompletedRoomRow
              key={room.code}
              room={room}
              completedAt={completionByCode.get(room.code) ?? ""}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

export const progressionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/progression",
  component: ProgressionPage,
});
