# ADR-0003 — Schéma PostgreSQL

- **Statut** : accepté
- **Date** : 2026-09-11
- **Décideur** : Nelkaël
- **Amende** : le brief d'amorçage (hors dépôt, voir ADR-0001 D4) phase 3

---

## 1. Une seule table `tags` pour trois facettes

**Décision.** `tags(id, kind, slug, name)` avec `UNIQUE(kind, slug)`, et une seule table de liaison
`room_tags(room_id, tag_id)`. `kind` vaut `technology`, `tool` ou `skill`.

**Alternative écartée.** Trois paires de tables : `technologies`/`room_technologies`,
`tools`/`room_tools`, `skills`/`room_skills`.

**Raison.** Les trois facettes ont un comportement **strictement identique** : liste plate, filtre
`OU` à l'intérieur de la facette, comptage pour les compteurs de facettes. Il n'existe aucune colonne,
aucune contrainte, aucune requête qui différerait entre elles. Trois paires de tables identiques
seraient de la duplication pure, et chaque évolution — compteur dénormalisé, alias, description,
icône — devrait être écrite trois fois et testée trois fois.

`kind` porte la seule différence réelle, qui est une différence de *libellé*, pas de structure.

**Ce qui ferait changer d'avis.** Le jour où une facette acquiert un attribut que les autres n'ont
pas — par exemple une hiérarchie parent/enfant sur les compétences, ou une version sur les outils —
la table unique devient une table à colonnes optionnelles, ce qui est le vrai signal de séparation.
Ce jour-là, extraire une facette est une migration simple. L'inverse, fusionner trois tables
peuplées, ne l'est pas. **On commence donc par la forme la moins coûteuse à défaire.**

**Coût assumé.** Une contrainte d'intégrité de moins : rien n'empêche en base d'associer une room à
un tag de mauvais `kind`. C'est l'importer qui garantit la cohérence, pas le schéma. Acceptable
parce que l'importer est la seule voie d'écriture sur ces tables.

## 2. `slug` et `name` : deux rôles, deux colonnes

| Colonne | Rôle | Casse |
|---|---|---|
| `slug` | clé de déduplication, clé d'unicité, valeur du filtre dans l'URL | **casefold** |
| `name` | forme d'affichage | libre, cosmétique |

**Raison.** La déduplication devient **structurelle** : deux écritures qui ne diffèrent que par la
casse ou la ponctuation produisent le même `slug`, donc le même tag, sans que le mapping ait à les
lister. Le `name` se change ensuite sans migration.

**Vérifié avant d'adopter**, sur le dataset réel après application du mapping :

```
outils        180 valeurs -> 179 slugs   1 collision : "enum4linux" <- [Enum4linux, Enum4Linux]
competences   103 valeurs -> 103 slugs   0 collision
technologies   15 valeurs ->  15 slugs   0 collision
```

L'unique collision est exactement la paire qu'on veut fusionner. **Zéro faux positif** : la
déduplication structurelle est sûre sur ces données.

Conséquence : `data/mappings/normalisation-outils.yaml` ne sert plus qu'aux cas que la normalisation
ne peut pas attraper — les suffixes d'affichage `" NEW"` et les fautes de frappe.

## 3. Deux conventions de casse opposées, volontairement

| Colonne | Type | Casse | Raison |
|---|---|---|---|
| `rooms.code` | `text` | **préservée** | identifiant externe, l'URL TryHackMe en dépend |
| `tags.slug` | `text` | **repliée** | clé de déduplication interne |
| `users.email` | `citext` | repliée | une adresse n'a pas de casse signifiante |

`rooms.code` n'est surtout **pas** `citext` : 14 des 714 codes contiennent des majuscules
(`AIforcyber-aoc2025-y9wWQ1zRgB`, `csrfV2`, `searchskillscS`…). Un `citext` ferait passer
`/rooms/aiforcyber-...` pour une URL valide chez nous, alors que le lien sortant vers TryHackMe
tomberait en 404. Détail complet dans ADR-0001 Q1.

**Ne pas « harmoniser ».** Le commentaire est dans `schema.ts`, la justification est ici.

## 4. `difficulties.level`, parce qu'une enum texte ne se trie pas

`easy < hard` en ordre alphabétique est un hasard ; `medium > hard` est faux. L'ordre pédagogique est
une donnée réelle : `info=0, easy=1, medium=2, hard=3, insane=4`. C'est ce qui permet
`ORDER BY difficulty` et un filtre « difficulté ≤ N », impossibles avec une enum texte seule.

## 5. `rooms.raw` : quatre règles, pas quatre intentions

La colonne conserve la ligne source pour rejouer une transformation sans re-scraper (ADR-0001 D5).

1. jamais dans un `SELECT` par défaut → utiliser `roomPublicColumns` ;
2. jamais exposée par l'API ;
3. jamais indexée ;
4. jamais lue par le front.

La règle 1 est **matérialisée dans le code** : `roomPublicColumns` est un objet exporté par
`schema.ts` qui liste les colonnes exposables. Le passer à `.select()` rend la fuite accidentelle de
`raw` et de `search_vector` impossible. Une règle qu'on peut faire appliquer par le compilateur vaut
mieux qu'une règle écrite dans un document.

## 6. Pas de table `user_track_progress`

L'avancement d'un parcours est **calculé** depuis `user_room_progress`. Stocker un dérivé, c'est
garantir qu'il se désynchronisera un jour, et ce jour-là on ne saura pas laquelle des deux valeurs
est la bonne. 714 rooms et quelques dizaines d'étapes : l'agrégat est gratuit.

## 7. Recherche

- `rooms.search_vector` est une colonne **générée** `STORED`, donc impossible à désynchroniser de
  `title`/`description`. Poids `A` sur le titre, `B` sur la description.
  `to_tsvector('english', …)` avec la regconfig en littéral explicite : cette forme est `IMMUTABLE`,
  contrairement à `to_tsvector(text)` qui dépend de `default_text_search_config` et serait refusée
  dans une colonne générée.
- Index `GIN` sur `search_vector` pour `websearch_to_tsquery`.
- Index `GIN` trigram sur `title` (`pg_trgm`), utilisé **en repli** quand la recherche plein texte ne
  ramène rien : tolérance aux fautes de frappe.

**Extensions.** `pg_trgm` et `citext` ne sont pas gérées par drizzle-kit. Elles sont créées par
`pnpm db:migrate` **avant** d'appliquer les migrations, de façon idempotente
(`CREATE EXTENSION IF NOT EXISTS`). Le SQL généré échouerait sans elles.

## 8. Index : celui qu'on oublie toujours

`room_tags` a pour clé primaire `(room_id, tag_id)`. Cet index composite **ne sert pas** à filtrer par
tag : Postgres ne peut pas l'utiliser efficacement quand seule la deuxième colonne est contrainte.
Sans `room_tags_tag_id_idx`, la requête centrale du catalogue — « toutes les rooms portant ce tag » —
balaierait la table.

Le même raisonnement vaut pour `room_teams`, `room_categories`, `step_rooms` et
`user_room_progress`, qui ont tous un index explicite sur la seconde colonne de leur clé.

## 9. `categories.source` est obligatoire

`room_categories.source` ∈ `thm` | `derived` | `manual`, **NOT NULL**, exposé par l'API et visible
dans l'UI.

- `thm` : fourni par TryHackMe ;
- `derived` : déduit **mécaniquement** des métadonnées du dataset ;
- `manual` : saisi par un humain, y compris sur la base de connaissances externes.

**`derived` n'est jamais utilisé pour un jugement éditorial.** Un regroupement pédagogique relève de
`manual`, même s'il paraît évident. La distinction n'a de valeur que si elle est tenue strictement.

`confidence` n'est renseignée que pour `derived`, et reste `NULL` pour `thm` et `manual` : une
confiance sur une donnée factuelle ou sur une décision humaine n'aurait pas de sens.

## 10. `step_rooms.note` n'est pas une donnée TryHackMe

Le champ porte une justification éditoriale rédigée par nous. « Faire X avant Y » est une
**recommandation**, pas un prérequis factuel : les données TryHackMe ne contiennent aucun prérequis.
Le vocabulaire de l'UI doit le refléter (phase 7).

## 11. Migrations versionnées, jamais `push`

`drizzle.config.ts` est en `strict: true`. Le flux est
`db:generate` → relecture du SQL → `db:migrate`. Jamais de `drizzle-kit push` sur une base, même
locale : on veut un fichier SQL versionné et relu, pas un diff implicite appliqué à l'aveugle.

`drizzle.config.ts` charge le `.env` lui-même via `process.loadEnvFile`, en remontant depuis le
répertoire courant. `import.meta.dirname` y est inutilisable : drizzle-kit compile cette config en CJS
avec esbuild avant de l'évaluer.

## Validation

Base détruite (`docker compose down -v`) puis recréée vierge :

```
Extensions
  ok  pg_trgm    index trigram sur rooms.title
  ok  citext     users.email insensible a la casse
Migrations
  ok  migrations appliquees
15 tables en base
```

Seed des référentiels relancé deux fois, comptes inchangés (5 / 2 / 3) : idempotent.
`difficulties` se trie bien par `level`, ce que l'enum texte seule ne permettrait pas.
