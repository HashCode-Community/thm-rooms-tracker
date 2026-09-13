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

## Déploiement

| # | À faire | Sans ça |
|---|---|---|
| 5 | **`NODE_ENV=production` réellement posé** | `/docs` publierait la surface d'API complète. Le test prouve que la garde fonctionne quand la configuration dit `exposeDocs: false` ; il ne prouve pas que la production la dit. |
| 6 | **Vérifier `/docs` → 404 sur l'environnement déployé** | Voir ci-dessus. Un `curl` suffit, mais il faut le faire. |

## Mesures à refaire

| # | À refaire | Déclencheur |
|---|---|---|
| 7 | **Les trois critères de repli TypeScript 7** | La porte C2 a été franchie sur un périmètre réduit (API seule). Phase 10 = CI complète, front typé, tests Vitest. [ADR-0002](adr/0002-typescript-7.md) |

## Poids du bundle front — mesuré, pas estimé

**Mesure du 2026-09-12**, `pnpm --filter @thm/web build:analyse`. La méthode décode les
`mappings` du source map et additionne les octets **réellement émis** par fichier source :
c'est ce qui a survécu au secouage d'arbre et à la minification, pas la taille des paquets
installés.

```
brut 403,2 ko · gzip 124,0 ko (ratio 30,8 %)
```

| Dépendance | Brut | gzip estimé | Part |
|---|---:|---:|---:|
| react-dom | 202,3 ko | 62,2 ko | 50,5 % |
| **zod** | **80,8 ko** | **24,8 ko** | **20,2 %** |
| @tanstack/router-core | 51,5 ko | 15,8 ko | 12,8 % |
| (notre code) apps/web | 27,7 ko | 8,5 ko | 6,9 % |
| @tanstack/react-router | 12,1 ko | 3,7 ko | 3,0 % |
| react | 8,0 ko | 2,5 ko | 2,0 % |
| (notre code) @thm/shared | 5,1 ko | 1,6 ko | 1,3 % |
| @tanstack/history | 4,4 ko | 1,4 ko | 1,1 % |
| @tanstack/store | 3,7 ko | 1,1 ko | 0,9 % |
| scheduler | 3,5 ko | 1,1 ko | 0,9 % |
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

**Rien n'est optimisé.** 124 ko compressés pour un outil de travail, c'est acceptable. La
mesure est là pour que le chiffre soit connu, pas pour déclencher une action.

**À refaire en phase 10**, la phase 8a ajoutant du code front.

---

## Dettes à échéance conditionnelle

Elles ne sont **pas** dues en phase 10. Elles sont ici pour ne pas être redécouvertes comme des bugs.

| Dette | Déclencheur de bascule |
|---|---|
| `ORDER BY lower(title)` au lieu de `COLLATE "und-x-icu"` | Un titre à initiale accentuée ou non-ASCII apparaît dans le dataset. Exposition mesurée le 2026-09-11 : 1 titre non-ASCII sur 714, sans impact sur l'ordre. [ADR-0003](adr/0003-schema-postgres.md) |
| `canonical:` vide dans le mapping de normalisation | TryHackMe introduit une variante de casse, ou le mapping est réécrit. L'importer refuse alors de tourner et indique la ligne à ajouter. |
| `MFTCmd.exe` vs `MFTECmd.exe` | Arbitrage de Nel. La question est posée dans `data/mappings/normalisation-outils.yaml`, non appliquée. |
| Export de progression sans import JSON | Asymétrie assumée en phase 8a : l'utilisateur peut sortir ses données, pas les réinjecter. Si les comptes sont ajoutés, le chemin de reprise sera progression locale → compte, pas un import JSON. |
