import type { ReactNode } from "react";

/**
 * Les trois etats, ecrits des le premier jet.
 *
 * Ce n'est pas de la politesse : un ecran blanc pendant un chargement et un ecran
 * blanc apres une erreur se ressemblent, et l'utilisateur conclut que
 * l'application est cassee dans les deux cas. Ajoutes apres coup, ces etats sont
 * toujours ajoutes a moitie.
 */

export function Loading({ label }: { label: string }): ReactNode {
  return (
    <div className="etat" role="status" aria-live="polite">
      <div className="etat__titre">{label}</div>
      <div className="pile" aria-hidden="true" style={{ marginTop: 12 }}>
        <div className="squelette" style={{ width: "60%" }} />
        <div className="squelette" style={{ width: "85%" }} />
        <div className="squelette" style={{ width: "40%" }} />
      </div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }): ReactNode {
  return (
    <div className="etat">
      <div className="etat__titre">{title}</div>
      {children}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: Error;
  onRetry?: (() => void) | undefined;
}): ReactNode {
  return (
    <div className="etat etat--erreur" role="alert">
      <div className="etat__titre">Impossible de charger ces donnees</div>
      {/* Le message vient du `detail` RFC 9457 du serveur : il dit quelque chose
          d'utile, contrairement a un « une erreur est survenue ». */}
      <p className="petit">{error.message}</p>
      {onRetry !== undefined && (
        <p style={{ marginTop: 8 }}>
          <button type="button" className="bouton" onClick={onRetry}>
            Reessayer
          </button>
        </p>
      )}
    </div>
  );
}
