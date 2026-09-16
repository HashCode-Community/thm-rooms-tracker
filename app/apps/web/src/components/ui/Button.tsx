import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Bouton.
 *
 * TROIS VARIANTES, PAS PLUS. Une quatrieme signifierait qu'une distinction
 * visuelle porte une information que le libelle ne porte pas — et le libelle
 * doit toujours suffire.
 *
 * `principal` : l'action que la page attend. UN SEUL par vue.
 * `secondaire` : une action possible, sans insistance. Le defaut.
 * `discret` : une action de service (fermer, reinitialiser), qui ne doit pas
 *             disputer l'attention au contenu.
 */
export type VarianteBouton = "principal" | "secondaire" | "discret";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variante?: VarianteBouton;
  /** Etat enfonce d'une bascule. Pose `aria-pressed`, jamais la couleur seule. */
  actif?: boolean;
  children: ReactNode;
};

const CLASSE: Readonly<Record<VarianteBouton, string>> = {
  principal: "bouton bouton--principal",
  secondaire: "bouton",
  discret: "bouton bouton--discret",
};

export function Button({ variante = "secondaire", actif, children, ...reste }: Props): ReactNode {
  const classes = [CLASSE[variante], actif === true ? "bouton--actif" : ""]
    .filter((c) => c !== "")
    .join(" ");

  return (
    <button
      type="button"
      className={classes}
      {...(actif === undefined ? {} : { "aria-pressed": actif })}
      {...reste}
    >
      {children}
    </button>
  );
}
