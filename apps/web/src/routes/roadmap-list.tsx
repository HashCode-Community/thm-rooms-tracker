import { createRoute, Link } from "@tanstack/react-router";
import type { TrackListResponse } from "@thm/shared";
import type { ReactNode } from "react";
import { urls, useResource } from "../api.js";
import { formatDuration } from "../components/badges.js";
import { Disclaimer, Provenance } from "../components/roadmap.js";
import { Empty, ErrorState, Loading } from "../components/states.js";
import { rootRoute } from "./root.js";

const LEVEL_LABELS: Readonly<Record<string, string>> = {
  beginner: "Debutant",
  intermediate: "Intermediaire",
  advanced: "Avance",
};

function RoadmapList(): ReactNode {
  const tracks = useResource<TrackListResponse>(urls.tracks());

  return (
    <>
      <div className="intro">
        <h1>Parcours</h1>
        <p className="doux">
          Un ordre de lecture dans les 714 rooms. Chaque etape <strong>recommande</strong> des rooms
          — ce ne sont pas des prerequis techniques : les donnees TryHackMe n'en contiennent aucun.
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

              <div className="rang">
                <span className="badge badge--neutre">
                  {LEVEL_LABELS[track.level] ?? track.level}
                </span>
                <span className="badge badge--neutre">
                  {track.stepCount} etape{track.stepCount > 1 ? "s" : ""}
                </span>
                <span className="badge badge--neutre">
                  {track.coreRoomCount} room{track.coreRoomCount > 1 ? "s" : ""} recommandee
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
