import type { ReactNode } from "react";

/**
 * Encart.
 *
 * `repliable` emploie `<details>` natif : l'ouverture et la fermeture, le
 * clavier et l'annonce sont ceux du navigateur, et le contenu reste dans le
 * document meme replie — donc trouvable par la recherche de la page.
 *
 * La mention obligatoire des parcours est repliable mais pas MASQUEE : elle
 * s'ouvre a la premiere visite et se referme ensuite. Une obligation qu'on
 * cache par defaut n'est plus une obligation.
 */
export type TonEncart = "neutre" | "alerte" | "erreur";

type Props = {
  ton?: TonEncart;
  titre: ReactNode;
  children: ReactNode;
  repliable?: boolean;
  ouvertParDefaut?: boolean;
  /** Appele la premiere fois que l'encart est deploye. */
  onOuverture?: () => void;
};

export function Callout({
  ton = "neutre",
  titre,
  children,
  repliable = false,
  ouvertParDefaut = true,
  onOuverture,
}: Props): ReactNode {
  const classe = `encart encart--${ton}`;

  if (!repliable) {
    return (
      <div className={classe}>
        <p className="encart__titre">{titre}</p>
        {children}
      </div>
    );
  }

  return (
    <details
      className={classe}
      open={ouvertParDefaut}
      onToggle={(evenement) => {
        if (evenement.currentTarget.open) onOuverture?.();
      }}
    >
      <summary className="encart__titre">{titre}</summary>
      {children}
    </details>
  );
}
