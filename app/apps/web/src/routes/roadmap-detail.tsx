import { createRoute, Link } from "@tanstack/react-router";
import {
  computeTrackProgress,
  nextStepPosition,
  type TrackDetail,
  type TrackDetailResponse,
  type TrackProgress,
} from "@thm/shared";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { ApiError, urls, useResource } from "../api.js";
import { AnneauProgression } from "../components/AnneauProgression.js";
import { formatDuration } from "../components/badges.js";
import { CheminEnChargement, EtapeDuChemin, etatDeLEtape } from "../components/chemin.js";
import { EntetePage } from "../components/EntetePage.js";
import { Disclaimer, Provenance } from "../components/roadmap.js";
import { Empty, ErrorState } from "../components/states.js";
import { useProgression } from "../progression.js";
import { useTitre } from "../titre.js";
import { rootRoute } from "./root.js";

/** Ancre d'une etape, partagee par le sommaire et le chemin. */
export function ancreEtape(position: number): string {
  return `etape-${position}`;
}

function RoadmapDetail(): ReactNode {
  const { slug } = roadmapDetailRoute.useParams();
  const track = useResource<TrackDetailResponse>(urls.track(slug));
  useTitre(track.data?.data.title ?? null);
  const progression = useProgression();

  const completedCodes = useMemo(
    () => new Set(progression.completedRooms.map((room) => room.code)),
    [progression.completedRooms],
  );

  if (track.status === "loading" && track.data === null) return <CheminEnChargement />;

  if (track.status === "error" && track.data === null) {
    if (track.error instanceof ApiError && track.error.status === 404) {
      return (
        <Empty title={`Aucun parcours publié sous « ${slug} »`}>
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
      <EntetePage
        fil={
          <>
            <Link to="/roadmap">Parcours</Link> <span aria-hidden="true">/</span>{" "}
            <span aria-current="page">{data.title}</span>
          </>
        }
        titre={data.title}
        sousTitre={data.summary ?? undefined}
      />

      {/* La mention a deja ete lue sur la liste des parcours : elle ne se redit
          pas ici. Voir l'amendement du 2026-09-17 dans `roadmap.tsx`. */}
      <Disclaimer text={disclaimer} masquerSiLue />

      <div className="grille-page">
        <div className="colonne-principale">
          {/*
            Le chemin. La numerotation encode ici une vraie SEQUENCE : l'etape 3
            se lit apres l'etape 2. C'est l'inverse du catalogue, ou l'ordre
            n'est qu'un tri et ne porte aucune recommandation.
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

        <aside className="colonne-laterale" aria-label="Votre avancement">
          <SuiviDuParcours data={data} progress={progress} prochaine={prochaine} />
        </aside>
      </div>
    </div>
  );
}

/**
 * Le suivi, dans la colonne de droite.
 *
 * TOUT CE QUI REPOND A « OU J'EN SUIS » est ici, et rien d'autre : l'anneau, ce
 * qu'il reste a faire, la prochaine etape, le sommaire. La colonne etait vide et
 * le contenu s'arretait a 700 px sur un ecran de 1440.
 */
function SuiviDuParcours({
  data,
  progress,
  prochaine,
}: {
  data: TrackDetail;
  progress: TrackProgress;
  prochaine: number | null;
}): ReactNode {
  const etapeSuivante = data.steps.find((step) => step.position === prochaine);

  // Le temps restant ne compte que les etapes NON terminees : afficher la duree
  // totale a quelqu'un qui a fait la moitie du parcours lui ment sur ce qui
  // l'attend.
  const parPosition = new Map(progress.steps.map((step) => [step.position, step]));
  const minutesRestantes = data.steps
    .filter((step) => parPosition.get(step.position)?.complete !== true)
    .reduce((total, step) => total + (step.estimatedMinutes ?? 0), 0);

  return (
    <div className="panneau suivi">
      <h2 className="panneau__titre">Votre avancement</h2>

      <AnneauProgression
        pourcent={progress.percent}
        faits={progress.coreDone}
        total={progress.coreTotal}
      />

      <p className="suivi__reste">
        {progress.percent === 100 ? (
          <strong>Parcours terminé.</strong>
        ) : (
          <>
            <strong>{formatDuration(minutesRestantes)}</strong> de contenu restant
          </>
        )}
      </p>

      {etapeSuivante !== undefined && (
        <a
          className="bouton bouton--principal suivi__suite"
          href={`#${ancreEtape(etapeSuivante.position)}`}
        >
          Prochaine étape : {etapeSuivante.position}. {etapeSuivante.title}
        </a>
      )}

      <ol className="sommaire">
        {data.steps.map((step) => {
          const etat = etatDeLEtape(parPosition.get(step.position), prochaine);
          return (
            <li key={step.position} className={`sommaire__ligne sommaire__ligne--${etat}`}>
              <a href={`#${ancreEtape(step.position)}`}>
                <span className="sommaire__marque" aria-hidden="true">
                  {etat === "faite" ? "✓" : step.position}
                </span>
                <span className="sommaire__titre">{step.title}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export const roadmapDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/roadmap/$slug",
  component: RoadmapDetail,
});
