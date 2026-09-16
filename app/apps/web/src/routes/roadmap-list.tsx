import { createRoute, Link } from "@tanstack/react-router";
import type { TrackListResponse, TrackSummary } from "@thm/shared";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { urls, useResource } from "../api.js";
import { type AvancementParcours, useAvancement } from "../avancement.js";
import { formatDuration } from "../components/badges.js";
import { EntetePage } from "../components/EntetePage.js";
import { GlypheParcours } from "../components/GlypheParcours.js";
import { Disclaimer } from "../components/roadmap.js";
import { Empty, ErrorState, Loading } from "../components/states.js";
import { ProgressBar } from "../components/ui/index.js";
import { useProgression } from "../progression.js";
import { useTitre } from "../titre.js";
import { rootRoute } from "./root.js";

const LEVEL_LABELS: Readonly<Record<string, string>> = {
  beginner: "Débutant",
  intermediate: "Intermédiaire",
  advanced: "Avancé",
};

/**
 * Liste des parcours.
 *
 * LA GRILLE DIT LE CHEMIN. Trois cartes sur trois colonnes affirment trois
 * options equivalentes ; or le premier parcours est le socle des deux autres,
 * qui en partent. La carte large en tete et les deux dessous reprennent la forme
 * du graphe de l'accueil — meme information, deux representations qui se
 * repondent.
 *
 * L'AVERTISSEMENT NE SE REPETE PLUS. Chaque carte portait « Non suivi de bout en
 * bout par notre equipe », soit trois fois la meme phrase sous trois titres
 * differents. Il est dit une fois, en tete, et la mention obligatoire le porte.
 */
function RoadmapList(): ReactNode {
  useTitre("Parcours");
  const tracks = useResource<TrackListResponse>(urls.tracks());
  const progression = useProgression();
  const codes = useMemo(
    () => progression.completedRooms.map((faite) => faite.code),
    [progression.completedRooms],
  );
  const slugs = useMemo(
    () => (tracks.data === null ? [] : tracks.data.data.map((track) => track.slug)),
    [tracks.data],
  );
  const avancements = useAvancement(slugs, codes);

  return (
    <>
      <EntetePage
        titre="Parcours"
        sousTitre={
          <>
            Un ordre de lecture dans les 714 rooms. Chaque étape <strong>recommande</strong> des
            rooms : ce ne sont pas des prérequis techniques, les données TryHackMe n'en contiennent
            aucun.
          </>
        }
      />

      {/* Mention obligatoire, une seule fois sur la page. Le texte vient de
          l'API pour qu'aucune interface ne puisse le recopier de travers. */}
      <Disclaimer text={tracks.data?.disclaimer} />

      {tracks.status === "loading" && tracks.data === null && (
        <Loading label="Chargement des parcours" />
      )}

      {tracks.status === "error" && tracks.data === null && (
        <ErrorState error={tracks.error} onRetry={tracks.reload} />
      )}

      {tracks.data !== null && tracks.data.data.length === 0 && (
        <Empty title="Aucun parcours publié pour l'instant">
          <p className="petit doux">
            Les parcours sont un contenu éditorial, écrit et relu à la main. Ils ne sont pas générés
            à partir des données TryHackMe, qui ne contiennent ni ordre pédagogique ni notion de
            parcours.
          </p>
          <p style={{ marginTop: 8 }}>
            <Link to="/rooms">Parcourir le catalogue</Link>
          </p>
        </Empty>
      )}

      {tracks.data !== null && tracks.data.data.length > 0 && (
        <ul className={`parcours-liste${tracks.status === "loading" ? " perime" : ""}`}>
          {tracks.data.data.map((track, rang) => (
            <CarteParcours
              key={track.slug}
              track={track}
              avancement={avancements.get(track.slug)}
              large={rang === 0}
            />
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * Une carte de parcours.
 *
 * Toute la carte est la cible : le titre porte le lien, un pseudo element
 * l'etend. L'appel a l'action n'est donc PAS un second lien — il serait annonce
 * deux fois pour une seule destination.
 *
 * Le glyphe identifie le parcours SANS COULEUR : le cyan et le rouge disent deja
 * la difficulte, et un parcours n'est pas une difficulte.
 */
function CarteParcours({
  track,
  avancement,
  large,
}: {
  track: TrackSummary;
  avancement: AvancementParcours | undefined;
  large: boolean;
}): ReactNode {
  const commence = avancement !== undefined && avancement.faits > 0;

  return (
    <li className={`parcours-carte${large ? " parcours-carte--large" : ""}`}>
      <GlypheParcours slug={track.slug} />

      <h2 className="parcours-carte__titre">
        <Link to="/roadmap/$slug" params={{ slug: track.slug }}>
          {track.title}
        </Link>
      </h2>

      <div className="rang">
        <span className="badge badge--neutre">{LEVEL_LABELS[track.level] ?? track.level}</span>
        <span className="badge badge--neutre">
          {track.stepCount} étape{track.stepCount > 1 ? "s" : ""}
        </span>
        <span className="badge badge--neutre">
          {track.coreRoomCount} room{track.coreRoomCount > 1 ? "s" : ""}
        </span>
        <span className="badge badge--neutre">{formatDuration(track.estimatedMinutes)}</span>
      </div>

      {track.summary !== null && <p className="doux parcours-carte__resume">{track.summary}</p>}

      {avancement !== undefined && (
        <ProgressBar
          faits={avancement.faits}
          total={avancement.total}
          pourcent={avancement.pourcentage}
          avecChiffre
        />
      )}

      <span className="parcours-carte__cta" aria-hidden="true">
        {commence ? "Continuer" : "Commencer"}
        <span className="parcours-carte__fleche">→</span>
      </span>
    </li>
  );
}

export const roadmapListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/roadmap",
  component: RoadmapList,
});
