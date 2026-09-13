/**
 * FIXTURE FIGEE. NE PAS CORRIGER LES ERREURS DE CE FICHIER.
 *
 * Copie volontairement empoisonnee de `tests/type-inference.probe.ts`.
 * Son role est d'ECHOUER a la compilation. Une etape CI lance `tsc` dessus et
 * exige `EXIT=1`.
 *
 * Pourquoi : la sonde d'inference garde contre une degradation silencieuse en
 * `any`. Mais un garde peut cesser de garder, lui aussi en silence — il suffit
 * que quelqu'un vide ses assertions, et tout reste vert. Ce fichier verifie que
 * le mecanisme de la sonde est encore capable d'echouer.
 *
 * EXCLU du tsconfig de typecheck : il ferait echouer `pnpm typecheck`, ce qui
 * est precisement son objet. Il n'est compile que par `pnpm typecheck:guard`.
 */

/** Vaut `true` uniquement si T est exactement `any`. */
type IsAny<T> = 0 extends 1 & T ? true : false;
type NotAny<T> = IsAny<T> extends true ? never : T;
const assertNotAny = <T>(_value: NotAny<T>): void => {};

type Exact<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const assertExact = <_A, _B>(_proof: Exact<_A, _B>): void => {};

// POISON 1 : `any` doit etre rejete par assertNotAny.
// Erreur attendue : TS2345, 'any' is not assignable to parameter of type 'never'.
// Le `any` EST le poison : c'est exactement ce que ce fichier doit contenir.
// biome-ignore lint/suspicious/noExplicitAny: poison volontaire, ne pas corriger
const poison: any = JSON.parse("{}");
assertNotAny<typeof poison>(poison);

// POISON 2 : deux types differents doivent etre rejetes par assertExact.
// Erreur attendue : TS2345, 'true' is not assignable to parameter of type 'false'.
assertExact<number, string>(true);
