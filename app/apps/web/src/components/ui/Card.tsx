import type { ReactNode } from "react";

/**
 * Carte.
 *
 * L'etat `faite` pose un lisere, PAS un fond : un aplat colore sur une grille
 * de vingt-quatre cartes fabrique vingt-quatre taches. Le lisere se lit au
 * balayage et laisse le contenu tranquille. Il ne suffit pas a lui seul — la
 * carte affiche aussi le mot.
 */
type Props = {
  faite?: boolean;
  children: ReactNode;
};

export function Card({ faite = false, children }: Props): ReactNode {
  return <li className={`carte${faite ? " carte--faite" : ""}`}>{children}</li>;
}
