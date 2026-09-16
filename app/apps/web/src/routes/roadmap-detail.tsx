import { createRoute, Link } from "@tanstack/react-router";
import { computeTrackProgress, nextStepPosition, type TrackDetailResponse } from "@thm/shared";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { ApiError, urls, useResource } from "../api.js";
import { formatDuration } from "../components/badges.js";
import { CheminEnChargement, EtapeDuChemin, etatDeLEtape } from "../components/chemin.js";
import { Disclaimer, Provenance } from "../components/roadmap.js";
import { Empty, ErrorState } from "../components/states.js";
import { ProgressBar } from "../components/ui/index.js";
import { useProgression } from "../progression.js";
import { rootRoute } from "./root.js";

function RoadmapDetail(): ReactNode {
  const { slug } = roadmapDetailRoute.useParams();
  const track = useResource<TrackDetailResponse>(urls.track(slug));
  const progression = useProgression();

  const completedCodes = useMemo(
    () => new Set(progression.completedRooms.map((room) => room.code)),
    [progression.completedRooms],
  );

  if (track.status === "loading" && track.data === null) return <CheminEnChargement />;

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

  const progress = computeTrackProgress(data.steps, completedCodes);
  const prochaine = nextStepPosition(progress);
  const parPosition = new Map(progress.steps.map((step) => [step.position, step]));

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

      {/* L'avancement passe AVANT les chiffres du parcours : « ou j'en suis »
          prime sur « combien ca pese ». */}
      <ProgressBar
        faits={progress.coreDone}
        total={progress.coreTotal}
        pourcent={progress.percent}
        avecChiffre
      />

      <div className="rang" style={{ marginTop: 12 }}>
        <span className="badge badge--neutre">
          {data.stepCount} étape{data.stepCount > 1 ? "s" : ""}
        </span>
        <span className="badge badge--neutre">{formatDuration(data.estimatedMinutes)}</span>
      </div>

      <Disclaimer text={disclaimer} />

      {/*
        Le chemin. La numerotation encode ici une vraie SEQUENCE : l'etape 3 se
        lit apres l'etape 2. C'est l'inverse du catalogue, ou l'ordre n'est qu'un
        tri et ne porte aucune recommandation.
      */}
      <ol className="chemin">
        {data.steps.map((step) => (
          <EtapeDuChemin
            key={step.position}
            step={step}
            progress={parPosition.get(step.position)}
            etat={etatDeLEtape(parPosition.get(step.position), prochaine)}
            completedCodes={completedCodes}
          />
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
