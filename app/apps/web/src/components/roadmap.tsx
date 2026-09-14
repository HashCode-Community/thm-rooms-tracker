import { Link } from "@tanstack/react-router";
import type { Provenance as ProvenanceData, TrackRoom } from "@thm/shared";
import type { ReactNode } from "react";
import { RoomCompletionControl } from "../progression.js";
import { DifficultyBadge, formatDuration, TypeBadge } from "./badges.js";

/**
 * Elements propres aux parcours.
 *
 * VOCABULAIRE, partout dans ce fichier : une etape « recommande » des rooms. Jamais
 * « requiert », jamais « prerequis ». Les donnees TryHackMe ne contiennent aucun
 * prerequis, et un parcours ecrit a la main reste une recommandation editoriale
 * meme quand il parait evident.
 */

/**
 * Mention obligatoire. En tete de page, pas en note de bas de page.
 *
 * Le texte vient de l'API : une interface qui le recopierait pourrait le recopier
 * de travers, ou l'oublier a la prochaine refonte.
 */
export function Disclaimer({ text }: { text: string | undefined }): ReactNode {
  if (text === undefined) return null;
  return (
    <p className="mention">
      <strong>A lire avant de suivre un parcours.</strong> {text}
    </p>
  );
}

/**
 * D'ou vient ce parcours.
 *
 * Affichee, pas rangee dans un repli : un parcours dont la methode de construction
 * est invisible se lit comme une autorite.
 */
export function Provenance({
  provenance,
  compact = false,
}: {
  provenance: ProvenanceData;
  compact?: boolean;
}): ReactNode {
  const validated = provenance.validated_by_completion;

  if (compact) {
    return (
      <p className="petit doux">
        {validated
          ? "Suivi de bout en bout par l'equipe."
          : "Non suivi de bout en bout par notre equipe."}
      </p>
    );
  }

  return (
    <section className="provenance" aria-label="Provenance du parcours">
      <h2 className="provenance__titre">Comment ce parcours a ete construit</h2>
      <p>{provenance.method}</p>

      {provenance.sources.length > 0 && (
        <>
          <p className="petit doux" style={{ marginTop: 8 }}>
            Sur la base de :
          </p>
          <ul className="petit doux">
            {provenance.sources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </>
      )}

      {provenance.notes !== undefined && <p className="petit doux">{provenance.notes}</p>}

      <p style={{ marginTop: 8 }}>
        <strong>
          {validated
            ? "Ce parcours a ete suivi de bout en bout par notre equipe."
            : "Ce parcours n'a PAS ete suivi de bout en bout par notre equipe."}
        </strong>
      </p>
    </section>
  );
}

const REQUIREMENT_LABELS: Readonly<Record<TrackRoom["requirement"], string>> = {
  core: "Recommandee",
  optional: "Optionnelle",
  bonus: "Bonus",
};

/**
 * Une room dans une etape.
 *
 * `note` s'affiche SOUS la room, jamais repliee. Plusieurs notes signalent que la
 * suite d'une serie est payante : c'est souvent l'information la plus utile de
 * l'etape, et la masquer serait la pire chose a en faire.
 */
export function StepRoom({ room }: { room: TrackRoom }): ReactNode {
  return (
    <li className={`etape-room etape-room--${room.requirement}`}>
      <div className="etape-room__ligne">
        <Link to="/rooms/$code" params={{ code: room.code }} className="etape-room__titre">
          {room.title}
        </Link>
        <span className={`badge badge--${room.requirement === "core" ? "core" : "neutre"}`}>
          {REQUIREMENT_LABELS[room.requirement]}
        </span>
        <DifficultyBadge difficulty={room.difficulty} />
        <TypeBadge type={room.type} />
        <span className="petit doux">{formatDuration(room.durationMinutes)}</span>
        <RoomCompletionControl code={room.code} presentation="checkbox" />
      </div>

      {room.note !== null && <p className="etape-room__note">{room.note}</p>}
    </li>
  );
}
