import { useEffect } from "react";

/**
 * Le titre du document, par route.
 *
 * TOUTES LES PAGES PORTAIENT LE MEME TITRE. Consequence concrete : dix onglets
 * ouverts sur le site sont dix onglets identiques, un favori ne dit pas sur
 * quoi il pointe, et un lecteur d'ecran annonce la meme chose a chaque
 * navigation — alors que c'est justement la ou il faut dire qu'on a change de
 * page.
 *
 * `null` veut dire « pas encore connu » : le titre d'une room arrive avec la
 * reponse de l'API. On garde alors le titre precedent plutot que d'afficher un
 * gabarit vide le temps du chargement.
 */
const NOM = "THM Roadmap";

export function useTitre(titre: string | null): void {
  useEffect(() => {
    if (titre === null) return;
    document.title = `${titre} — ${NOM}`;
  }, [titre]);
}
