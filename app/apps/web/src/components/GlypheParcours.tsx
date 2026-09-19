import type { ReactNode } from "react";

/**
 * Le glyphe d'un parcours.
 *
 * IDENTIFIER SANS COULEUR. Le cyan, l'ambre, l'orange et le rouge disent la
 * difficulte d'une room ; les reemployer pour distinguer trois parcours ferait
 * lire « Red Team » comme un cran de difficulte. Une forme distingue aussi bien,
 * et elle reste lisible en niveaux de gris comme sous un daltonisme.
 *
 * Le dessin est DECORATIF : le titre du parcours est a cote, en toutes lettres.
 *
 * Le repli est le socle : un parcours inconnu est un parcours de base tant que
 * personne n'a decide de son signe.
 */

const GLYPHES: Readonly<Record<string, ReactNode>> = {
  // Le socle : trois couches empilees.
  fondamentaux: (
    <>
      <path d="M12 3 21 7.5 12 12 3 7.5 12 3Z" />
      <path d="m3 12 9 4.5 9-4.5" />
      <path d="m3 16.5 9 4.5 9-4.5" />
    </>
  ),
  // L'offensive : une cible.
  "red-team-debutant": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  // La defense : un bouclier.
  "blue-team-debutant": (
    <>
      <path d="M12 3.2 20 6v6.2c0 4.3-3.2 7.4-8 8.6-4.8-1.2-8-4.3-8-8.6V6l8-2.8Z" />
      <path d="m8.8 12.2 2.3 2.4 4.1-4.6" />
    </>
  ),
};

export function GlypheParcours({ slug }: { slug: string }): ReactNode {
  return (
    <span className="glyphe-parcours" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <title>Signe du parcours</title>
        {GLYPHES[slug] ?? GLYPHES.fondamentaux}
      </svg>
    </span>
  );
}
