import type { ReactNode, SelectHTMLAttributes } from "react";

/**
 * Liste deroulante.
 *
 * UN `<select>` NATIF, HABILLE — pas un menu reconstruit en div.
 *
 * Une liste deroulante refaite a la main doit reimplementer le clavier, le
 * defilement, la selection au premier caractere, le comportement tactile de
 * chaque plateforme et l'annonce aux lecteurs d'ecran. Elle le fait presque
 * toujours moins bien, et elle le fait moins bien SILENCIEUSEMENT. Le natif
 * donne tout ca gratuitement ; il ne manquait que l'habillage.
 *
 * `appearance: none` retire le chevron du systeme, la feuille en redessine un.
 */
type Option = Readonly<{ valeur: string; libelle: string }>;

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "id" | "children"> & {
  id: string;
  etiquette: string;
  options: readonly Option[];
};

export function Select({ id, etiquette, options, ...reste }: Props): ReactNode {
  return (
    <>
      <label htmlFor={id}>{etiquette}</label>
      <div className="champ-liste">
        <select id={id} className="champ champ--liste" {...reste}>
          {options.map((option) => (
            <option key={option.valeur} value={option.valeur}>
              {option.libelle}
            </option>
          ))}
        </select>
        <span className="champ-liste__chevron" aria-hidden="true" />
      </div>
    </>
  );
}
