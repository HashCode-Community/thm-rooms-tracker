import type { CSSProperties, ReactNode } from "react";

/**
 * Anneau de progression.
 *
 * UN CHIFFRE AU CENTRE, UN ARC AUTOUR. La barre horizontale dit la meme chose,
 * mais dans une colonne laterale de 360 px elle se lit comme un separateur de
 * plus ; l'anneau se lit comme un etat.
 *
 * `pathLength="1"` : la longueur du cercle devient 1, donc l'arc rempli vaut
 * directement la fraction terminee. Aucun calcul de perimetre, aucune constante
 * a recalculer si le rayon change.
 *
 * Le dessin porte `aria-hidden` : le texte a cote dit la meme chose en toutes
 * lettres, et c'est lui que les lecteurs d'ecran annoncent.
 */
export function AnneauProgression({
  pourcent,
  faits,
  total,
}: {
  pourcent: number;
  faits: number;
  total: number;
}): ReactNode {
  return (
    <div className="anneau">
      <svg
        className="anneau__dessin"
        viewBox="0 0 100 100"
        aria-hidden="true"
        style={{ "--fraction": pourcent / 100 } as CSSProperties}
      >
        <circle className="anneau__piste" cx="50" cy="50" r="42" pathLength={1} />
        <circle className="anneau__arc" cx="50" cy="50" r="42" pathLength={1} />
      </svg>
      <div className="anneau__centre">
        <strong className="anneau__chiffre">{pourcent}&nbsp;%</strong>
        <span className="petit doux">
          {faits} sur {total}
        </span>
      </div>
    </div>
  );
}
