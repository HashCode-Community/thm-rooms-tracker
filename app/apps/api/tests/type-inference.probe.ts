/**
 * Sonde d'inference de types. Ce fichier ne s'execute jamais : il n'existe que
 * pour ECHOUER A LA COMPILATION si l'inference se degrade.
 *
 * Motif : un compilateur qui rend `any` ne produit aucune erreur. La degradation
 * d'inference est donc silencieuse par nature, et c'est exactement l'un des trois
 * criteres de repli de la porte TypeScript 7 (ADR-0002). Un typecheck vert ne
 * prouve rien tout seul ; celui-ci si.
 */

import type { RoomListQuerySchema, RoomSource, SortKey } from "@thm/shared";
import { count, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../src/db/client.js";
import { rooms, tags } from "../src/db/schema.js";

/** Vaut `true` uniquement si T est exactement `any`. */
type IsAny<T> = 0 extends 1 & T ? true : false;

/** Ne compile que si T n'est pas `any`. */
type NotAny<T> = IsAny<T> extends true ? never : T;
const assertNotAny = <T>(_value: NotAny<T>): void => {};

/** Ne compile que si A et B sont exactement le meme type. */
type Exact<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const assertExact = <_A, _B>(_proof: Exact<_A, _B>): void => {};

// --- Drizzle : inference sur un select projete -----------------------------

const roomQuery = db
  .select({ code: rooms.code, title: rooms.title, active: rooms.isActive })
  .from(rooms)
  .where(eq(rooms.isActive, true));

type RoomRow = Awaited<typeof roomQuery>[number];

assertNotAny<RoomRow>({} as RoomRow);
assertExact<RoomRow["code"], string>(true);
assertExact<RoomRow["title"], string>(true);
assertExact<RoomRow["active"], boolean>(true);

// `description` est nullable en base : l'inference doit le refleter.
const withDescription = db.select({ description: rooms.description }).from(rooms);
assertExact<Awaited<typeof withDescription>[number]["description"], string | null>(true);

// Agregat.
const countQuery = db.select({ total: count() }).from(rooms);
assertExact<Awaited<typeof countQuery>[number]["total"], number>(true);

// Enum Postgres : l'union litterale doit survivre, pas s'aplatir en `string`.
const tagQuery = db.select({ kind: tags.kind }).from(tags);
assertExact<Awaited<typeof tagQuery>[number]["kind"], "technology" | "tool" | "skill">(true);

// --- Zod : inference du contrat partage ------------------------------------

assertNotAny<RoomSource>({} as RoomSource);
assertExact<RoomSource["code"], string>(true);
assertExact<RoomSource["difficulty"], "info" | "easy" | "medium" | "hard" | "insane">(true);
assertExact<RoomSource["type"], "walkthrough" | "challenge">(true);

// --- Zod : inference des filtres du catalogue ------------------------------
//
// Ajoute en phase 5 apres une degradation REELLE : une premiere ecriture de
// `multiValue` passait par `.pipe(z.array(item))`, et l'inference retombait a
// `difficulty?: any`. Le typecheck restait vert, les filtres auraient accepte
// n'importe quoi, et rien ne l'aurait signale. C'est precisement le mode de
// defaillance que cette sonde existe pour rendre visible.

type CatalogQuery = z.infer<typeof RoomListQuerySchema>;

assertNotAny<CatalogQuery["difficulty"]>({} as CatalogQuery["difficulty"]);
assertNotAny<CatalogQuery["team"]>({} as CatalogQuery["team"]);
assertNotAny<CatalogQuery["tech"]>({} as CatalogQuery["tech"]);

// Les unions litterales doivent survivre a `multiValue`, sinon la validation
// n'est plus qu'un `string[]`.
assertExact<
  CatalogQuery["difficulty"],
  Array<"info" | "easy" | "medium" | "hard" | "insane"> | undefined
>(true);
assertExact<CatalogQuery["team"], Array<"Red" | "Blue" | "Purple"> | undefined>(true);
assertExact<CatalogQuery["tech"], string[] | undefined>(true);

// `sort`, `page` et `limit` ont une valeur par defaut : jamais `undefined` en
// sortie de validation, sinon les gestionnaires devraient les redefaultiser.
assertExact<CatalogQuery["sort"], SortKey>(true);
assertExact<CatalogQuery["page"], number>(true);
assertExact<CatalogQuery["limit"], number>(true);

// --- Preuve que la sonde mord vraiment -------------------------------------
// Decommenter pour verifier que ce fichier echoue quand il doit :
//   const poison = JSON.parse("{}");        // type `any`
//   assertNotAny<typeof poison>(poison);    // -> erreur de compilation attendue
