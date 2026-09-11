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

## Dettes à échéance conditionnelle

Elles ne sont **pas** dues en phase 10. Elles sont ici pour ne pas être redécouvertes comme des bugs.

| Dette | Déclencheur de bascule |
|---|---|
| `ORDER BY lower(title)` au lieu de `COLLATE "und-x-icu"` | Un titre à initiale accentuée ou non-ASCII apparaît dans le dataset. Exposition mesurée le 2026-09-11 : 1 titre non-ASCII sur 714, sans impact sur l'ordre. [ADR-0003](adr/0003-schema-postgres.md) |
| `canonical:` vide dans le mapping de normalisation | TryHackMe introduit une variante de casse, ou le mapping est réécrit. L'importer refuse alors de tourner et indique la ligne à ajouter. |
| `MFTCmd.exe` vs `MFTECmd.exe` | Arbitrage de Nel. La question est posée dans `data/mappings/normalisation-outils.yaml`, non appliquée. |
