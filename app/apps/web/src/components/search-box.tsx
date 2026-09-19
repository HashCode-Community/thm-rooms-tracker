import { type ReactNode, useEffect, useId, useRef, useState } from "react";

/**
 * Champ de recherche plein texte.
 *
 * C'EST LA COMMANDE PRINCIPALE DU CATALOGUE. Elle avait la taille d'un champ de
 * formulaire ordinaire, perdue au-dessus de la grille. Elle est maintenant dans
 * l'en-tete de page, haute de 52 px, avec sa loupe et son raccourci.
 *
 * Trois choix qui se justifient :
 *
 * 1. DEBOUNCE de 300 ms. Sans lui, chaque frappe declencherait une requete et
 *    une entree d'historique.
 * 2. Navigation en REMPLACEMENT (`replace`) pour la recherche. Le bouton retour
 *    doit ramener a la vue precedente, pas defiler les huit etats intermediaires
 *    de « picklerick » lettre par lettre.
 * 3. Raccourci « / ». Il n'est pris QUE si le focus n'est pas deja dans une
 *    saisie : sinon taper une barre oblique dans un champ deplacerait le focus,
 *    ce qui est exactement le contraire de ce qu'on attend.
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
  const champ = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    const surTouche = (evenement: KeyboardEvent): void => {
      if (evenement.key !== "/" || evenement.ctrlKey || evenement.metaKey || evenement.altKey) {
        return;
      }
      const cible = evenement.target;
      const saisieEnCours =
        cible instanceof HTMLElement &&
        (cible.tagName === "INPUT" ||
          cible.tagName === "TEXTAREA" ||
          cible.tagName === "SELECT" ||
          cible.isContentEditable);
      if (saisieEnCours) return;
      evenement.preventDefault();
      champ.current?.focus();
    };
    window.addEventListener("keydown", surTouche);
    return () => {
      window.removeEventListener("keydown", surTouche);
    };
  }, []);

  return (
    <div className="recherche">
      <label htmlFor={inputId} className="visuellement-cache">
        Rechercher une room
      </label>
      <span className="recherche__loupe" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <title>Loupe</title>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" strokeLinecap="round" />
        </svg>
      </span>
      <input
        id={inputId}
        ref={champ}
        type="search"
        className="recherche__champ"
        aria-keyshortcuts="/"
        placeholder="Rechercher une room : titre, description, « nmap »…"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
      />
      {/* Le raccourci est ANNONCE, pas devine. Il disparait des que le champ
          sert : garder un rappel de raccourci a cote du texte saisi n'aide
          personne. */}
      {draft === "" && (
        <span className="recherche__raccourci" aria-hidden="true">
          /
        </span>
      )}
    </div>
  );
}
