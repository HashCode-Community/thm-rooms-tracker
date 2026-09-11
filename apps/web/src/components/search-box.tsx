import { type ReactNode, useEffect, useId, useRef, useState } from "react";

/**
 * Champ de recherche plein texte.
 *
 * Deux choix qui se justifient :
 *
 * 1. DEBOUNCE de 300 ms. Sans lui, chaque frappe declencherait une requete et une
 *    entree d'historique.
 * 2. Navigation en REMPLACEMENT (`replace`) pour la recherche. Le bouton retour
 *    doit ramener a la vue precedente, pas defiler les huit etats intermediaires
 *    de « picklerick » lettre par lettre.
 */
export function SearchBox({
  value,
  onSearch,
}: {
  value: string;
  onSearch: (term: string | undefined) => void;
}): ReactNode {
  const inputId = useId();
  const [draft, setDraft] = useState(value);
  const lastPushed = useRef(value);

  // L'URL reste la source de verite : retour arriere, lien partage, effacement
  // des filtres remettent le champ en accord avec elle.
  useEffect(() => {
    if (value !== lastPushed.current) {
      lastPushed.current = value;
      setDraft(value);
    }
  }, [value]);

  useEffect(() => {
    if (draft === lastPushed.current) return;
    const timer = setTimeout(() => {
      lastPushed.current = draft;
      onSearch(draft.trim() === "" ? undefined : draft.trim());
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [draft, onSearch]);

  return (
    <div style={{ flex: "1 1 240px", minWidth: 0 }}>
      <label htmlFor={inputId}>Rechercher une room</label>
      <input
        id={inputId}
        type="search"
        className="champ"
        placeholder="titre ou description, ex. « nmap »"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
      />
    </div>
  );
}
