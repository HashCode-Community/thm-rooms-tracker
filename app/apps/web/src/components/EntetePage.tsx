import type { ReactNode } from "react";

/**
 * En-tete des pages interieures.
 *
 * UNE SEULE FAMILLE VISUELLE. Chaque page interieure posait son titre a sa
 * facon : un `<h1>` nu ici, un fil d'Ariane la, une barre d'outils ailleurs. Le
 * hero de l'accueil, lui, a une identite. Cet en-tete la reprend en sourdine —
 * meme trame, meme titre en display, meme respiration — pour que passer de
 * l'accueil au catalogue ne donne pas l'impression de changer de site.
 *
 * Le fil d'Ariane est une NAVIGATION, pas une decoration : il porte son role et
 * son etiquette, et la page courante n'y est pas un lien.
 */

type Props = {
  /** Elements du fil d'Ariane, hors page courante. */
  fil?: ReactNode;
  titre: string;
  sousTitre?: ReactNode;
  /** Commandes de la page : recherche, export, filtres. */
  actions?: ReactNode;
};

export function EntetePage({ fil, titre, sousTitre, actions }: Props): ReactNode {
  return (
    <header className="entete-page">
      <div className="entete-page__fond" aria-hidden="true" />

      {fil !== undefined && (
        <nav className="fil" aria-label="Fil d'Ariane">
          {fil}
        </nav>
      )}

      <div className="entete-page__ligne">
        <div className="entete-page__texte">
          <h1 className="entete-page__titre">{titre}</h1>
          {sousTitre !== undefined && <p className="entete-page__sous-titre">{sousTitre}</p>}
        </div>
        {actions !== undefined && <div className="entete-page__actions">{actions}</div>}
      </div>
    </header>
  );
}
