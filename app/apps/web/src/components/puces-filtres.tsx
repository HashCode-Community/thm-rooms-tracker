import type { CategoryListResponse, FacetsResponse } from "@thm/shared";
import type { ReactNode } from "react";
import type { RoomSearch } from "../search.js";
import type { FilterChange } from "./filters.js";

/**
 * Les filtres actifs, en clair, retirables un par un.
 *
 * CE QUI MANQUAIT : le panneau replie annoncait « Filtres (3) » sans dire
 * lesquels. Sur mobile, ou il est replie par defaut, il fallait le deployer,
 * parcourir sept facettes et lire les cases cochees pour savoir ce qu'on
 * filtrait. Un compteur dit qu'il se passe quelque chose ; il ne dit pas quoi.
 *
 * Chaque puce porte son GROUPE : « windows » peut etre une technologie ou un
 * outil, et les deux existent dans les donnees. Sans le groupe, la puce serait
 * ambigue exactement la ou l'utilisateur doute.
 */

type Props = {
  search: RoomSearch;
  facets: FacetsResponse | null;
  tagNames: Map<string, string>;
  categories: CategoryListResponse["data"];
  onChange: (change: FilterChange) => void;
  onReset: () => void;
};

type Puce = { cle: string; groupe: string; libelle: string; retrait: FilterChange };

export function PucesFiltres({
  search,
  facets,
  tagNames,
  categories,
  onChange,
  onReset,
}: Props): ReactNode {
  const puces = construire(search, facets, tagNames, categories);
  if (puces.length === 0) return null;

  return (
    <div className="puces">
      <h2 className="visuellement-cache">Filtres actifs</h2>
      <ul className="puces__liste">
        {puces.map((puce) => (
          <li key={puce.cle}>
            <button
              type="button"
              className="puce"
              aria-label={`Retirer le filtre ${puce.groupe} : ${puce.libelle}`}
              onClick={() => {
                onChange(puce.retrait);
              }}
            >
              <span className="puce__groupe">{puce.groupe}</span>
              <span className="puce__libelle">{puce.libelle}</span>
              <span className="puce__croix" aria-hidden="true">
                ×
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* Sous deux filtres, « tout effacer » fait double emploi avec la puce
          elle-meme et ajoute une cible a viser pour rien. */}
      {puces.length > 1 && (
        <button type="button" className="bouton bouton--lien" onClick={onReset}>
          Tout effacer
        </button>
      )}
    </div>
  );
}

/** Les cles de facette dont les valeurs sont des listes de chaines. */
const LISTES = [
  { cle: "difficulty", groupe: "Difficulté" },
  { cle: "type", groupe: "Type" },
  { cle: "team", groupe: "Équipe" },
  { cle: "tech", groupe: "Technologie" },
  { cle: "tool", groupe: "Outil" },
  { cle: "skill", groupe: "Compétence" },
] as const;

function construire(
  search: RoomSearch,
  facets: FacetsResponse | null,
  tagNames: Map<string, string>,
  categories: CategoryListResponse["data"],
): Puce[] {
  const puces: Puce[] = [];

  if (search.q !== undefined) {
    puces.push({
      cle: "q",
      groupe: "Recherche",
      libelle: `« ${search.q} »`,
      retrait: { q: undefined },
    });
  }

  for (const { cle, groupe } of LISTES) {
    const valeurs = search[cle] ?? [];
    for (const valeur of valeurs) {
      puces.push({
        cle: `${cle}:${valeur}`,
        groupe,
        libelle: libelleDe(cle, valeur, facets, tagNames),
        // Le retrait renvoie la liste SANS cette valeur, jamais `undefined` :
        // vider une liste et supprimer la cle donnent la meme requete, mais la
        // liste vide garde la forme du champ pour le prochain ajout.
        retrait: { [cle]: valeurs.filter((autre) => autre !== valeur) } as FilterChange,
      });
    }
  }

  if (search.category !== undefined) {
    const trouvee = categories.find((entry) => entry.slug === search.category);
    puces.push({
      cle: `category:${search.category}`,
      groupe: "Catégorie",
      libelle: trouvee?.name ?? search.category,
      retrait: { category: undefined },
    });
  }

  if (search.durationMin !== undefined) {
    puces.push({
      cle: "durationMin",
      groupe: "Durée",
      libelle: `à partir de ${search.durationMin} min`,
      retrait: { durationMin: undefined },
    });
  }

  if (search.durationMax !== undefined) {
    puces.push({
      cle: "durationMax",
      groupe: "Durée",
      libelle: `jusqu'à ${search.durationMax} min`,
      retrait: { durationMax: undefined },
    });
  }

  return puces;
}

/**
 * Le libelle affichable d'une valeur de facette.
 *
 * Les facettes portent les libelles traduits ; les tags viennent de `/api/tags`.
 * Si ni l'un ni l'autre n'est arrive — premiere peinture, cache tiede — on
 * affiche le slug. Une puce qui montre `web-hacking` reste retirable ; une puce
 * vide ne le serait pas.
 */
function libelleDe(
  cle: (typeof LISTES)[number]["cle"],
  valeur: string,
  facets: FacetsResponse | null,
  tagNames: Map<string, string>,
): string {
  if (cle === "tech" || cle === "tool" || cle === "skill") {
    return tagNames.get(valeur) ?? valeur;
  }
  const entree = facets?.[cle].find((candidat) => candidat.key === valeur);
  return entree?.label ?? valeur;
}
