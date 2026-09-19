import type { ReactNode } from "react";

/**
 * Squelette de chargement.
 *
 * AUX DIMENSIONS DU CONTENU REEL, jamais generiques. Trois barres a 60 / 85 /
 * 40 % garantissent le decalage de mise en page au moment ou les donnees
 * arrivent — c'est-a-dire exactement la chose qu'un squelette existe pour
 * eviter. Chaque forme ci-dessous a la hauteur de ce qu'elle remplace.
 */
export type FormeSquelette = "titre" | "ligne" | "room" | "carte" | "chiffre" | "libelle";

export function Skeleton({ forme }: { forme: FormeSquelette }): ReactNode {
  return <div className={`squelette squelette--${forme}`} />;
}
