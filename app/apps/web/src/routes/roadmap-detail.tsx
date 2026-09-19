import { createRoute, Link } from "@tanstack/react-router";
import type { TrackDetailResponse } from "@thm/shared";
import type { ReactNode } from "react";
import { ApiError, urls, useResource } from "../api.js";
import { formatDuration } from "../components/badges.js";
import { Disclaimer, Provenance, StepRoom } from "../components/roadmap.js";
import { Empty, ErrorState, Loading } from "../components/states.js";
import { rootRoute } from "./root.js";

const coreCount = (step: { rooms: ReadonlyArray<{ requirement: string }> }): number =>
  step.rooms.filter((room) => room.requirement === "core").length;

function RoadmapDetail(): ReactNode {
  const { slug } = roadmapDetailRoute.useParams();
  const track = useResource<TrackDetailResponse>(urls.track(slug));

  if (track.status === "loading" && track.data === null) {
    return <Loading label="Chargement du parcours" />;
  }

  if (track.status === "error" && track.data === null) {
    if (track.error instanceof ApiError && track.error.status === 404) {
      return (
        <Empty title={`Aucun parcours publie sous « ${slug} »`}>
          <p style={{ marginTop: 8 }}>
            <Link to="/roadmap">Retour aux parcours</Link>
          </p>
        </Empty>
      );
    }
    return <ErrorState error={track.error} onRetry={track.reload} />;
  }

  if (track.data === null) return null;
  const { data, disclaimer } = track.data;

  return (
    <div className={track.status === "loading" ? "perime" : undefined}>
      <p className="fil">
        <Link to="/roadmap">Parcours</Link> <span aria-hidden="true">/</span> {data.title}
      </p>

      <h1>{data.title}</h1>
      {data.summary !== null && (
        <p className="doux" style={{ maxWidth: "62ch", marginTop: 8 }}>
          {data.summary}
        </p>
      )}

      <div className="rang" style={{ marginTop: 12 }}>
        <span className="badge badge--neutre">
          {data.stepCount} etape{data.stepCount > 1 ? "s" : ""}
        </span>
        <span className="badge badge--neutre">
          {data.coreRoomCount} room{data.coreRoomCount > 1 ? "s" : ""} recommandee
          {data.coreRoomCount > 1 ? "s" : ""}
        </span>
        <span className="badge badge--neutre">{formatDuration(data.estimatedMinutes)}</span>
      </div>

      <Disclaimer text={disclaimer} />

      {/*
        Etapes VERTICALES ET NUMEROTEES. Ici la numerotation encode une vraie
        sequence : l'etape 3 se lit apres l'etape 2. C'est l'inverse du catalogue,
        ou l'ordre n'est qu'un tri et ne porte aucune recommandation.
      */}
      <ol className="etapes">
        {data.steps.map((step) => (
          <li key={step.position} className="etape">
            <div className="etape__puce" aria-hidden="true">
              {step.position}
            </div>

            <div className="etape__corps">
              <h2 className="etape__titre">
                <span className="visuellement-cache">Etape {step.position} : </span>
                {step.title}
              </h2>

              {step.objective !== null && <p className="doux">{step.objective}</p>}

              <p className="petit doux">
                {coreCount(step)} room{coreCount(step) > 1 ? "s" : ""} recommandee
                {coreCount(step) > 1 ? "s" : ""}
                {step.estimatedMinutes !== null && ` — ${formatDuration(step.estimatedMinutes)}`}
              </p>

              <ul className="etape__rooms">
                {step.rooms.map((room) => (
                  <StepRoom key={room.code} room={room} />
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>

      <Provenance provenance={data.provenance} />
    </div>
  );
}

export const roadmapDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/roadmap/$slug",
  component: RoadmapDetail,
});
