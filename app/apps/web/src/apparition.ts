import { useCallback } from "react";

/**
 * Apparition a l'entree dans la fenetre.
 *
 * UNE SEULE FOIS, ET JAMAIS EN BLOQUANT. L'element est visible dans le document
 * des le depart — c'est son OPACITE qui change, pas sa presence : un lecteur
 * d'ecran, un moteur de recherche et une impression voient tout, tout de suite.
 * L'observateur se debranche apres le premier passage, sinon la page rejouerait
 * l'effet a chaque aller-retour de defilement, ce qui est le defaut le plus
 * fatigant du genre.
 *
 * SOUS `prefers-reduced-motion`, RIEN NE SE DECLENCHE : la classe est posee
 * immediatement, et la feuille de style neutralise la transition. On ne
 * raccourcit pas l'animation, on ne la joue pas.
 *
 * Le retour est une REF DE RAPPEL : elle s'attache a l'element lui-meme, sans
 * balise supplementaire. Envelopper chaque section dans un `<div>` casserait les
 * grilles qui les contiennent.
 */
export function useApparition(): (element: HTMLElement | null) => void {
  return useCallback((element: HTMLElement | null) => {
    if (element === null) return;

    const reduit =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduit || typeof IntersectionObserver === "undefined") {
      element.classList.add("apparu");
      return;
    }

    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const entree of entrees) {
          if (!entree.isIntersecting) continue;
          entree.target.classList.add("apparu");
          observateur.disconnect();
        }
      },
      // Un quart de l'element suffit : attendre qu'il soit entier a l'ecran
      // ferait apparaitre les grandes sections apres qu'on a commence a les
      // lire.
      { threshold: 0.25 },
    );
    observateur.observe(element);
  }, []);
}
