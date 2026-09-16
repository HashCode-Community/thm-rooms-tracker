import type { Provenance as ProvenanceData } from "@thm/shared";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Callout } from "./ui/index.js";

/**
 * Elements propres aux parcours.
 *
 * VOCABULAIRE, partout dans ce fichier : une etape « recommande » des rooms. Jamais
 * « requiert », jamais « prerequis ». Les donnees TryHackMe ne contiennent aucun
 * prerequis, et un parcours ecrit a la main reste une recommandation editoriale
 * meme quand il parait evident.
 */

const CLE_LUE = "thm-roadmap.mention-lue";

/**
 * Vrai si la mention a deja ete ouverte dans ce navigateur.
 *
 * Lu en effet, pas au premier rendu : le stockage peut etre inaccessible
 * (navigation privee, cookies bloques) et le composant doit rendre la meme
 * chose des deux cotes plutot que de dependre d'un acces qui peut echouer.
 */
function useMentionLue(): [boolean, () => void] {
  const [lue, setLue] = useState(false);

  useEffect(() => {
    try {
      setLue(window.localStorage.getItem(CLE_LUE) === "1");
    } catch {
      // Stockage inaccessible : la mention se comporte comme jamais lue, ce qui
      // est le repli le plus sur pour une obligation.
    }
  }, []);

  const marquer = (): void => {
    setLue(true);
    try {
      window.localStorage.setItem(CLE_LUE, "1");
    } catch {
      // Sans stockage, elle se redeploiera a la prochaine visite. Tant mieux.
    }
  };

  return [lue, marquer];
}

/**
 * Mention obligatoire.
 *
 * REPLIABLE, PAS MASQUEE. Elle occupait un bloc entier avant tout contenu, si
 * bien qu'elle dominait la page qu'elle accompagne. Repliee, elle reste
 * presente, annoncee, dans le document — donc trouvable par la recherche de
 * page — et l'utilisateur la rouvre d'un clic.
 *
 * AMENDEMENT DU 2026-09-17, decide par Nel. Elle s'ouvrait par defaut, au motif
 * qu'une obligation cachee d'emblee n'en est plus une. Elle est desormais
 * REPLIEE par defaut, et la page du detail la masque entierement une fois
 * qu'elle a ete ouverte : la meme phrase, lue sur la liste puis relue sur chaque
 * parcours, cesse d'etre lue du tout. Elle reste dans le document sur la liste,
 * toujours annoncee, toujours depliable.
 *
 * Le texte vient de l'API : une interface qui le recopierait pourrait le
 * recopier de travers, ou l'oublier a la prochaine refonte.
 */
export function Disclaimer({
  text,
  masquerSiLue = false,
}: {
  text: string | undefined;
  /** Sur une page qui n'est pas le point d'entree des parcours. */
  masquerSiLue?: boolean;
}): ReactNode {
  const [lue, marquer] = useMentionLue();
  if (text === undefined) return null;
  if (masquerSiLue && lue) return null;

  return (
    <Callout
      ton="neutre"
      titre="À lire avant de suivre un parcours"
      repliable
      ouvertParDefaut={false}
      onOuverture={marquer}
    >
      <p>{text}</p>
    </Callout>
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
