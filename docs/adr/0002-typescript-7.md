# ADR-0002 — TypeScript 7 adopté

- **Statut** : accepté
- **Date** : 2026-09-11
- **Décideur** : Nelkaël
- **Porte de validation** : exigée par ADR-0001, franchie en phase 3

---

## Contexte

`npm view typescript dist-tags` donne `latest: 7.0.2`. C'est une version stable publiée, mais un
**majeur tout neuf** : le portage natif du compilateur. Le brief n'imposait aucune version.

La phase 1 avait constaté que TS 7 appliquait correctement `strict`, `noUncheckedIndexedAccess` et
`exactOptionalPropertyTypes`. Nel a refusé d'en tirer une conclusion : ces mesures portaient sur deux
applications vides, alors que les deux bibliothèques les plus lourdes en programmation au niveau types
de la stack — Drizzle et `fastify-type-provider-zod` — n'étaient pas encore là. Génériques
profondément récursifs, inférence sur des schémas entiers : c'est là qu'un compilateur casse, pas sur
`strict: true`.

D'où une porte de validation, avec des critères de repli **décidés à l'avance, pas au moment de
l'émotion**.

## Décision

**TypeScript 7.0.2 est adopté.** Les trois critères de repli ont été testés et aucun ne se déclenche.

## Mesures

Périmètre du test : schéma Drizzle complet (15 tables, 6 index dont 2 GIN, colonne générée
`tsvector`, deux types personnalisés, une auto-référence) **et** une route Fastify réellement typée
par Zod via `fastify-type-provider-zod`, qui exécute une requête Drizzle et génère son OpenAPI.

### Critère 1 — erreur non reproductible sous 5.9.3

**Non déclenché.** Une seule erreur a été rencontrée pendant l'écriture du schéma, sur
l'auto-référence `categories.parent_id`. Elle se reproduit **à l'identique** sous les deux versions,
mêmes codes, mêmes positions :

```
TS 7.0.2 : schema.ts(258,14): error TS7022: 'categories' implicitly has type 'any' […]
           schema.ts(271,51): error TS2577: Return type annotation circularly references itself.
TS 5.9.3 : schema.ts(258,14): error TS7022: 'categories' implicitly has type 'any' […]
           schema.ts(271,51): error TS2577: Return type annotation circularly references itself.
```

Ce n'est donc pas une régression de TS 7 : c'est la limite normale de l'inférence sur une table qui
se référence dans son propre initialiseur. Le correctif est le pattern documenté par Drizzle,
`.references((): AnyPgColumn => categories.id)`.

### Critère 2 — inférence dégradée en `any`

**Non déclenché**, et vérifié activement plutôt que supposé.

Un compilateur qui rend `any` ne produit **aucune erreur** : la dégradation d'inférence est
silencieuse par nature. Un typecheck vert ne prouve donc rien tout seul. D'où
`apps/api/tests/type-inference.probe.ts`, qui ne s'exécute jamais et n'existe que pour **échouer à la
compilation** si l'inférence se dégrade :

| Vérification | Résultat |
|---|---|
| `select({code, title, active})` → types concrets | `string`, `string`, `boolean` |
| colonne nullable | `string \| null`, pas `string` |
| agrégat `count()` | `number` |
| enum Postgres | `"technology" \| "tool" \| "skill"`, pas `string` |
| `RoomSource` inféré depuis Zod | union littérale préservée sur `difficulty` et `type` |

La sonde a elle-même été prouvée mordante : injection temporaire d'un `any` et d'un type exact faux,
puis retrait.

```
avec poison  : error TS2345: Argument of type 'any' is not assignable to parameter of type 'never'.
               error TS2345: Argument of type 'true' is not assignable to parameter of type 'false'.
               EXIT=1
sans poison  : EXIT=0
```

### Critère 3 — typecheck > 30 s

**Non déclenché.** TS 7 est de surcroît environ **1,8× plus rapide** :

| Version | passe 1 | passe 2 | passe 3 |
|---|---:|---:|---:|
| TypeScript 7.0.2 | 11,4 s | 7,1 s | **6,4 s** |
| TypeScript 5.9.3 | 13,4 s | 12,0 s | 13,5 s |

Les deux versions compilent les trois packages sans aucune erreur.

## Pourquoi le repli reste peu coûteux

`tsc` **ne sert qu'au typecheck**. Vite passe par Rolldown, Vitest et `tsx` par esbuild, Biome a son
propre parseur, drizzle-kit compile sa config avec esbuild. Aucun de ces outils ne dépend de `tsc`.

C'est l'argument central : le rayon d'impact d'un changement de version du compilateur est limité à
la commande `pnpm typecheck`. Revenir à 5.9.3 est **une ligne de `package.json`**, sans toucher au
code — vérifié, les deux versions compilent le même code sans modification.

## Alternative écartée

**TypeScript 5.9.3**, dernier 5.x, éprouvé par tout l'écosystème. Écarté parce qu'aucun des trois
critères de repli ne se déclenche, et qu'il est mesuré plus lent sur ce projet. Le choisir serait de
la prudence sans objet identifiable.

## Conséquences

- `typescript` est épinglé à `7.0.2` dans les `devDependencies` de la racine.
- `apps/api/tests/type-inference.probe.ts` fait partie du `typecheck` et donc de la CI. **Ne pas le
  supprimer** : c'est lui qui rend la dégradation d'inférence visible.
- Deux `tsconfig` dans `apps/api` : `tsconfig.json` typecheck (src + tests), `tsconfig.build.json`
  build (src seul, avec `rootDir`). La sonde ne doit pas finir dans le bundle de production.

## À réévaluer

| Déclencheur | Action |
|---|---|
| une erreur de type non reproductible sous 5.9.3 | repli immédiat, sans discussion |
| la sonde d'inférence casse sans changement de code applicatif | repli, puis ouvrir un ticket amont |
| `pnpm typecheck` dépasse 30 s | repli |
| phase 10 (CI complète, front typé, tests Vitest) | remesurer les trois critères |
