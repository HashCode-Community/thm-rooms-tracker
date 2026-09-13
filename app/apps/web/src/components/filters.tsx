import type { CategoryListResponse, FacetsResponse, SortKey } from "@thm/shared";
import { DEFAULT_SORT, SORT_KEYS } from "@thm/shared";
import { type ReactNode, useEffect, useId, useState } from "react";
import type { RoomSearch } from "../search.js";

/**
 * Panneau de filtres.
 *
 * Il ne detient AUCUN etat de filtre : tout vient de `search`, c'est-a-dire de
 * l'URL, et tout repart par `onChange`. Le seul etat local est le texte des
 * champs de recherche interne aux facettes, qui ne filtre que l'affichage.
 */

export type FilterChange = Partial<RoomSearch>;

type Props = {
  search: RoomSearch;
  facets: FacetsResponse | null;
  /** slug -> nom d'affichage, venu de `/api/tags`. */
  tagNames: Map<string, string>;
  categories: CategoryListResponse["data"];
  onChange: (change: FilterChange) => void;
  onReset: () => void;
};

const SORT_LABELS: Readonly<Record<SortKey, string>> = {
  popular: "Les plus suivies",
  recent: "Republiees recemment",
  shortest: "Les plus courtes",
  longest: "Les plus longues",
  az: "Titre (A-Z)",
  difficulty: "Difficulte croissante",
};

/** Une facette dont les valeurs sont des slugs de tags. */
type TagFacetKey = "tech" | "tool" | "skill";

/**
 * Combien de valeurs avant d'afficher un champ de recherche dans la facette.
 *
 * 179 outils ne se parcourent pas a l'oeil. La reponse n'est ni la troncature —
 * qui cacherait des valeurs sans le dire — ni la pagination d'une liste de cases
 * a cocher, mais un champ de recherche : personne ne lit 179 lignes, tout le
 * monde tape « nmap ».
 */
const SEUIL_RECHERCHE_FACETTE = 20;

export function FilterPanel(props: Props): ReactNode {
  const compact = useIsCompact();
  const active = countActiveFilters(props.search);

  if (!compact) return <Panel {...props} />;

  /*
   * En mobile, le panneau est REPLIE par defaut.
   *
   * Deploye, il mesure plus d'un ecran et demi : il faudrait le faire defiler
   * en entier avant d'apercevoir le premier resultat. Vu dans le navigateur a
   * 390 px, corrige. `<details>` natif : accessible au clavier, annonce par les
   * lecteurs d'ecran, et le nombre de filtres actifs reste visible replie.
   */
  return (
    <details className="repli-filtres">
      <summary>Filtres{active > 0 ? ` (${active})` : ""}</summary>
      <Panel {...props} />
    </details>
  );
}

/**
 * Vrai en dessous du point de rupture du catalogue.
 *
 * La valeur est lue a l'initialisation ET suivie : passer en paysage ou
 * redimensionner une fenetre ne doit pas laisser un panneau replie sur un ecran
 * large, ou l'on ne comprendrait pas pourquoi les filtres ont disparu.
 */
function useIsCompact(): boolean {
  const [compact, setCompact] = useState(() => window.matchMedia("(max-width: 860px)").matches);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 860px)");
    const update = (event: MediaQueryListEvent): void => {
      setCompact(event.matches);
    };
    query.addEventListener("change", update);
    return () => {
      query.removeEventListener("change", update);
    };
  }, []);

  return compact;
}

function Panel({ search, facets, tagNames, categories, onChange, onReset }: Props): ReactNode {
  const sortId = useId();
  const hasFilters = countActiveFilters(search) > 0;

  return (
    <div className="filtres">
      <div>
        <label htmlFor={sortId}>Trier par</label>
        <select
          id={sortId}
          className="champ"
          value={search.sort ?? DEFAULT_SORT}
          onChange={(event) => {
            onChange({ sort: event.target.value as SortKey });
          }}
        >
          {SORT_KEYS.map((key) => (
            <option key={key} value={key}>
              {SORT_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      <DurationFilter search={search} onChange={onChange} />

      <CheckboxFacet
        title="Difficulte"
        options={(facets?.difficulty ?? []).map((entry) => ({
          value: entry.key,
          label: entry.label,
          count: entry.count,
        }))}
        selected={search.difficulty ?? []}
        onToggle={(values) => {
          onChange({ difficulty: values as RoomSearch["difficulty"] });
        }}
      />

      <CheckboxFacet
        title="Type"
        options={(facets?.type ?? []).map((entry) => ({
          value: entry.key,
          label: entry.label,
          count: entry.count,
        }))}
        selected={search.type ?? []}
        onToggle={(values) => {
          onChange({ type: values as RoomSearch["type"] });
        }}
      />

      <CheckboxFacet
        title="Equipe"
        options={(facets?.team ?? []).map((entry) => ({
          value: entry.key,
          label: entry.label,
          count: entry.count,
        }))}
        selected={search.team ?? []}
        onToggle={(values) => {
          onChange({ team: values as RoomSearch["team"] });
        }}
      />

      {(["tech", "tool", "skill"] as const).map((key) => (
        <TagFacet
          key={key}
          facetKey={key}
          title={FACET_TITLES[key]}
          entries={facets?.[key] ?? []}
          tagNames={tagNames}
          selected={search[key] ?? []}
          onToggle={(values) => {
            onChange({ [key]: values } as FilterChange);
          }}
        />
      ))}

      {/* Le filtre de categories ne s'affiche QUE s'il a des valeurs. Un select
          vide dans une interface est un bug aux yeux de l'utilisateur, pas une
          promesse — et la categorisation est un travail editorial de la phase 7. */}
      {categories.length > 0 && (
        <CheckboxFacet
          title="Categorie"
          options={categories.map((entry) => ({
            value: entry.slug,
            label: entry.name,
            count: entry.count,
          }))}
          selected={search.category === undefined ? [] : [search.category]}
          onToggle={(values) => {
            onChange({ category: values[values.length - 1] });
          }}
        />
      )}

      <button type="button" className="bouton" onClick={onReset} disabled={!hasFilters}>
        Tout effacer
      </button>
    </div>
  );
}

const FACET_TITLES: Readonly<Record<TagFacetKey, string>> = {
  tech: "Technologie",
  tool: "Outil",
  skill: "Competence",
};

// --- Facette a cases a cocher ----------------------------------------------

type Option = { value: string; label: string; count: number };

function CheckboxFacet({
  title,
  options,
  selected,
  onToggle,
  searchable = false,
}: {
  title: string;
  options: Option[];
  selected: readonly string[];
  onToggle: (values: string[]) => void;
  searchable?: boolean;
}): ReactNode {
  const [needle, setNeedle] = useState("");
  const searchId = useId();

  const selectedSet = new Set(selected);
  const normalized = needle.trim().toLowerCase();
  const visible = options.filter(
    (option) =>
      selectedSet.has(option.value) ||
      normalized === "" ||
      option.label.toLowerCase().includes(normalized) ||
      option.value.includes(normalized),
  );

  // Les valeurs cochees restent EN TETE. Sans ca, cocher une valeur puis en
  // cocher une autre qui la ramene a zero la renverrait en bas d'une liste
  // defilante : impossible a decocher sans la chercher.
  const ordered = [
    ...visible.filter((option) => selectedSet.has(option.value)),
    ...visible.filter((option) => !selectedSet.has(option.value)),
  ];

  const toggle = (value: string): void => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onToggle([...next]);
  };

  return (
    <fieldset className="facette">
      <legend className="facette__titre">
        {title}
        {selected.length > 0 && ` (${selected.length})`}
      </legend>

      {searchable && (
        <>
          <label htmlFor={searchId} className="visuellement-cache">
            Filtrer la liste {title.toLowerCase()}
          </label>
          <input
            id={searchId}
            type="search"
            className="champ"
            placeholder={`Filtrer (${options.length})`}
            value={needle}
            onChange={(event) => {
              setNeedle(event.target.value);
            }}
            style={{ marginBottom: 6 }}
          />
        </>
      )}

      <div className="facette__liste">
        {ordered.length === 0 && <p className="petit doux">Aucune valeur ne correspond.</p>}
        {ordered.map((option) => (
          <label
            key={option.value}
            className={`option${option.count === 0 ? " option--vide" : ""}`}
          >
            <input
              type="checkbox"
              checked={selectedSet.has(option.value)}
              onChange={() => {
                toggle(option.value);
              }}
            />
            <span className="option__nom" title={option.label}>
              {option.label}
            </span>
            <span className="option__compte">{option.count}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function TagFacet({
  facetKey,
  title,
  entries,
  tagNames,
  selected,
  onToggle,
}: {
  facetKey: TagFacetKey;
  title: string;
  entries: FacetsResponse[TagFacetKey];
  tagNames: Map<string, string>;
  selected: readonly string[];
  onToggle: (values: string[]) => void;
}): ReactNode {
  void facetKey;

  // `/api/facets` ne renvoie que `slug` -> compteur ; les noms viennent de
  // `/api/tags`, mis en cache une heure. Si un tag vient d'apparaitre a l'import
  // et que le cache est encore tiede, on affiche son slug plutot qu'un vide.
  const options = entries.map((entry) => ({
    value: entry.slug,
    label: tagNames.get(entry.slug) ?? entry.slug,
    count: entry.count,
  }));

  return (
    <CheckboxFacet
      title={title}
      options={options}
      selected={selected}
      onToggle={onToggle}
      searchable={options.length > SEUIL_RECHERCHE_FACETTE}
    />
  );
}

// --- Duree ------------------------------------------------------------------

function DurationFilter({
  search,
  onChange,
}: {
  search: RoomSearch;
  onChange: (change: FilterChange) => void;
}): ReactNode {
  const minId = useId();
  const maxId = useId();
  const [min, setMin] = useState(search.durationMin?.toString() ?? "");
  const [max, setMax] = useState(search.durationMax?.toString() ?? "");

  // L'URL reste la source de verite : si elle change ailleurs (bouton retour,
  // lien partage, « tout effacer »), les champs suivent.
  useEffect(() => {
    setMin(search.durationMin?.toString() ?? "");
    setMax(search.durationMax?.toString() ?? "");
  }, [search.durationMin, search.durationMax]);

  const invalid = min !== "" && max !== "" && Number(min) > Number(max);

  return (
    <form
      className="facette"
      onSubmit={(event) => {
        event.preventDefault();
        if (invalid) return;
        onChange({
          durationMin: min === "" ? undefined : Number(min),
          durationMax: max === "" ? undefined : Number(max),
        });
      }}
    >
      <div className="facette__titre">Duree (minutes)</div>
      <div className="rang" style={{ gap: 6, flexWrap: "nowrap" }}>
        <label htmlFor={minId} className="visuellement-cache">
          Duree minimale en minutes
        </label>
        <input
          id={minId}
          type="number"
          inputMode="numeric"
          min={0}
          className="champ"
          placeholder="min"
          value={min}
          aria-invalid={invalid}
          onChange={(event) => {
            setMin(event.target.value);
          }}
        />
        <span aria-hidden="true" className="doux">
          -
        </span>
        <label htmlFor={maxId} className="visuellement-cache">
          Duree maximale en minutes
        </label>
        <input
          id={maxId}
          type="number"
          inputMode="numeric"
          min={0}
          className="champ"
          placeholder="max"
          value={max}
          aria-invalid={invalid}
          onChange={(event) => {
            setMax(event.target.value);
          }}
        />
        <button type="submit" className="bouton" disabled={invalid}>
          OK
        </button>
      </div>
      {invalid && (
        <p className="petit" role="alert" style={{ color: "var(--alerte)", marginTop: 4 }}>
          Le minimum doit etre inferieur au maximum.
        </p>
      )}
    </form>
  );
}

// --- Utilitaires ------------------------------------------------------------

export function countActiveFilters(search: RoomSearch): number {
  let total = 0;
  for (const key of ["difficulty", "type", "team", "tech", "tool", "skill"] as const) {
    total += search[key]?.length ?? 0;
  }
  if (search.category !== undefined) total += 1;
  if (search.durationMin !== undefined) total += 1;
  if (search.durationMax !== undefined) total += 1;
  if (search.q !== undefined) total += 1;
  return total;
}
