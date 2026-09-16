# Dette de la phase 10 — CI et déploiement

Liste **consolidée** des obligations contractées dans les phases précédentes et dont l'échéance est
la phase 10. Elles vivent aussi dans leur ADR d'origine ; ce fichier existe parce qu'une obligation
répartie dans six documents est une obligation qu'on oublie.

Chaque ligne nomme le mode de défaillance qu'elle empêche. Une garde dont on a oublié pourquoi elle
existe finit par être supprimée comme « inutile ».

---

## CI

> **Les quatre lignes sont fermées le 2026-09-16** par `.github/workflows/verification.yml`.
> Elles restent écrites, barrées : une étape de CI dont on a oublié pourquoi elle existe finit
> par être supprimée comme « lente ». Chaque étape du workflow nomme le mode de défaillance
> qu'elle empêche, et renvoie ici.

| # | À faire | Sans ça |
|---|---|---|
| 1 | ~~**Service PostgreSQL dans la CI**~~ **FAIT le 2026-09-16** | `pnpm test` ne lancerait que l'unitaire. Une CI verte qui ne teste pas les 71 tests d'API est pire que pas de CI : elle donne une garantie qui n'existe pas. Origine : validation phase 5. |
| 2 | ~~**Étape `pnpm typecheck:guard`**~~ **FAIT le 2026-09-16** | La sonde d'inférence peut cesser de mordre en silence — il suffit de vider ses assertions et tout reste vert. [ADR-0002](adr/0002-typescript-7.md) |
| 3 | ~~**Clone neuf + vérification du sidecar SHA-256**~~ **FAIT le 2026-09-16** | Le mode de défaillance des fins de ligne se déclenche **au checkout**, pas au commit. Un `.gitattributes` cassé ne se voit que sur un clone neuf. [ADR-0001](adr/0001-arbitrages-initiaux.md) |
| 4 | ~~**`pnpm data:audit` en dry-run**~~ **FAIT le 2026-09-16** | Un dataset remplacé sans que ses chiffres de contrôle soient revérifiés. |

## Sécurité (échéance phase 9) et déploiement

| # | À faire | Sans ça |
|---|---|---|
| S1 | ~~**Trancher `pnpm audit` : 1 vulnérabilité modérée**~~ **CLOS le 2026-09-16.** `pnpm audit` rend désormais **« No known vulnerabilities found »**. L'exception datée du 2026-09-14 n'est pas reconduite : elle est remplacée par un correctif. Un `override` **ciblé sur le seul chemin vulnérable** — `@esbuild-kit/core-utils>esbuild` — force `>=0.25.0` là où [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) s'applique, sans toucher au `esbuild ^0.25.4` dont `drizzle-kit` dépend directement. C'était l'objection retenue en septembre — « forcer une version d'esbuild sous drizzle-kit change le compilateur qui évalue `drizzle.config.ts` » — et elle tombe dès lors que l'override est ciblé. **Vérifié après coup : `db:generate` et `db:migrate` fonctionnent toujours.** Le réglage vit dans `pnpm-workspace.yaml`, où pnpm 12 lit les paramètres d'espace de travail, et non dans le champ `pnpm` de `package.json`, qu'il ignore silencieusement — première tentative perdue là-dessus. |
| 5 | ~~**`NODE_ENV=production` réellement posé**~~ **FAIT le 2026-09-16.** Vérifié en CI à chaque commit : la production est construite, démarrée, et interrogée. HSTS présent, `/docs` absent. Ce n'est plus « le test prouve que la garde fonctionne quand la configuration dit `exposeDocs: false` » — c'est la production elle-même qui répond. |
| 6 | ~~**Vérifier `/docs` → 404 sur l'environnement déployé**~~ **FAIT le 2026-09-16**, et mieux que prévu : la vérification ne dépend plus d'un déploiement ni d'un `curl` qu'on oublie. L'étape de CI échoue si `/docs` ou `/docs/json` rend autre chose que 404. |
| 6 ter | **Trancher `TRUST_PROXY` au déploiement** | Piège à deux faces, et les deux sont graves. À `false` derrière un proxy, toutes les requêtes portent l'adresse du proxy : la limite de débit devient **un seul seau partagé par tous les visiteurs**, et le site se limite lui-même dès qu'il a du trafic. À `true` sans proxy devant, n'importe qui pose `X-Forwarded-For` et s'attribue un seau neuf à chaque requête : la limite ne limite plus rien. **Il n'existe pas de valeur par défaut sûre.** Celle retenue, `false`, est la moins dangereuse — elle dégrade le service au lieu de l'ouvrir. |
| 6 quater | **Remplir `CORS_ORIGINS` au déploiement** | Vide par défaut : aucun en-tête CORS, donc seule la même origine appelle l'API. C'est juste en développement, où le front passe par le proxy de Vite. En production, [ADR-0001](adr/0001-arbitrages-initiaux.md) D3 met le front sur `<domaine>` et l'API sur `api.<domaine>` : **deux origines différentes, donc le front ne pourra pas appeler l'API tant que la variable est vide**. `*` est refusé au démarrage, pas ignoré. |
| 6 bis | **Vérifier que le proxy accepte une ligne de requête de 2 ko** | `/api/rooms/batch` prend les codes en paramètres répétés. Le client borne l'URL à **2 048 octets** par construction (`BATCH_CHUNK_BYTES`), et un test l'exige pour n'importe quelle longueur de code. Mesuré au navigateur le 2026-09-15 sur les 714 rooms : 8 tranches, URL la plus longue **2 046 octets**. Sans cette borne, une tranche des 200 codes les plus longs ferait 5 906 octets, et `large_client_header_buffers` (8 ko chez nginx) couvre la ligne de requête **et** les en-têtes : avec cookie et `User-Agent`, on entrait dans la zone où ça casse en production et nulle part ailleurs. La vérification reste due parce qu'un proxy réglé sous 2 ko existe. |

| 11 | ~~**Construire et démarrer la production fait partie de la vérification**~~ **FERMÉE le jour de son ouverture, le 2026-09-16.** Le build de production ne démarrait pas : `@thm/shared` exportait son source TypeScript, que `tsx` transpile en développement et que **rien** ne transpile en production. `lint`, `typecheck` et `test` passaient tous les trois — aucun ne construit, aucun ne lance l'artefact construit. La CI le fait maintenant, et vérifie `/health` 200, `/docs` 404, `/docs/json` 404, HSTS présent. |

## Mesures à refaire

| # | À refaire | Déclencheur |
|---|---|---|
| 7 | ~~**Les trois critères de repli TypeScript 7**~~ **REMESURÉS le 2026-09-16 sur le périmètre complet** — `shared` + `api` + `web`, tests et scripts compris, appel direct de `tsc` des deux côtés pour comparer à charge égale. **Critère 1** (erreur non reproductible sous 5.9.3) : non déclenché, **0 erreur** sous les deux. **Critère 2** (inférence dégradée) : non déclenché, `typecheck:guard` mord toujours. **Critère 3** (typecheck > 30 s) : non déclenché sous TS 7 — 17,3 / 13,8 / 16,9 s — et **franchi par le repli lui-même** : TS 5.9.3 met 30,2 / 30,9 / 44,7 s. Se replier violerait désormais le critère qui justifiait de garder le repli. [ADR-0002](adr/0002-typescript-7.md) |

## Poids du bundle front — mesuré, pas estimé

**Mesure du 2026-09-16**, après le commit 4 de la phase 8c, `pnpm --filter @thm/web build:analyse`.
La méthode décode les
`mappings` du source map et additionne les octets **réellement émis** par fichier source :
c'est ce qui a survécu au secouage d'arbre et à la minification, pas la taille des paquets
installés.

```
JS   brut 420,8 ko · gzip 128,6 ko (ratio 30,6 %)
CSS  brut  17,6 ko · gzip   4,0 ko
                     -------------
             total  gzip 132,6 ko
```

**La feuille de style est comptée à partir d'ici.** Les mesures précédentes ne portaient que
sur le paquet JavaScript : un commit qui ne touche que le CSS n'aurait donc rien fait bouger
au chiffre suivi, ce qui est exactement le genre de mesure qui rassure sans rien mesurer.
Aucun delta CSS n'est disponible pour les phases antérieures, faute d'avoir été relevé.

| Dépendance | Brut | gzip estimé | Part |
|---|---:|---:|---:|
| react-dom | 202,2 ko | 62,0 ko | 49,0 % |
| **zod** | **80,8 ko** | **24,8 ko** | **19,6 %** |
| @tanstack/router-core | 51,5 ko | 15,8 ko | 12,5 % |
| (notre code) apps/web | 38,9 ko | 11,9 ko | 9,4 % |
| @tanstack/react-router | 12,1 ko | 3,7 ko | 2,9 % |
| react | 8,0 ko | 2,5 ko | 1,9 % |
| (notre code) @thm/shared | 5,7 ko | 1,7 ko | 1,4 % |
| @tanstack/history | 4,4 ko | 1,4 ko | 1,1 % |
| @tanstack/store | 3,7 ko | 1,1 ko | 0,9 % |
| scheduler | 3,5 ko | 1,1 ko | 0,8 % |
| use-sync-external-store | 1,5 ko | 0,5 ko | 0,4 % |

Le gzip par dépendance est une **estimation** : le ratio global est appliqué à chaque
tranche. Compresser les tranches isolément donnerait un chiffre faux, la compression
exploitant les redondances entre elles. Seul le total gzip est mesuré.

**Ce que la mesure corrige.**

- L'attribution « TanStack Router représente l'essentiel », écrite au rapport de la phase 6,
  était **fausse**. L'ensemble TanStack (`router-core` + `react-router` + `history` + `store`)
  pèse 71,7 ko bruts, soit **17,8 %**. React et React DOM en pèsent **53,4 %**.
- **Zod part bien dans le navigateur**, comme supposé : 20,2 %, deuxième poste. C'est la
  contrepartie directe de `RoomSearchSchema` et `RoomListQuerySchema` partagés avec l'API —
  une seule définition du contrat de filtre des deux côtés du réseau. Le coût est connu et
  assumé : sans lui, il faudrait deux définitions à garder synchronisées, ce qui est
  précisément le défaut que `packages/shared` existe pour empêcher.

**Rien n'est optimisé.** 127 ko compressés pour un outil de travail, c'est acceptable. La
mesure est là pour que le chiffre soit connu, pas pour déclencher une action.

**Évolution du seul JS**, à périmètre comparable : 124,0 ko au 2026-09-12, 126,7 ko après la phase 8a, 127,2 ko après la 8b, 127,5 ko après le commit 2 de la 8c, **128,5 ko après le commit 3, **128,6 ko après le commit 4**.
La progression locale coûte donc **+3,2 ko compressés**, entièrement dans notre propre code
(27,7 → 38,9 ko bruts) : aucune dépendance n'a été ajoutée depuis la phase 6. Le point
d'entrée par lot a même retiré du travail au navigateur — 5 requêtes au lieu de 65 sur
`/progression` — sans rien ajouter au poids.

**Plafond posé pour la phase 8c : 160 ko gzip.** Au-delà, la passe visuelle n'est pas
acceptée. **Marge restante : 27,4 ko**, CSS compris, pour un plafond de 160. La passe visuelle entière —
thème sombre, chemin, cartes, accueil, squelettes — a coûté **+1,9 ko gzip** de code propre et
**aucune dépendance** : rien n'a été ajouté depuis la phase 6. Le chemin est du CSS écrit à la
main, sans SVG ni bibliothèque.

**À refaire en phase 10**, et à chaque phase qui ajoute du code front.

---

> **Correction du 2026-09-16.** L'entrée 8 bis affirmait que « le processus Node n'existait
> plus ». Ce n'était pas établi : ce qui avait été observé, c'était `curl` rendant `000` et un 502
> dans le navigateur, sans qu'aucune vérification n'ait porté sur l'existence du processus. Les
> deux symptômes sont produits à l'identique par une simple fenêtre de redémarrage. Écrire
> « cause inconnue » était honnête ; écrire « le processus n'existait plus » ne l'était pas.

## Interface

| # | À faire | Sans ça |
|---|---|---|
| 8 bis | ~~**L'API s'est arrêtée seule le 2026-09-15, cause INCONNUE**~~ **Diagnostiqué le 2026-09-16 : `node --watch`, pas une panne.** Le script `dev` de l'API tourne sous `node --watch`, qui redémarre le serveur à chaque écriture d'un fichier surveillé. Reproduit à la demande : un `touch` sur `src/server.ts` ferme le port pendant **600 à 900 ms**, pendant lesquelles `curl` rend `000` et le proxy Vite rend **502** — exactement les deux symptômes relevés la veille. Aucune trace d'erreur parce qu'il n'y en a jamais eu. **Rien à corriger côté production** : elle exécute `node dist/server.js`, sans `--watch`. Reste utile pour le déploiement : un journal persistant, pour que le prochain incident ne se diagnostique pas par reconstitution. |
| 10 | **Compléter `/mentions` : éditeur, hébergeur, contact, licence** | La page existe et n'affirme que du vérifiable — non-affiliation, métadonnées seulement, aucun compte ni cookie ni traceur, aucune IP conservée — chaque promesse tenue par un test. **Quatre informations manquent, et aucune ne se déduit du code** : l'éditeur et le responsable de publication, l'hébergeur (le déploiement n'a pas eu lieu), une adresse de contact, et la licence — le dépôt n'a **ni fichier `LICENSE` ni champ `license`**. Elles sont attendues de Nel. Une section absente vaut mieux qu'une section remplie au hasard, mais elles sont **dues avant toute mise en ligne publique**. |
| 9 | **En-têtes de sécurité sur le FRONT** | `apps/api/src/http/securite.ts` ne couvre que l'API. Le front est servi en statique : sa politique de contenu, son `X-Frame-Options` et son HSTS se posent chez l'hébergeur ou le proxy, et **aucun test de ce dépôt ne peut les atteindre**. Une balise `<meta>` CSP n'est pas une solution de repli acceptable ici : `connect-src` devrait nommer l'origine de l'API, qui sera `api.<domaine>` ([ADR-0001](adr/0001-arbitrages-initiaux.md) D3) et n'est pas connue. En poser une aujourd'hui casserait la production le jour du déploiement. **Ce qui a pu être fait sans l'hébergeur l'a été** : `color-scheme` et `theme-color` dans le `<head>`, ce dernier tenu égal à `--fond` par `pnpm contrast`. |
| 8 | **Contrôler le contraste sur le RENDU, pas sur les tokens** | `pnpm contrast` lit les valeurs déclarées dans `styles.css`. Une couleur écrite en dur dans un composant, ou une superposition d'opacités, lui échappe. Le contrôle de complétude réduit la faille sans la fermer. Un contrôle réel demande un navigateur, donc la CI. [ADR-0005](adr/0005-theme-sombre-et-contraste.md) |

## Dettes à échéance conditionnelle

Elles ne sont **pas** dues en phase 10. Elles sont ici pour ne pas être redécouvertes comme des bugs.

| Dette | Déclencheur de bascule |
|---|---|
| `ORDER BY lower(title)` au lieu de `COLLATE "und-x-icu"` | Un titre à initiale accentuée ou non-ASCII apparaît dans le dataset. Exposition mesurée le 2026-09-11 : 1 titre non-ASCII sur 714, sans impact sur l'ordre. [ADR-0003](adr/0003-schema-postgres.md) |
| ~~`canonical:` vide dans le mapping de normalisation~~ **ÉCHUE le 2026-09-14** | Le déclencheur annoncé était « le mapping est réécrit » : c'est arrivé. Le retrait du badge d'affichage est devenu une règle du code, la collision de casse `enum4linux` est donc réelle, et `canonical:` porte une entrée. Le garde n'est plus dormant. [ADR-0004](adr/0004-badge-affichage-regle.md) |
| `prefers-color-scheme: light` non géré | **Décidé le 2026-09-15**, pas oublié : thème sombre unique, `color-scheme: dark`. Bascule si quelqu'un demande un thème clair — et alors **entièrement**, jamais à moitié. Le coût n'est pas la palette, c'est la matrice de contraste qui double : 32 paires deviennent 64, toutes à tenir à chaque changement. [ADR-0005](adr/0005-theme-sombre-et-contraste.md) |
| `MFTCmd.exe` vs `MFTECmd.exe` | Arbitrage de Nel. La question est posée dans `data/mappings/normalisation-outils.yaml`, non appliquée. |
| Export de progression sans import JSON | Asymétrie assumée en phase 8a : l'utilisateur peut sortir ses données, pas les réinjecter. Si les comptes sont ajoutés, le chemin de reprise sera progression locale → compte, pas un import JSON. |
