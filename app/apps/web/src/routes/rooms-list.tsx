import { createRoute, useNavigate } from "@tanstack/react-router";
import type { CategoryListResponse, FacetsResponse, RoomListResponse } from "@thm/shared";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { type Async, loadCategories, loadTags, urls, useResource } from "../api.js";
import { countActiveFilters, type FilterChange, FilterPanel } from "../components/filters.js";
import { Pagination } from "../components/pagination.js";
import { RoomCard } from "../components/room-card.js";
import { SearchBox } from "../components/search-box.js";
import { Empty, ErrorState, Loading } from "../components/states.js";
import { type RoomSearch, toApiQuery, toFacetQuery, validateRoomSearch } from "../search.js";
import { rootRoute } from "./root.js";

function RoomsList(): ReactNode {
  const search = roomsListRoute.useSearch();
  const navigate = useNavigate({ from: roomsListRoute.fullPath });

  const roomQuery = toApiQuery(search);
  const facetQuery = toFacetQuery(search);

  const rooms = useResource<RoomListResponse>(urls.rooms(roomQuery));
  const facets = useResource<FacetsResponse>(urls.facets(facetQuery));
  const reference = useReferenceData();

  /**
   * Tout changement de filtre RAMENE A LA PAGE 1.
   *
   * Sans ca : on est page 12, on coche un filtre qui ne laisse que trois
   * resultats, et on tombe sur une page vide en croyant que le filtre ne donne
   * rien. Le tri seul echappe a la regle ? Non : changer de tri change l'ordre,
   * donc la page 12 ne designe plus les memes rooms. On y retourne aussi.
   */
  const applyChange = useCallback(
    (change: FilterChange): void => {
      // `page: undefined` plutot que `page: 1` : la page 1 est la valeur par
      // defaut, elle n'a rien a faire dans l'URL.
      void navigate({
        search: (previous) => ({ ...previous, ...change, page: undefined }),
      });
    },
    [navigate],
  );

  const applySearchTerm = useCallback(
    (term: string | undefined): void => {
      // `replace` : le bouton retour ramene a la vue precedente, pas a l'etat
      // intermediaire de chaque frappe.
      void navigate({
        search: (previous) => ({ ...previous, q: term, page: undefined }),
        replace: true,
      });
    },
    [navigate],
  );

  const goToPage = useCallback(
    (page: number): void => {
      void navigate({ search: (previous) => ({ ...previous, page }) });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [navigate],
  );

  // « Tout effacer » retire les FILTRES, pas les preferences d'affichage :
  // le tri choisi et la taille de page survivent.
  const reset = useCallback((): void => {
    void navigate({
      search: () => ({ sort: search.sort, limit: search.limit, page: undefined }),
    });
  }, [navigate, search.sort, search.limit]);

  const activeCount = countActiveFilters(search);

  return (
    <>
      <h1 style={{ marginBottom: 16 }}>Catalogue</h1>

      <div className="rang" style={{ marginBottom: 16, alignItems: "flex-end" }}>
        <SearchBox value={search.q ?? ""} onSearch={applySearchTerm} />
      </div>

      <div className="catalogue">
        <FilterPanel
          search={search}
          facets={facets.data}
          tagNames={reference.tagNames}
          categories={reference.categories}
          onChange={applyChange}
          onReset={reset}
        />

        <section aria-label="Resultats">
          <ResultsHeader search={search} rooms={rooms} activeCount={activeCount} />

          {rooms.status === "error" && rooms.data === null && (
            <ErrorState error={rooms.error} onRetry={rooms.reload} />
          )}

          {rooms.status === "loading" && rooms.data === null && (
            <Loading label="Chargement du catalogue" />
          )}

          {rooms.data !== null && rooms.data.pagination.total === 0 && (
            <Empty title="Aucune room ne correspond a ces filtres">
              <p className="petit doux">
                {search.q === undefined
                  ? "Retirez un filtre pour elargir la recherche."
                  : `Aucun resultat pour « ${search.q} », meme en tolerant les fautes de frappe.`}
              </p>
              {activeCount > 0 && (
                <p style={{ marginTop: 8 }}>
                  <button type="button" className="bouton" onClick={reset}>
                    Tout effacer
                  </button>
                </p>
              )}
            </Empty>
          )}

          {rooms.data !== null && rooms.data.pagination.total > 0 && (
            <div className={rooms.status === "loading" ? "perime" : undefined}>
              <ul className="grille-rooms">
                {rooms.data.data.map((room) => (
                  <RoomCard key={room.code} room={room} />
                ))}
              </ul>
              <Pagination pagination={rooms.data.pagination} onGoTo={goToPage} />
            </div>
          )}

          {/* Une erreur survenue alors qu'une liste est deja affichee : on garde
              la liste et on signale l'echec, plutot que de tout effacer. */}
          {rooms.status === "error" && rooms.data !== null && (
            <div style={{ marginTop: 16 }}>
              <ErrorState error={rooms.error} onRetry={rooms.reload} />
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function ResultsHeader({
  search,
  rooms,
  activeCount,
}: {
  search: RoomSearch;
  rooms: Async<RoomListResponse> & { reload: () => void };
  activeCount: number;
}): ReactNode {
  const total = rooms.data?.pagination.total;
  const strategy = rooms.data?.search?.strategy;

  // Ne jamais annoncer « Chargement… » alors qu'une erreur est affichee juste
  // en dessous : les deux messages se contrediraient.
  const compte =
    total !== undefined
      ? `${total.toLocaleString("fr-FR")} room${total > 1 ? "s" : ""}`
      : rooms.status === "error"
        ? "Resultats indisponibles"
        : "Chargement…";

  return (
    <div className="barre-resultats">
      <span className="barre-resultats__compte" aria-live="polite">
        {compte}
      </span>

      {activeCount > 0 && (
        <span className="petit doux">
          {activeCount} filtre{activeCount > 1 ? "s" : ""} actif{activeCount > 1 ? "s" : ""}
        </span>
      )}

      {/* L'API dit quelle strategie de recherche a reellement servi. Le taire
          laisserait l'utilisateur croire a une recherche exacte alors qu'il lit
          des resultats approches. */}
      {strategy === "trigram" && search.q !== undefined && (
        <span className="petit doux">
          Aucun resultat exact pour « {search.q} » : recherche approchee sur les titres.
        </span>
      )}
    </div>
  );
}

/**
 * Donnees de reference : noms des tags et categories.
 *
 * Elles ne dependent d'aucun filtre et ne changent qu'a l'import. Un echec ici
 * ne doit PAS casser le catalogue : sans les noms, les facettes affichent les
 * slugs, ce qui reste utilisable.
 */
function useReferenceData(): {
  tagNames: Map<string, string>;
  categories: CategoryListResponse["data"];
} {
  const [tagNames, setTagNames] = useState<Map<string, string>>(new Map());
  const [categories, setCategories] = useState<CategoryListResponse["data"]>([]);

  useEffect(() => {
    let alive = true;

    void loadTags()
      .then((response) => {
        if (!alive) return;
        setTagNames(new Map(response.data.map((tag) => [tag.slug, tag.name])));
      })
      .catch(() => {
        /* Les slugs feront l'affaire. */
      });

    void loadCategories()
      .then((response) => {
        if (alive) setCategories(response.data);
      })
      .catch(() => {
        /* Filtre de categories masque, ce qui est deja son etat normal. */
      });

    return () => {
      alive = false;
    };
  }, []);

  return { tagNames, categories };
}

export const roomsListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/rooms",
  validateSearch: validateRoomSearch,
  component: RoomsList,
});
