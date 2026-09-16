import { createRoute, Link } from "@tanstack/react-router";
import {
  computeTrackProgress,
  nextStepPosition,
  type TrackDetailResponse,
  type TrackListResponse,
} from "@thm/shared";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { urls, useResource } from "../api.js";
import { formatDuration } from "../components/badges.js";
import { AvancementParcours } from "../components/chemin.js";
import { Disclaimer, Provenance } from "../components/roadmap.js";
import { Empty, ErrorState, Loading } from "../components/states.js";
import { useProgression } from "../progression.js";
import { rootRoute } from "./root.js";

const LEVEL_LABELS: Readonly<Record<string, string>> = {
  beginner: "Débutant",
  intermediate: "Intermédiaire",
  advanced: "Avancé",
};

/**
 * Avancement d'un parcours sur sa carte.
 *
 * La reponse de liste ne porte pas les etapes : le detail est donc charge par
 * carte. Trois requetes de plus sur une page qui en faisait une — c'est le prix
 * de la seule information que l'utilisateur vient chercher ici, et elles partent
 * en parallele. Sans elle, la page des parcours ne dit pas ou l'on en est, ce
 * qui la ramene a un sommaire.
 *
 * Le chargement n'affiche RIEN plutot qu'un zero : annoncer « 0 % » a quelqu'un
 * qui a tout termine est pire que de ne rien annoncer une demi-seconde.
 */
function AvancementDeLaCarte({ slug }: { slug: string }): ReactNode {
  const detail = useResource<TrackDetailResponse>(urls.track(slug));
  const progression = useProgression();
  const completedCodes = useMemo(
    () => new Set(progression.completedRooms.map((room) => room.code)),
    [progression.completedRooms],
  );

  if (detail.data === null) return null;

  const progress = computeTrackProgress(detail.data.data.steps, completedCodes);
  const prochaine = nextStepPosition(progress);
  const etape = detail.data.data.steps.find((step) => step.position === prochaine);

  return (
    <>
      <AvancementParcours
        faits={progress.coreDone}
        total={progress.coreTotal}
        pourcent={progress.percent}
      />
      <p className="petit doux parcours-carte__suite">
        {etape === undefined ? (
          <strong>Parcours terminé.</strong>
        ) : (
          <>
            <strong>Prochaine étape :</strong> {etape.position}. {etape.title}
          </>
        )}
      </p>
    </>
  );
}

function RoadmapList(): ReactNode {
  const tracks = useResource<TrackListResponse>(urls.tracks());

  return (
    <>
      <div className="intro">
        <h1>Parcours</h1>
        <p className="doux">
          Un ordre de lecture dans les 714 rooms. Chaque étape <strong>recommande</strong> des rooms
          — ce ne sont pas des prérequis techniques : les données TryHackMe n'en contiennent aucun.
        </p>
      </div>

      {/* Mention obligatoire, en tete de page et non en note de bas de page.
          Le texte vient de l'API pour qu'aucune interface ne puisse le recopier
          de travers. */}
      <Disclaimer text={tracks.data?.disclaimer} />

      {tracks.status === "loading" && tracks.data === null && (
        <Loading label="Chargement des parcours" />
      )}

      {tracks.status === "error" && tracks.data === null && (
        <ErrorState error={tracks.error} onRetry={tracks.reload} />
      )}

      {tracks.data !== null && tracks.data.data.length === 0 && (
        <Empty title="Aucun parcours publie pour l'instant">
          <p className="petit doux">
            Les parcours sont un contenu editorial, ecrit et relu a la main. Ils ne sont pas generes
            a partir des donnees TryHackMe, qui ne contiennent ni ordre pedagogique ni notion de
            parcours.
          </p>
          <p style={{ marginTop: 8 }}>
            <Link to="/rooms">Parcourir le catalogue</Link>
          </p>
        </Empty>
      )}

      {tracks.data !== null && tracks.data.data.length > 0 && (
        <ul className={`parcours-liste${tracks.status === "loading" ? " perime" : ""}`}>
          {tracks.data.data.map((track) => (
            <li key={track.slug} className="parcours-carte">
              <h2 className="parcours-carte__titre">
                <Link to="/roadmap/$slug" params={{ slug: track.slug }}>
                  {track.title}
                </Link>
              </h2>

              <AvancementDeLaCarte slug={track.slug} />

              <div className="rang">
                <span className="badge badge--neutre">
                  {LEVEL_LABELS[track.level] ?? track.level}
                </span>
                <span className="badge badge--neutre">
                  {track.stepCount} étape{track.stepCount > 1 ? "s" : ""}
                </span>
                <span className="badge badge--neutre">
                  {track.coreRoomCount} room{track.coreRoomCount > 1 ? "s" : ""} recommandée
                  {track.coreRoomCount > 1 ? "s" : ""}
                </span>
                <span className="badge badge--neutre">
                  {formatDuration(track.estimatedMinutes)}
                </span>
              </div>

              {track.summary !== null && <p className="doux">{track.summary}</p>}

              <Provenance provenance={track.provenance} compact />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export const roadmapListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/roadmap",
  component: RoadmapList,
});
