import { Link } from "@tanstack/react-router";
import type { TrackSummary } from "@thm/shared";
import type { ReactNode } from "react";
import type { AvancementParcours } from "../avancement.js";
import { formatDuration } from "./badges.js";
import { GlypheParcours } from "./GlypheParcours.js";
import { ProgressBar } from "./ui/index.js";

/**
 * La carte d'un parcours, PARTAGEE par l'accueil et la liste des parcours.
 *
 * L'accueil avait ses propres cartes : autre balisage, autres classes, autre
 * appel a l'action pour le meme objet. Deux representations du meme parcours
 * derivent — l'une gagne une barre de progression que l'autre n'a pas, et
 * personne ne s'en apercoit. Il n'y en a plus qu'une.
 */

const NIVEAUX: Readonly<Record<string, string>> = {
  beginner: "Débutant",
  intermediate: "Intermédiaire",
  advanced: "Avancé",
};

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
export function CarteParcours({
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
        <span className="badge badge--neutre">{NIVEAUX[track.level] ?? track.level}</span>
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
