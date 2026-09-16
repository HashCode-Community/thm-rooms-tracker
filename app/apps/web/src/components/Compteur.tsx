import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

/**
 * Compteur qui monte.
 *
 * DEUX REGLES, et la seconde compte plus que l'effet.
 *
 * 1. `prefers-reduced-motion` COUPE L'ANIMATION, pas seulement sa duree. La
 *    valeur finale s'affiche immediatement. Une animation « raccourcie » reste
 *    une animation, et quelqu'un qui demande moins de mouvement demande moins de
 *    mouvement.
 *
 * 2. LES VALEURS INTERMEDIAIRES SONT MASQUEES AUX LECTEURS D'ECRAN. Un nombre
 *    qui change soixante fois par seconde dans l'arbre d'accessibilite est du
 *    bruit, et certains lecteurs l'annoncent. Le chiffre anime porte donc
 *    `aria-hidden`, et la vraie valeur est rendue a cote, visuellement cachee.
 *
 * L'animation ne se rejoue pas a chaque rendu : elle est liee a la valeur
 * cible, pas au cycle de vie du composant.
 */

const DUREE_MS = 900;

/** Ralentit en fin de course : le chiffre se pose, il ne s'arrete pas net. */
function adoucir(avancement: number): number {
  return 1 - (1 - avancement) ** 3;
}

function mouvementReduit(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function Compteur({ valeur }: { valeur: number }): ReactNode {
  const [affiche, setAffiche] = useState(() => (mouvementReduit() ? valeur : 0));
  const image = useRef<number>(0);

  useEffect(() => {
    if (mouvementReduit()) {
      setAffiche(valeur);
      return;
    }

    const depart = performance.now();
    const avancer = (maintenant: number): void => {
      const avancement = Math.min(1, (maintenant - depart) / DUREE_MS);
      setAffiche(Math.round(valeur * adoucir(avancement)));
      if (avancement < 1) image.current = requestAnimationFrame(avancer);
    };
    image.current = requestAnimationFrame(avancer);

    return () => cancelAnimationFrame(image.current);
  }, [valeur]);

  return (
    <>
      <span aria-hidden="true">{affiche.toLocaleString("fr-FR")}</span>
      <span className="visuellement-cache">{valeur.toLocaleString("fr-FR")}</span>
    </>
  );
}
