import type { FacetKey, RoomFilters } from "@thm/shared";
import { and, asc, count, desc, eq, type SQL } from "drizzle-orm";
import { db } from "../db/client.js";
import { difficulties, rooms, roomTags, roomTeams, roomTypes, tags, teams } from "../db/schema.js";
import { buildRoomConditions, type SearchStrategy } from "./room-filters.js";

/**
 * Compteurs de facettes.
 *
 * LA REGLE, et c'est l'endroit ou presque toutes les implementations se trompent :
 *
 *   le compteur d'une facette F se calcule sur l'ensemble filtre par
 *   TOUS LES FILTRES SAUF F.
 *
 * Comptes sur l'ensemble entierement filtre, les compteurs verrouillent
 * l'interface : l'utilisateur coche `tech=linux`, toutes les autres technologies
 * tombent a zero, et il ne peut plus jamais en ajouter une deuxieme. Or le filtre
 * intra-facette est un OU : cocher Windows EN PLUS de Linux doit elargir le
 * resultat, donc son compteur doit refleter « combien de rooms si je cochais
 * aussi Windows », pas « combien de rooms Windows parmi les rooms Linux ».
 *
 * Une requete par facette, chacune amputee de son propre filtre. Six requetes sur
 * 714 lignes : la performance n'est pas un sujet ici, la justesse si.
 */

/**
 * DEUX NATURES DE DONNEES, DEUX ENDPOINTS.
 *
 * `/api/facets` est appele a CHAQUE changement de filtre. Y faire voyager les
 * noms des 296 tags, identiques d'un appel a l'autre et ne changeant qu'a
 * l'import, c'est melanger une donnee de reference avec un resultat de requete.
 *
 *   /api/tags   -> slug + nom + compteur global, met en cache, change a l'import
 *   /api/facets -> slug + compteur, ne met pas en cache, change a chaque filtre
 *
 * Le front joint les deux sur le `slug`. Mesure : 17,4 ko -> 10,7 ko brut, et
 * 2,5 ko une fois compresse (gzip actif, cf. `buildApp`).
 *
 * ASYMETRIE ASSUMEE : `difficulty`, `type` et `team` gardent leur libelle.
 * Ce sont 10 lignes au total (~400 octets), elles ne vivent dans aucun autre
 * endpoint du catalogue, et leur retirer le libelle obligerait a inventer un
 * `/api/reference` — un aller-retour et un contrat de plus pour economiser
 * 400 octets. Le poids etait dans les 296 tags, pas dans les 10 referentiels.
 */
export type CountedKey = { key: string; label: string; count: number };
/** Sans `name` : la forme d'affichage vient de `/api/tags`. */
export type CountedTag = { slug: string; count: number };

export type Facets = {
  difficulty: Array<CountedKey & { level: number }>;
  type: CountedKey[];
  team: Array<CountedKey & { color: string }>;
  tech: CountedTag[];
  tool: CountedTag[];
  skill: CountedTag[];
};

/** Le sous-ensemble de rooms retenu quand on ignore le filtre `omit`. */
function filteredRooms(filters: RoomFilters, strategy: SearchStrategy, omit: FacetKey) {
  const conditions: SQL[] = buildRoomConditions(filters, { strategy, omit });
  return db
    .select({ id: rooms.id, difficultyId: rooms.difficultyId, roomTypeId: rooms.roomTypeId })
    .from(rooms)
    .where(and(...conditions))
    .as("filtered");
}

async function countByDifficulty(filters: RoomFilters, strategy: SearchStrategy) {
  const filtered = filteredRooms(filters, strategy, "difficulty");
  return db
    .select({
      key: difficulties.key,
      label: difficulties.label,
      level: difficulties.level,
      count: count(filtered.id),
    })
    .from(difficulties)
    .leftJoin(filtered, eq(filtered.difficultyId, difficulties.id))
    .groupBy(difficulties.id, difficulties.key, difficulties.label, difficulties.level)
    .orderBy(asc(difficulties.level));
}

async function countByType(filters: RoomFilters, strategy: SearchStrategy) {
  const filtered = filteredRooms(filters, strategy, "type");
  return db
    .select({ key: roomTypes.key, label: roomTypes.label, count: count(filtered.id) })
    .from(roomTypes)
    .leftJoin(filtered, eq(filtered.roomTypeId, roomTypes.id))
    .groupBy(roomTypes.id, roomTypes.key, roomTypes.label)
    .orderBy(asc(roomTypes.key));
}

async function countByTeam(filters: RoomFilters, strategy: SearchStrategy) {
  const filtered = filteredRooms(filters, strategy, "team");
  return db
    .select({
      key: teams.key,
      label: teams.label,
      color: teams.color,
      count: count(filtered.id),
    })
    .from(teams)
    .leftJoin(roomTeams, eq(roomTeams.teamId, teams.id))
    .leftJoin(filtered, eq(filtered.id, roomTeams.roomId))
    .groupBy(teams.id, teams.key, teams.label, teams.color)
    .orderBy(asc(teams.key));
}

async function countByTag(
  filters: RoomFilters,
  strategy: SearchStrategy,
  kind: "technology" | "tool" | "skill",
  omit: FacetKey,
) {
  const filtered = filteredRooms(filters, strategy, omit);
  return (
    db
      .select({ slug: tags.slug, count: count(filtered.id) })
      .from(tags)
      .leftJoin(roomTags, eq(roomTags.tagId, tags.id))
      .leftJoin(filtered, eq(filtered.id, roomTags.roomId))
      .where(eq(tags.kind, kind))
      .groupBy(tags.id, tags.slug)
      // Le plus utile d'abord, puis `slug` qui est unique par `kind` : l'ordre est
      // TOTAL, donc la reponse est reproductible a l'identique.
      .orderBy(desc(count(filtered.id)), asc(tags.slug))
  );
}

export async function computeFacets(
  filters: RoomFilters,
  strategy: SearchStrategy,
): Promise<Facets> {
  const [difficulty, type, team, tech, tool, skill] = await Promise.all([
    countByDifficulty(filters, strategy),
    countByType(filters, strategy),
    countByTeam(filters, strategy),
    countByTag(filters, strategy, "technology", "tech"),
    countByTag(filters, strategy, "tool", "tool"),
    countByTag(filters, strategy, "skill", "skill"),
  ]);

  return { difficulty, type, team, tech, tool, skill };
}
