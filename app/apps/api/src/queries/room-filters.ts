import type { FacetKey, RoomFilters, SortKey } from "@thm/shared";
import { and, eq, exists, gte, inArray, lte, type SQL, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  categories,
  difficulties,
  roomCategories,
  rooms,
  roomTags,
  roomTeams,
  roomTypes,
  tags,
  teams,
} from "../db/schema.js";

/**
 * Construction des conditions du catalogue.
 *
 * AUCUNE CONCATENATION DE CHAINE SQL. Les valeurs passent par le constructeur de
 * requetes ou par les emplacements d'un gabarit `sql`, donc par des parametres
 * lies. Les seuls litteraux ecrits a la main sont des mots-cles SQL fixes
 * (`DESC NULLS LAST`), jamais une valeur venue du client.
 */

/**
 * Seuil de similarite trigramme du repli de recherche.
 * MESURE sur ce dataset : `nmap` -> `furthernmap` donne 0,29. 0,2 attrape les
 * fautes de frappe utiles sans ramener n'importe quoi.
 */
export const TRIGRAM_THRESHOLD = 0.2;

export type SearchStrategy = "fulltext" | "trigram" | "none";

/**
 * Decide la strategie de recherche pour un terme donne.
 *
 * La decision porte sur `q` SEUL, evalue contre le catalogue actif entier — jamais
 * sur le resultat filtre. C'est indispensable a la coherence : `/api/rooms` et
 * `/api/facets` partagent les memes filtres mais pas les memes sous-ensembles, et
 * `/api/facets` en evalue six a la fois. Une decision prise sur « ce
 * sous-ensemble-la ramene zero » rendrait les compteurs incoherents avec la liste
 * qu'ils sont censes decrire.
 */
export async function resolveSearchStrategy(q: string | undefined): Promise<SearchStrategy> {
  if (q === undefined) return "none";

  const [row] = await db
    .select({
      hit: sql<boolean>`exists (
        select 1 from ${rooms}
        where ${rooms.isActive}
          and ${rooms.searchVector} @@ websearch_to_tsquery('english', ${q})
      )`,
    })
    .from(sql`(select 1) as probe`);

  return row?.hit === true ? "fulltext" : "trigram";
}

function searchCondition(q: string, strategy: SearchStrategy): SQL | undefined {
  if (strategy === "fulltext") {
    return sql`${rooms.searchVector} @@ websearch_to_tsquery('english', ${q})`;
  }
  if (strategy === "trigram") {
    return sql`similarity(${rooms.title}, ${q}) >= ${TRIGRAM_THRESHOLD}`;
  }
  return undefined;
}

function tagCondition(kind: "technology" | "tool" | "skill", slugs: string[]): SQL {
  // EXISTS correle : OU a l'interieur de la facette (le `IN`), et un EXISTS par
  // facette donne le ET entre facettes.
  return exists(
    db
      .select({ present: sql`1` })
      .from(roomTags)
      .innerJoin(tags, eq(tags.id, roomTags.tagId))
      .where(and(eq(roomTags.roomId, rooms.id), eq(tags.kind, kind), inArray(tags.slug, slugs))),
  );
}

/**
 * Conditions `WHERE` du catalogue.
 *
 * `omit` retire UN filtre de l'ensemble. C'est ce qui rend les compteurs de
 * facettes utilisables : voir `src/queries/facets.ts`.
 */
export function buildRoomConditions(
  filters: RoomFilters,
  options: { strategy: SearchStrategy; omit?: FacetKey | undefined },
): SQL[] {
  const { strategy, omit } = options;
  // Une room disparue du scrape est desactivee, jamais supprimee : elle sort du
  // catalogue mais garde son historique et sa progression utilisateur.
  const conditions: SQL[] = [eq(rooms.isActive, true)];

  if (filters.q !== undefined) {
    const condition = searchCondition(filters.q, strategy);
    if (condition !== undefined) conditions.push(condition);
  }

  if (omit !== "difficulty" && filters.difficulty !== undefined) {
    conditions.push(
      inArray(
        rooms.difficultyId,
        db
          .select({ id: difficulties.id })
          .from(difficulties)
          .where(inArray(difficulties.key, filters.difficulty)),
      ),
    );
  }

  if (omit !== "type" && filters.type !== undefined) {
    conditions.push(
      inArray(
        rooms.roomTypeId,
        db.select({ id: roomTypes.id }).from(roomTypes).where(inArray(roomTypes.key, filters.type)),
      ),
    );
  }

  if (omit !== "team" && filters.team !== undefined) {
    conditions.push(
      exists(
        db
          .select({ present: sql`1` })
          .from(roomTeams)
          .innerJoin(teams, eq(teams.id, roomTeams.teamId))
          .where(and(eq(roomTeams.roomId, rooms.id), inArray(teams.key, filters.team))),
      ),
    );
  }

  if (omit !== "tech" && filters.tech !== undefined) {
    conditions.push(tagCondition("technology", filters.tech));
  }
  if (omit !== "tool" && filters.tool !== undefined) {
    conditions.push(tagCondition("tool", filters.tool));
  }
  if (omit !== "skill" && filters.skill !== undefined) {
    conditions.push(tagCondition("skill", filters.skill));
  }

  // `category` n'est pas une facette a compteur : c'est un filtre unique.
  if (filters.category !== undefined) {
    conditions.push(
      exists(
        db
          .select({ present: sql`1` })
          .from(roomCategories)
          .innerJoin(categories, eq(categories.id, roomCategories.categoryId))
          .where(and(eq(roomCategories.roomId, rooms.id), eq(categories.slug, filters.category))),
      ),
    );
  }

  if (filters.durationMin !== undefined) {
    conditions.push(gte(rooms.durationMinutes, filters.durationMin));
  }
  if (filters.durationMax !== undefined) {
    conditions.push(lte(rooms.durationMinutes, filters.durationMax));
  }

  return conditions;
}

/**
 * Expressions de tri.
 *
 * TOUTE liste se termine par `code ASC`, sans exception.
 *
 * Ce n'est pas de la coquetterie. MESURE sur les 714 rooms :
 *
 *   tri par duree       710 rooms ex aequo   (28 valeurs distinctes)
 *   tri par difficulte  714 rooms ex aequo   ( 5 valeurs distinctes)
 *   tri par date        192 rooms ex aequo   (595 valeurs distinctes)
 *   tri par popularite    6 rooms ex aequo   (711 valeurs distinctes)
 *   tri par titre         6 rooms ex aequo   (711 valeurs distinctes)
 *
 * Sans departage, PostgreSQL est libre de rendre les ex aequo dans n'importe quel
 * ordre, et cet ordre peut changer d'une requete a l'autre — plan different, cache
 * different, parallelisme. Avec une pagination par offset, la consequence est
 * immediate : des rooms vues deux fois sur deux pages consecutives, d'autres
 * jamais. `code` est unique, donc l'ordre devient TOTAL et la pagination stable.
 *
 * Y compris pour `popular`, ou les ex aequo sont rares : rare n'est pas jamais.
 *
 * `NULLS LAST` partout : aujourd'hui aucune de ces colonnes n'est nulle en base,
 * mais le schema l'autorise et `DESC` place les NULL en TETE par defaut. Une
 * absence de donnee ne doit jamais ouvrir un classement.
 */
const SORT_EXPRESSIONS: Readonly<Record<SortKey, SQL>> = {
  popular: sql`${rooms.usersCount} desc nulls last`,
  recent: sql`${rooms.publishedAt} desc nulls last`,
  shortest: sql`${rooms.durationMinutes} asc nulls last`,
  longest: sql`${rooms.durationMinutes} desc nulls last`,
  // `lower(...)` et pas `${rooms.title}` nu : MESURE sur postgres:16-alpine, dont
  // la base declare pourtant `en_US.utf8`. musl n'implemente pas les collations
  // glibc, donc le tri retombe sur l'ordre des octets et range les majuscules
  // avant les minuscules : « CCT2019 » avant « Cache Me Outside ». Le meme SQL
  // sur une image Debian ou chez un hebergeur gere donnerait l'ordre inverse.
  //
  // Un tri A-Z qui change selon la libc du serveur n'est pas un tri. `lower()`
  // rend l'ordre INDEPENDANT de la collation et conforme a l'attente humaine.
  az: sql`lower(${rooms.title}) asc`,
  difficulty: sql`${difficulties.level} asc`,
};

/** Le departage obligatoire. Exporte pour que le jeu de tests puisse le citer. */
export const TIE_BREAKER: SQL = sql`${rooms.code} asc`;

export function buildOrderBy(sort: SortKey): SQL[] {
  return [SORT_EXPRESSIONS[sort], TIE_BREAKER];
}
