import type { ReactNode } from "react";

/**
 * Barre d'avancement.
 *
 * UN `<progress>` NATIF. Il porte son role, sa valeur et son maximum sans
 * qu'on ait a les reecrire en ARIA, et il reste lisible quand la feuille de
 * style ne charge pas.
 *
 * `max={total || 1}` : un maximum de zero rend la barre indeterminee, donc
 * animee a l'infini sur un parcours vide. Le pourcentage, lui, vaut bien 100
 * quand il n'y a rien a faire — c'est `computeTrackProgress` qui le decide, pas
 * cet affichage.
 */
type Props = {
  faits: number;
  total: number;
  pourcent: number;
  /** Rend le pourcentage a cote de la barre. */
  avecChiffre?: boolean;
};

export function ProgressBar({ faits, total, pourcent, avecChiffre = false }: Props): ReactNode {
  return (
    <div className="avancement">
      {avecChiffre && (
        <div className="avancement__ligne">
          <strong className="avancement__chiffre">{pourcent} %</strong>
          <span className="petit doux">
            {faits} sur {total} room{total > 1 ? "s" : ""} recommandée{total > 1 ? "s" : ""}
          </span>
        </div>
      )}
      <progress className="avancement__barre" value={faits} max={total || 1}>
        {pourcent} %
      </progress>
    </div>
  );
}
