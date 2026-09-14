# ADR-0001 — Arbitrages initiaux (phases 0 à 2)

- **Statut** : accepté
- **Date** : 2026-09-11
- **Décideur** : Nelkaël
- **Amende** : le brief d'amorçage (hors dépôt, voir D4) §3, §5, phases 3, 5, 6, 8

---

## Pourquoi cette ADR existe

Le brief d'amorçage a été écrit avant que les données soient examinées. Plusieurs de ses affirmations
se sont révélées fausses à la vérification, et plusieurs de ses choix ont été renversés après
discussion. Corriger le brief à chaque arbitrage le transforme en palimpseste : on finit par ne plus
savoir ce qui a été décidé, ni pourquoi.

**Règle adoptée** : le brief est un document daté d'amorçage. Les décisions vivent dans `docs/adr/`.
Une ADR ne se modifie pas : elle est remplacée par une ADR ultérieure qui la supersède. Le brief n'est
touché que lorsqu'une ADR le rend *littéralement faux*, et la correction renvoie vers l'ADR.

---

## Q1 — Identifiant public des rooms : `code`, et suppression de `slug`

**Décision.** `rooms.code` est la seule clé publique. La colonne `slug` est supprimée du schéma.
Routes : `GET /api/rooms/:code` et front `/rooms/:code`.

**Alternatives écartées.**

| Option | Raison du rejet |
|---|---|
| `slug = slugify(title)` | 3 collisions réelles : `preparation`, `threat-hunting-introduction`, `intro-to-detection-engineering`. Exigerait une désambiguïsation et une table de redirection. |
| `slugify(title)` + suffixe du code | Résout les collisions mais garde deux clés, dont une qui change si le titre change. |

**Raison.** Le slug n'apporte aucun bénéfice SEO que `code` n'apporte déjà, et introduit une seconde
clé instable. Bénéfice supplémentaire : l'URL de notre fiche est trivialement dérivable de celle de
TryHackMe et réciproquement.

### Conséquence critique : `code` est sensible à la casse

**14 des 714 codes contiennent des majuscules** (`AIforcyber-aoc2025-y9wWQ1zRgB`, `searchskillscS`,
`csrfV2`, `sq1-aoc2025-FzPnrt2SAu`…). Vérifié : **0 collision en casefold**, tous URL-safe
(`[A-Za-z0-9._~-]`), longueur maximale 44.

Donc :

- `rooms.code` est `text`, **jamais `citext`**. Un `citext` ferait passer `/rooms/aiforcyber-...`
  pour valide alors que le lien sortant vers TryHackMe, lui, tomberait en 404.
- **Rien ne doit `.toLowerCase()` un code** : ni le routeur front, ni le validateur Zod du paramètre,
  ni la construction de l'URL TryHackMe. C'est la « normalisation défensive » ajoutée par réflexe
  qui casse 14 fiches sur 714 : assez peu pour passer inaperçue, assez pour être un bug en production.
- Test de non-régression obligatoire :
  `GET /api/rooms/AIforcyber-aoc2025-y9wWQ1zRgB` → 200, et la variante en minuscules → 404.

### Convention opposée, dans le même schéma : `tags.slug` est casefold

| Colonne | Casse | Raison |
|---|---|---|
| `rooms.code` | **préservée** | identifiant externe, l'URL TryHackMe en dépend |
| `tags.slug` | **casefold** | clé de déduplication interne, la casse n'y porte aucun sens |

Les deux conventions sont volontairement opposées. Elles sont documentées côte à côte ici pour que
personne ne les « harmonise » dans six mois.

---

## Q2 / D1 — Node.js 24 LTS, pas 22

**Décision.** Node 24 LTS (« Krypton »), épinglé par `.nvmrc`, `engines.node: ">=24 <25"` et la même
version en CI.

**Alternative écartée.** Node 22 LTS (« Jod »), imposé par le brief.

**Raison.** Vérifié sur `nodejs.org/dist/index.json` : 24 est LTS et déjà installé sur le poste.
Rétrograder ajoutait une manipulation d'environnement pour zéro gain.

---

## Q3 / Q4 / Q9 — Normalisation des noms d'outils

**Décision.** Le suffixe `" NEW"` est un badge d'affichage du site, pas un élément du nom.

> **Amendé le 2026-09-14 par [ADR-0004](0004-badge-affichage-regle.md).** La version d'origine
> faisait retirer le badge *via* `data/mappings/normalisation-outils.yaml`. Une liste ne couvre
> que ce qu'elle énumère : une valeur badgée inédite créait un doublon silencieux. Le retrait est
> désormais appliqué **par le code**, à toute valeur (`stripDisplaySuffix`), avant toute
> consultation du mapping. Le mapping ne garde que les coquilles réelles. La règle ci-dessous
> reste la bonne règle ; c'est son lieu d'application qui a changé.

**Règle, dans cet ordre exact** — c'est elle, et elle seule, qui décide `merge` ou `rename` :

```
1.  strip  /\s+-?\s*NEW$/i
2.  trim()
3.  comparaison casefold()  →  jumeau trouvé ? merge : rename
```

Le tiret de l'étape 1 est indispensable : sans lui, `Empire - NEW` donne `Empire -` et son jumeau
`Empire` n'est jamais trouvé. La casefold de l'étape 3 l'est tout autant : `Enum4Linux NEW` donne
`Enum4Linux`, dont le jumeau réel s'écrit `Enum4linux`, avec un `l` minuscule.

**L'espace de l'étape 1 est exigé** — `\s+`, pas `\s*`. Corrigé le 2026-09-14 : la
forme d'origine rend tout optionnel, donc en insensible à la casse elle ampute n'importe quel mot
finissant par ces trois lettres. `Renew` devient `Re`. Le badge est un **jeton séparé**, pas une
terminaison. Mesure sur les 304 valeurs distinctes du dataset 1.0.0 : 12 badges, tous précédés
d'un espace ; **0** valeur finit par `NEW` sans espace ; **0** contient `new` ailleurs. Le
resserrement ne change donc rien sur les données livrées.

Ce que l'espace exigé laisse passer en échange — `Nmap-NEW`, `NmapNEW` — n'est pas ignoré : un
filet plus large que la règle **avertit** à l'import, nomme le jumeau probable, et ne transforme
rien. Deviner serait la faute d'origine en plus dangereuse.

**Résultat sur le dataset 1.0.0** : 12 valeurs distinctes portant `" NEW"`, 17 occurrences, 14 rooms.
→ **5 `merge`** (`Empire`, `Enum4Linux`, `Hydra`, `MITRE ATT&CK Framework`, `Responder`) et
**7 `rename`** (orphelins). Plus 2 fautes de frappe : `Burpe Suite` → `Burp Suite`,
`Autospy` → `Autopsy`. Soit **7 paires à fusionner au total**.

**Aucune détection automatique de similarité ne sera implémentée.** Elle produirait 6 faux positifs
connus et vérifiés présents dans le dataset : `LinPeas`/`WinPeas`, `LECmd.exe`/`PECmd.exe`,
`Netcat`/`Ncat`, `Ghidra`/`Hydra`, `ProcDOT`/`Procmon`, `DnSpy`/`ILSpy`. Les fusions sont explicites
et validées à la main.

---

## Q5 — `trim()` généralisé à l'import

**Décision.** `trim()` sur **tous** les champs texte : titres (14 concernés), descriptions (37),
noms de tags (1 outil). Le rapport d'import liste les champs affectés avec leur `code`.

**Raison.** C'est de la normalisation d'espaces, pas une modification de contenu. Le signaler dans le
rapport suffit à respecter la règle « aucune modification silencieuse ».

---

## Q6 — Périmètre : 714 rooms gratuites, colonne `is_free` conservée

**Décision.** Seules les 714 rooms `freeToUse` sont importées. La colonne `rooms.is_free` existe
malgré tout, et vaut **aujourd'hui constamment `true`**.

**Raison.** Le coût d'une colonne booléenne est nul ; celui d'une migration sur une table peuplée ne
l'est pas. Si l'on décide un jour d'indexer aussi les ~607 rooms payantes en les marquant comme
telles, la porte est ouverte sans changement de schéma.

**Piège à connaître.** Tant que la colonne est constante, un index sur `is_free` seul serait inutile.
L'index composite `rooms(is_active, is_free)` reste justifié par `is_active`.

---

## D2 — Intégrité : sidecar sur octets bruts, `meta.checksum` déclassé

**Décision.**

- `meta.checksum` devient **informatif**. L'audit continue de le recalculer, sans bloquer dessus.
  Il disparaîtra du schéma en v2.
- L'intégrité **bloquante** est `data/datasets/rooms.v1.json.sha256`, SHA-256 des **octets bruts**,
  au format `sha256sum` standard.

**Alternative écartée.** Spécifier rigoureusement la définition existante (tri récursif, encodage,
normalisation Unicode, séparateurs) et l'implémenter dans les deux langages. Écrire une spec
exécutable pour une définition bancale, c'est verrouiller une mauvaise idée.

**Raison.** Zéro ambiguïté. Vérifiable par `sha256sum -c` sous Linux, `Get-FileHash` sous Windows,
`hashlib` en Python, `crypto` en Node. Aucune réimplémentation à synchroniser entre Malick et Nel.

### Conséquence non évidente : `.gitattributes`

Le mode de défaillance de ce contrôle est **au checkout, pas au commit**. Il est donc invisible sur
le poste qui produit le fichier et n'apparaît que sur un clone neuf.

`core.autocrlf=true` (défaut Windows) aurait converti les 16 737 LF de `rooms.v1.json` en CRLF au
premier clone, invalidant le SHA-256. `data/datasets/** -text` l'interdit.

Ce n'était pas théorique : le CSV livré avait **déjà** été corrompu dans le commit `c6aa97b`
(172 623 octets stockés au lieu de 173 338), parce qu'il avait été indexé *avant* la création du
`.gitattributes` — git ne réapplique pas les attributs à l'index rétroactivement. Réparé par
`git add --renormalize` en `e2580a1`. `rooms.v1.json` n'a survécu que parce qu'il est nativement en
LF pur : par chance, pas grâce à la règle.

**Garde permanente à mettre en place en phase 10** : la CI doit cloner à neuf et vérifier le sidecar.
Un clone frais testé une fois protège aujourd'hui ; un job CI protège pour toujours.

---

## D3 — Cookie de session : domaine parent commun

**Décision.** Front sur `app.<domaine>`, API sur `api.<domaine>`, cookie de session posé sur le
domaine parent. `SameSite=Lax` fonctionne alors correctement.

**Solution transitoire à coût nul**, tant que le domaine n'est pas acheté : rewrite Vercel
`/api/*` → l'API, ce qui rend l'appel same-origin pour le navigateur et **supprime CORS entièrement**.
C'est déjà ce que fait le proxy Vite en développement, de sorte que dev et prod se comportent pareil.

**Alternative écartée.** `SameSite=None; Secure` + CORS avec liste blanche. Fonctionne, mais réintroduit
CORS et les credentials cross-site sans nécessité.

**Raison.** Le brief imposait Vercel pour le front et Railway/Fly pour l'API : deux eTLD+1 distincts,
donc deux *sites* au sens du navigateur. Un cookie `SameSite=Lax` **n'est pas envoyé sur les requêtes
`fetch` cross-site** : la session n'aurait jamais fonctionné. L'erreur se paie tard et cher.

---

## D4 — Le brief est une hypothèse, le rapport d'audit fait foi

**Décision.** Le brief d'amorçage est un document à tester, pas une spécification. La
source de vérité sur les données est le rapport généré par `pnpm data:audit` dans `data/reports/`.

> **Où est le brief.** Il n'est pas dans ce dépôt : c'est un document de travail interne, conservé
> côté équipe. Les décisions qu'il a produites vivent ici, dans `docs/adr/`, et ce sont elles qui
> font foi. Aucun fichier de ce dépôt ne dépend de sa présence.

**Raison.** Trois chiffres du §5 étaient faux (13 outils `" NEW"` au lieu de 12 distincts / 17
occurrences / 14 rooms ; 6 paires au lieu de 7 ; `~103` compétences alors que 103 est exact), un
libellé était faux (`Enum4Linux`/`Enum4linux` : la forme `Enum4Linux` nue n'existe pas), et cinq
anomalies réelles manquaient.

**Corollaire opérationnel.** Toute correction confirmée est répercutée dans le brief par une
modification séparée. Un brief faux laissé tel quel empoisonne toutes les sessions suivantes.

---

## D5 — `rooms.raw` : conservé, avec garde-fous écrits comme des règles

**Décision.** La colonne `raw JSONB` conserve la ligne source telle quelle. Elle est soumise à quatre
règles, qui sont des règles et non des intentions :

1. `raw` n'est **jamais** dans un `SELECT` par défaut — exclue explicitement des requêtes Drizzle.
2. `raw` n'est **jamais** exposée par l'API.
3. `raw` n'est **jamais** indexée.
4. `raw` n'est **jamais** lue par le front.

**Sa seule fonction** est de rejouer une transformation sans re-scraper.

**Réserve assumée.** Elle duplique ~438 Ko et crée deux représentations des mêmes champs. Les quatre
règles ci-dessus sont ce qui empêche la seconde de devenir une source de vérité concurrente.

---

## C3 — `data/reports/` versionné, `data/exports/` ignoré

**Décision.**

| Dossier | Contenu | Git |
|---|---|---|
| `data/reports/` | rapports d'audit et d'import (`.md`) | **versionné** |
| `data/exports/` | dérivés régénérables (CSV) | **gitignoré** |

**Raison.** Un rapport est une preuve datée : son historique est précisément ce qui le rend utile. Un
CSV de 173 Ko régénérable produirait un gros diff à chaque exécution pour zéro information.

**Corollaire.** Le CSV n'étant plus suivi par git, la question de sa stabilité octet disparaît : la
règle `-text` n'est pas étendue à `data/exports/`. Une règle qu'on n'a pas besoin d'écrire est une
règle qui ne pourra pas devenir fausse.

**Nommage des rapports.** Horodatage **UTC à la minute** : `audit-2026-09-11T0006Z.md`. La date seule
s'écraserait si l'audit tournait deux fois le même jour, ce qui arrivera dès que Malick livrera deux
fois. Un artefact qui fait foi ne doit pas pouvoir disparaître en silence.

---

## C4 / A1 — Versionnement du contrat et coordination avec le scraper

**Décision.** Le contrat reste **strict** : `additionalProperties: false` sur la racine et sur chaque
room. Un champ ajouté par le scraper est **rejeté**, pas ignoré.

**Raison.** La stricte force la coordination plutôt que la dérive silencieuse. Mais elle n'a de sens
que si le message d'erreur est actionnable — d'où le contrôle de version **en amont de Zod** :

| Changement | Bump | Fichier |
|---|---|---|
| ajout de champ | mineur (1.0.0 → 1.1.0) | même fichier |
| suppression ou changement de type | majeur (2.0.0) | `rooms.v2.json` |

L'importer déclare la plage qu'il supporte (`SUPPORTED_DATASET_RANGE = "^1.0.0"`) et vérifie
`meta.datasetVersion` **avant** la validation Zod. Sans ce contrôle, l'erreur remontée serait
`unrecognized key: "imageUrl"`, qui ne dit rien du vrai problème.

Vérifié sur trois datasets fabriqués : le message de version l'emporte bien sur le symptôme Zod.

Le dataset et son schéma voyagent ensemble, jamais l'un sans l'autre : toute évolution du schéma passe
par une PR relue par Malick **et** Nel. Détail dans `docs/data-contract.md`.

---

## Écarts assumés entre le contrat Zod et le JSON Schema

`data/datasets/rooms.schema.json` fait foi. `packages/shared` en est la transcription. Trois écarts,
exportés dans `CONTRACT_NOTES` et répétés dans chaque rapport d'audit :

1. **`meta` est permissif** (`looseObject`). Le JSON Schema n'y pose pas `additionalProperties: false`,
   contrairement à la racine et aux items de `rooms`. Être plus strict divergerait du contrat.
   *À trancher pour la v2 du schéma — zone partagée.*
2. **Les `format` ne deviennent pas des assertions.** En draft 2020-12, `format` est une annotation.
   Les rendre bloquants ferait rejeter des données que le contrat autorise. `meta.scrapedAt` est
   contrôlé par l'audit, pas par Zod.
3. **Aucune normalisation dans la validation.** Un défaut de qualité n'est pas une violation de
   contrat. `trim`, fusions et mappings appartiennent à l'importer.

---

## À réévaluer

| Sujet | Échéance | Déclencheur |
|---|---|---|
| `meta` permissif → strict | v2 du JSON Schema | décision commune Malick/Nel |
| `meta.checksum` retiré du schéma | v2 | le sidecar est le seul mécanisme |
| `is_free` constante à `true` | si les rooms payantes sont indexées | décision produit |
| TypeScript 7 | phase 3 | voir ADR-0002 |
