import type { Pagination as PaginationInfo } from "@thm/shared";
import type { ReactNode } from "react";

export function Pagination({
  pagination,
  onGoTo,
}: {
  pagination: PaginationInfo;
  onGoTo: (page: number) => void;
}): ReactNode {
  const { page, totalPages, total, limit } = pagination;
  if (totalPages <= 1) return null;

  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <nav className="pagination" aria-label="Pagination des résultats">
      <button
        type="button"
        className="bouton"
        disabled={page <= 1}
        onClick={() => {
          onGoTo(page - 1);
        }}
      >
        Précédente
      </button>

      {/* `aria-live` : au clavier, changer de page ne deplace pas le regard.
          L'annonce dit ou on se trouve maintenant. */}
      <span className="pagination__position" aria-live="polite">
        Rooms {first} a {last} sur {total} — page {page} sur {totalPages}
      </span>

      <button
        type="button"
        className="bouton"
        disabled={page >= totalPages}
        onClick={() => {
          onGoTo(page + 1);
        }}
      >
        Suivante
      </button>
    </nav>
  );
}
