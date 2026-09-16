import type { ReactNode } from "react";

/**
 * Etat vide.
 *
 * UN ETAT VIDE DIT CE QU'ON PEUT FAIRE, pas seulement qu'il n'y a rien. « Aucun
 * resultat » laisse l'utilisateur devant une impasse ; « aucun resultat, elargis
 * la recherche » lui rend la main.
 *
 * L'icone est decorative et porte `aria-hidden` : le titre porte deja
 * l'information, la repeter en la decrivant serait du bruit au lecteur d'ecran.
 */
type Props = {
  titre: string;
  icone?: ReactNode;
  children?: ReactNode;
};

export function EmptyState({ titre, icone, children }: Props): ReactNode {
  return (
    <div className="etat etat--vide">
      {icone !== undefined && (
        <div className="etat__icone" aria-hidden="true">
          {icone}
        </div>
      )}
      <p className="etat__titre">{titre}</p>
      {children}
    </div>
  );
}
