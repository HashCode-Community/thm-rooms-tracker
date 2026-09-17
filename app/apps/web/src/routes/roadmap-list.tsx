import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "./root.js";

/**
 * roadmap-list — declaration de route, sans le composant.
 *
 * Le composant est charge A LA DEMANDE : l'accueil n'a besoin ni du catalogue,
 * ni des parcours, ni de la progression pour s'afficher, et il les payait
 * pourtant dans son premier octet de JavaScript. Mesure avant decoupage :
 * 1,4 s d'execution JavaScript sur le profil mobile de Lighthouse.
 *
 * Le fichier de page importe cette route en retour, pour `useSearch` et
 * `useParams`. Le cycle est rompu par l'import dynamique : la route est dans le
 * paquet principal, la page dans le sien.
 */
export const roadmapListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/roadmap",
  component: lazyRouteComponent(() => import("./roadmap-list-page.js")),
});
