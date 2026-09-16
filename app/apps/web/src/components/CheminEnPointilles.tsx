import type { ReactNode } from "react";

/**
 * Le chemin, en pointilles : l'illustration de l'etat vide.
 *
 * MEME FORME QUE LE GRAPHE DE L'ACCUEIL, en creux. Un etat vide qui ne montre
 * rien laisse croire que la page est cassee ; celui-ci montre le chemin qui
 * attend, sans en dessiner le detail — il n'y a rien a detailler tant que rien
 * n'est commence.
 *
 * Decoratif : le titre et le texte a cote disent la meme chose.
 */
export function CheminEnPointilles(): ReactNode {
  return (
    <svg
      className="chemin-pointilles"
      viewBox="0 0 220 120"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <title>Chemin en pointillés</title>
      <g strokeWidth="2" strokeDasharray="4 6" strokeLinecap="round">
        <path d="M20 60 H96" />
        <path d="M96 60 H108 Q120 60 120 48 V32 Q120 20 132 20 H200" />
        <path d="M96 60 H108 Q120 60 120 72 V88 Q120 100 132 100 H200" />
      </g>
      <g strokeWidth="2">
        <circle cx="20" cy="60" r="5" />
        <circle cx="200" cy="20" r="5" />
        <circle cx="200" cy="100" r="5" />
      </g>
    </svg>
  );
}
