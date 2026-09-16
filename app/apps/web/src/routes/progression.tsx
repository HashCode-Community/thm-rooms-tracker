import { createRoute, Link } from "@tanstack/react-router";
import { computeTrackProgress, nextStepPosition } from "@thm/shared";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type Async, loadProgressionResources, type ProgressionResources } from "../api.js";
import { formatDuration } from "../components/badges.js";
import { Empty, ErrorState, Loading } from "../components/states.js";
import { ProgressBar } from "../components/ui/index.js";
import { ProgressionDownloadLink, RoomCompletionControl, useProgression } from "../progression.js";
import { grouperParParcours, type RoomTerminee } from "../progression-groupes.js";
import { summarizeCompletedRooms } from "../progression-summary.js";
import { rootRoute } from "./root.js";

const EMPTY_RESOURCES: ProgressionResources = { rooms: [], missing: [], tracks: [] };

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

/**
 * Les rooms que le navigateur connait mais que le catalogue ignore.
 *
 * Elles sont NOMMEES et retirables. Les tolerer en silence laisserait
 * l'utilisateur avec une entree fantome qu'il ne peut ni voir ni supprimer, et
 * un total qui ne correspond a rien de visible. Le retrait passe par `forget`,
 * qui ne touche a aucune autre entree.
 */
function MissingRooms({
  codes,
  onForget,
}: {
  codes: readonly string[];
  onForget(): void;
}): ReactNode {
  if (codes.length === 0) return null;
  const pluriel = codes.length > 1;

  return (
    <div className="alerte-disparues" role="status">
      <p>
        <strong>
          {codes.length} room{pluriel ? "s" : ""} de votre progression n
          {pluriel ? "'existent" : "'existe"} plus dans le catalogue.
        </strong>{" "}
        Elle{pluriel ? "s ne sont" : " n'est"} compte{pluriel ? "es" : "e"} ni dans vos heures
        cumulées, ni dans l'avancement des parcours.
      </p>
      <ul className="petit doux">
        {codes.map((code) => (
          <li key={code}>
            <code>{code}</code>
          </li>
        ))}
      </ul>
      <button type="button" className="bouton" onClick={onForget}>
        Retirer de ma progression
      </button>
    </div>
  );
}

function CompletedRoomRow({ room, completedAt }: RoomTerminee): ReactNode {
  return (
    <li className="progression-room">
      <div className="progression-room__corps">
        <div className="rang">
          <Link to="/rooms/$code" params={{ code: room.code }} className="progression-room__titre">
            {room.title}
          </Link>
          {!room.isActive && <span className="badge badge--retiree">Retirée du catalogue</span>}
        </div>
        <p className="petit doux">
          {/*
            Une date dans un futur lointain vient d'une horloge machine dereglee.
            Elle est VALIDE au format, donc le magasin la garde — mais l'afficher
            reviendrait a annoncer a l'utilisateur qu'il a termine une room en
            2027. On dit ce qu'on sait, et on ne touche pas au stockage.
          */}
          {completedAt === null
            ? "Date d'achevement inconnue"
            : `Terminée le ${formatCompletedAt(completedAt)}`}{" "}
          · {formatDuration(room.durationMinutes)}
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
        <Empty title="Aucune room terminée pour l'instant">
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
        <>
          <MissingRooms
            codes={resources.data.missing}
            onForget={() => {
              progression.forget(resources.data?.missing ?? []);
            }}
          />
          <ProgressionContent
            resources={resources.data}
            completedSet={completedSet}
            completionByCode={completionByCode}
            stale={resources.status === "loading"}
          />
        </>
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
  const completedRooms = resources.rooms.filter((room) => completedSet.has(room.code));
  // Les totaux comptent chaque room UNE fois, meme si elle apparait dans deux
  // groupes plus bas : la duplication est un fait d'affichage, pas de comptage.
  const summary = summarizeCompletedRooms(completedRooms);
  const groupes = grouperParParcours(
    completedRooms,
    completionByCode,
    resources.tracks.map((track) => track.data),
  );

  return (
    <div className={stale ? "perime" : undefined}>
      <ul className="progression-chiffres" aria-label="Resume de la progression">
        <li>
          <strong>{summary.roomCount}</strong>
          <span>
            room{summary.roomCount > 1 ? "s" : ""} terminée{summary.roomCount > 1 ? "s" : ""}
          </span>
        </li>
        <li>
          <strong>{formatDuration(summary.totalMinutes)}</strong>
          <span>cumulées</span>
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
                <ProgressBar
                  faits={trackProgress.coreDone}
                  total={trackProgress.coreTotal}
                  pourcent={trackProgress.percent}
                />
                <p className="petit doux">
                  {trackProgress.coreDone} sur {trackProgress.coreTotal} rooms recommandées
                  {(() => {
                    const suite = nextStepPosition(trackProgress);
                    const etape = track.steps.find((step) => step.position === suite);
                    return etape === undefined ? " — terminé" : ` — suite : ${etape.title}`;
                  })()}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {/*
        GROUPEES PAR PARCOURS, chaque groupe dans l'ordre du parcours.

        Le produit vend un parcours, pas un journal. Trier la page par date
        repond a « qu'ai-je fait recemment » ; la question du debutant est « ou
        j'en suis, c'est quoi la suite ». Ce qui n'appartient a aucun parcours
        garde le tri par date, parce que la il n'y a pas d'autre ordre a suivre.
      */}
      {groupes.parcours.map((groupe) => (
        <section className="progression-section" key={groupe.slug}>
          <h2>
            <Link to="/roadmap/$slug" params={{ slug: groupe.slug }}>
              {groupe.titre}
            </Link>
          </h2>
          <ul className="progression-rooms">
            {groupe.rooms.map((terminee) => (
              <CompletedRoomRow
                key={terminee.room.code}
                room={terminee.room}
                completedAt={terminee.completedAt}
              />
            ))}
          </ul>
        </section>
      ))}

      {groupes.horsParcours.length > 0 && (
        <section className="progression-section">
          <h2>Hors parcours</h2>
          <p className="petit doux">
            Des rooms choisies librement dans le catalogue, de la plus recente a la plus ancienne.
          </p>
          <ul className="progression-rooms">
            {groupes.horsParcours.map((terminee) => (
              <CompletedRoomRow
                key={terminee.room.code}
                room={terminee.room}
                completedAt={terminee.completedAt}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export const progressionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/progression",
  component: ProgressionPage,
});
