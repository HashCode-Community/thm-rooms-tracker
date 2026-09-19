import type { InputHTMLAttributes, ReactNode } from "react";

/**
 * Champ de saisie, avec son etiquette.
 *
 * L'ETIQUETTE N'EST JAMAIS OPTIONNELLE. Un `placeholder` disparait des qu'on
 * tape : un champ qui n'a que lui laisse l'utilisateur sans rappel de ce qu'il
 * est en train de remplir, et ne dit rien du tout a un lecteur d'ecran.
 * `etiquetteCachee` masque visuellement, jamais pour les technologies
 * d'assistance.
 */
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id"> & {
  id: string;
  etiquette: string;
  etiquetteCachee?: boolean;
};

export function Input({ id, etiquette, etiquetteCachee = false, ...reste }: Props): ReactNode {
  return (
    <>
      <label htmlFor={id} className={etiquetteCachee ? "visuellement-cache" : undefined}>
        {etiquette}
      </label>
      <input id={id} className="champ" {...reste} />
    </>
  );
}
