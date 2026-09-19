import type { TrackDetail } from "@thm/shared";
import { computeTrackProgress, nextStepPosition } from "@thm/shared";
import { useEffect, useMemo, useState } from "react";
import { loadTrack } from "./api.js";

/**
 * Ou en est le visiteur, parcours par parcours.
 *
 * Le detail d'un parcours porte ses etapes et leurs rooms ; la progression est
 * une liste de codes dans le navigateur. Le croisement se fait ici, avec les
 * MEMES fonctions que la page du parcours — `computeTrackProgress` et
 * `nextStepPosition` vivent dans le paquet partage, et les recopier ici pour
 * l'accueil ferait deux verites sur la meme question.
 *
 * LA REQUETE N'EST FAITE QUE SI ELLE SERT. Un premier visiteur n'a rien
 * termine : il n'y a aucune etape a marquer, donc aucun detail a telecharger.
 * Trois requetes en plus sur la premiere visite couteraient exactement ce
 * qu'elles rapporteraient, c'est-a-dire rien.
 */

export type AvancementParcours = Readonly<{
  slug: string;
  titre: string;
  /** Une entree par etape, dans l'ordre : vrai quand l'etape est terminee. */
  etapes: readonly boolean[];
  /** Position de la prochaine etape a faire, ou `null` si tout est fait. */
  prochaine: number | null;
  pourcentage: number;
  /** Rooms recommandees terminees, et leur total : ce que la barre affiche. */
  faits: number;
  total: number;
}>;

export function useAvancement(
  slugs: readonly string[],
  codesTermines: readonly string[],
): ReadonlyMap<string, AvancementParcours> {
  const [details, setDetails] = useState<readonly TrackDetail[]>([]);
  const cle = slugs.join(",");
  const aQuelqueChose = codesTermines.length > 0;

  useEffect(() => {
    if (!aQuelqueChose || cle === "") return;
    let vivant = true;

    void Promise.all(cle.split(",").map((slug) => loadTrack(slug)))
      .then((reponses) => {
        if (vivant) setDetails(reponses.map((reponse) => reponse.data));
      })
      .catch(() => {
        // L'accueil reste lisible sans : le graphe se dessine sans etape
        // marquee, ce qui est exactement l'etat d'un premier visiteur.
      });

    return () => {
      vivant = false;
    };
  }, [cle, aQuelqueChose]);

  return useMemo(() => {
    const codes = new Set(codesTermines);
    const par = new Map<string, AvancementParcours>();
    for (const detail of details) {
      const progression = computeTrackProgress(detail.steps, codes);
      par.set(detail.slug, {
        slug: detail.slug,
        titre: detail.title,
        etapes: progression.steps.map((etape) => etape.complete),
        prochaine: nextStepPosition(progression),
        pourcentage: progression.percent,
        faits: progression.coreDone,
        total: progression.coreTotal,
      });
    }
    return par;
  }, [details, codesTermines]);
}
