import type { Provenance as ProvenanceData } from "@thm/shared";
import type { ReactNode } from "react";

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
      <strong>À lire avant de suivre un parcours.</strong> {text}
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
          ? "Suivi de bout en bout par l'équipe."
          : "Non suivi de bout en bout par notre équipe."}
      </p>
    );
  }

  return (
    <section className="provenance" aria-label="Provenance du parcours">
      <h2 className="provenance__titre">Comment ce parcours a été construit</h2>
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
            ? "Ce parcours a été suivi de bout en bout par notre équipe."
            : "Ce parcours n'a PAS été suivi de bout en bout par notre équipe."}
        </strong>
      </p>
    </section>
  );
}
