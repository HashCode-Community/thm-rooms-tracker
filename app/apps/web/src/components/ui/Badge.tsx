import type { ReactNode } from "react";

/**
 * Pastille.
 *
 * REGLE ABSOLUE, tenue par le controleur de contraste et par les tests : la
 * couleur ne porte JAMAIS seule une information. Chaque pastille affiche son
 * libelle en toutes lettres, et sa teinte ne fait qu'accelerer la lecture pour
 * qui la percoit.
 *
 * `imposee` est le seul cas ou une couleur arbitraire entre : celles des
 * equipes viennent de l'API et la feuille de style ne les regle pas. Le texte
 * pose dessus est un token, mesure contre les quatre couleurs reelles.
 */
export type TonPastille =
  | "neutre"
  | "info"
  | "easy"
  | "medium"
  | "hard"
  | "insane"
  | "core"
  | "retiree";

type Props = {
  ton?: TonPastille;
  /** Couleur de fond imposee par les donnees. Exclusive avec `ton`. */
  couleurImposee?: string;
  children: ReactNode;
};

export function Badge({ ton = "neutre", couleurImposee, children }: Props): ReactNode {
  if (couleurImposee !== undefined) {
    return (
      <span className="badge badge--equipe" style={{ background: couleurImposee }}>
        {children}
      </span>
    );
  }
  return <span className={`badge badge--${ton}`}>{children}</span>;
}
