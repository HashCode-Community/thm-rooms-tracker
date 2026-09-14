# Dette de la phase 10 — CI et déploiement

Liste **consolidée** des obligations contractées dans les phases précédentes et dont l'échéance est
la phase 10. Elles vivent aussi dans leur ADR d'origine ; ce fichier existe parce qu'une obligation
répartie dans six documents est une obligation qu'on oublie.

Chaque ligne nomme le mode de défaillance qu'elle empêche. Une garde dont on a oublié pourquoi elle
existe finit par être supprimée comme « inutile ».

---

## CI

| # | À faire | Sans ça |
|---|---|---|
| 1 | **Service PostgreSQL dans la CI** | `pnpm test` ne lancerait que l'unitaire. Une CI verte qui ne teste pas les 71 tests d'API est pire que pas de CI : elle donne une garantie qui n'existe pas. Origine : validation phase 5. |
| 2 | **Étape `pnpm typecheck:guard`, qui exige EXIT=1** | La sonde d'inférence peut cesser de mordre en silence — il suffit de vider ses assertions et tout reste vert. [ADR-0002](adr/0002-typescript-7.md) |
| 3 | **Clone neuf + vérification du sidecar SHA-256** | Le mode de défaillance des fins de ligne se déclenche **au checkout**, pas au commit. Un `.gitattributes` cassé ne se voit que sur un clone neuf. [ADR-0001](adr/0001-arbitrages-initiaux.md) |
| 4 | **`pnpm data:audit` en dry-run** | Un dataset remplacé sans que ses chiffres de contrôle soient revérifiés. |

## Sécurité (échéance phase 9) et déploiement

| # | À faire | Sans ça |
|---|---|---|
| S1 | **Trancher `pnpm audit` : 1 vulnérabilité modérée, `esbuild <= 0.24.2` via `drizzle-kit > @esbuild-kit/esm-loader`** ([GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)) | **Échéance remontée en phase 9 le 2026-09-14 : c'est de la sécurité, pas de la dette de CI.** Exception datée du 2026-09-14 : l'avis porte sur le serveur de développement d'esbuild ; la chaîne est une `devDependency` de `drizzle-kit`, jamais livrée, absente de la production. Aucun `override` posé — forcer une version d'esbuild sous drizzle-kit change le compilateur qui évalue `drizzle.config.ts`, pour un risque inexistant chez nous. **Déclencheur de réexamen : la prochaine montée de `drizzle-kit`** — vérifier alors si `@esbuild-kit/*` a disparu de l'arbre, et retirer cette ligne le cas échéant. Une exception sans date de réexamen est un `ignore` déguisé. |
| 5 | **`NODE_ENV=production` réellement posé** | `/docs` publierait la surface d'API complète. Le test prouve que la garde fonctionne quand la configuration dit `exposeDocs: false` ; il ne prouve pas que la production la dit. |
| 6 | **Vérifier `/docs` → 404 sur l'environnement déployé** | Voir ci-dessus. Un `curl` suffit, mais il faut le faire. |
| 6 bis | **Vérifier que le proxy accepte une ligne de requête de 2 ko** | `/api/rooms/batch` prend les codes en paramètres répétés. Le client borne l'URL à **2 048 octets** par construction (`BATCH_CHUNK_BYTES`), et un test l'exige pour n'importe quelle longueur de code. Mesuré au navigateur le 2026-09-15 sur les 714 rooms : 8 tranches, URL la plus longue **2 046 octets**. Sans cette borne, une tranche des 200 codes les plus longs ferait 5 906 octets, et `large_client_header_buffers` (8 ko chez nginx) couvre la ligne de requête **et** les en-têtes : avec cookie et `User-Agent`, on entrait dans la zone où ça casse en production et nulle part ailleurs. La vérification reste due parce qu'un proxy réglé sous 2 ko existe. |

## Mesures à refaire

| # | À refaire | Déclencheur |
|---|---|---|
| 7 | **Les trois critères de repli TypeScript 7** | La porte C2 a été franchie sur un périmètre réduit (API seule). Phase 10 = CI complète, front typé, tests Vitest. [ADR-0002](adr/0002-typescript-7.md) |

## Poids du bundle front — mesuré, pas estimé

**Mesure du 2026-09-14**, après les phases 8a et 8b, `pnpm --filter @thm/web build:analyse`.
La méthode décode les
`mappings` du source map et additionne les octets **réellement émis** par fichier source :
c'est ce qui a survécu au secouage d'arbre et à la minification, pas la taille des paquets
installés.

```
brut 415,0 ko · gzip 127,2 ko (ratio 30,7 %)
```

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

**Évolution.** 124,0 ko au 2026-09-12, 126,7 ko après la phase 8a, 127,2 ko après la 8b.
La progression locale coûte donc **+3,2 ko compressés**, entièrement dans notre propre code
(27,7 → 38,9 ko bruts) : aucune dépendance n'a été ajoutée depuis la phase 6. Le point
d'entrée par lot a même retiré du travail au navigateur — 5 requêtes au lieu de 65 sur
`/progression` — sans rien ajouter au poids.

**Plafond posé pour la phase 8c : 160 ko gzip.** Au-delà, la passe visuelle n'est pas
acceptée. Marge restante : 32,8 ko.

**À refaire en phase 10**, et à chaque phase qui ajoute du code front.

---

## Dettes à échéance conditionnelle

Elles ne sont **pas** dues en phase 10. Elles sont ici pour ne pas être redécouvertes comme des bugs.

| Dette | Déclencheur de bascule |
|---|---|
| `ORDER BY lower(title)` au lieu de `COLLATE "und-x-icu"` | Un titre à initiale accentuée ou non-ASCII apparaît dans le dataset. Exposition mesurée le 2026-09-11 : 1 titre non-ASCII sur 714, sans impact sur l'ordre. [ADR-0003](adr/0003-schema-postgres.md) |
| ~~`canonical:` vide dans le mapping de normalisation~~ **ÉCHUE le 2026-09-14** | Le déclencheur annoncé était « le mapping est réécrit » : c'est arrivé. Le retrait du badge d'affichage est devenu une règle du code, la collision de casse `enum4linux` est donc réelle, et `canonical:` porte une entrée. Le garde n'est plus dormant. [ADR-0004](adr/0004-badge-affichage-regle.md) |
| `MFTCmd.exe` vs `MFTECmd.exe` | Arbitrage de Nel. La question est posée dans `data/mappings/normalisation-outils.yaml`, non appliquée. |
| Export de progression sans import JSON | Asymétrie assumée en phase 8a : l'utilisateur peut sortir ses données, pas les réinjecter. Si les comptes sont ajoutés, le chemin de reprise sera progression locale → compte, pas un import JSON. |
