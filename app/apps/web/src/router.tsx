import { createRouter } from "@tanstack/react-router";
import { ErrorState } from "./components/states.js";
import { homeRoute } from "./routes/home.js";
import { progressionRoute } from "./routes/progression.js";
import { roadmapDetailRoute } from "./routes/roadmap-detail.js";
import { roadmapListRoute } from "./routes/roadmap-list.js";
import { roomDetailRoute } from "./routes/room-detail.js";
import { roomsListRoute } from "./routes/rooms-list.js";
import { rootRoute } from "./routes/root.js";
import { parseSearch, stringifySearch } from "./search.js";

/**
 * Routes declarees en code, sans generation de fichier.
 *
 * Ce petit arbre ne justifie ni un greffon Vite, ni une generation de fichiers.
 */
const routeTree = rootRoute.addChildren([
  homeRoute,
  progressionRoute,
  roomsListRoute,
  roomDetailRoute,
  roadmapListRoute,
  roadmapDetailRoute,
]);

export const router = createRouter({
  routeTree,
  // La convention d'URL du projet, partagee avec l'API (packages/shared).
  // Sans ca, TanStack Router encoderait les tableaux en JSON
  // (`?tech=%5B%22linux%22%5D`) et l'URL de la barre d'adresse ne serait plus
  // celle que l'API comprend.
  parseSearch,
  stringifySearch,
  defaultErrorComponent: ({ error }) => (
    <ErrorState error={error instanceof Error ? error : new Error(String(error))} />
  ),
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
