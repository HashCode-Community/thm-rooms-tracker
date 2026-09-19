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
  /**
   * Vrai quand cet etat EST la page.
   *
   * Sur une page introuvable, le titre de l'etat est le seul titre : sans
   * `<h1>`, un lecteur d'ecran arrive sur une page sans point d'entree, et c'est
   * precisement la page ou l'on est deja perdu. Ailleurs — un catalogue sans
   * resultat, un parcours sans room terminee — la page a deja son `<h1>` et cet
   * etat n'est qu'un bloc.
   */
  titrePrincipal?: boolean;
};

export function EmptyState({ titre, icone, children, titrePrincipal = false }: Props): ReactNode {
  return (
    <div className="etat etat--vide">
      {icone !== undefined && (
        <div className="etat__icone" aria-hidden="true">
          {icone}
        </div>
      )}
      {titrePrincipal ? (
        <h1 className="etat__titre">{titre}</h1>
      ) : (
        <p className="etat__titre">{titre}</p>
      )}
      {children}
    </div>
  );
}
