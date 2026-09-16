import { createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "./root.js";

/**
 * Anciennes adresses, en francais.
 *
 * POURQUOI ELLES EXISTENT. Les libelles de navigation disent « Catalogue » et
 * « Parcours » ; les adresses disent `/rooms` et `/roadmap`. Quelqu'un qui tape
 * l'adresse a la main, ou qui la devine depuis le libelle, tombe sur la page
 * introuvable. Ce n'est pas sa faute : c'est le produit qui parle deux langues.
 *
 * REDIRECTION, PAS DOUBLON. Deux adresses servant la meme page divisent les
 * liens partages et les references. Ces routes ne rendent rien : elles
 * renvoient, et l'adresse canonique reste celle de l'API.
 */

export const catalogueRedirection = createRoute({
  getParentRoute: () => rootRoute,
  path: "/catalogue",
  beforeLoad: ({ search }) => {
    // Les filtres survivent au renvoi : `/catalogue?q=nmap` doit ouvrir la
    // recherche, pas le catalogue complet.
    throw redirect({ to: "/rooms", search, replace: true });
  },
});

export const parcoursRedirection = createRoute({
  getParentRoute: () => rootRoute,
  path: "/parcours",
  beforeLoad: () => {
    throw redirect({ to: "/roadmap", replace: true });
  },
});
