# ADR-0004 — Le badge d'affichage est une règle, pas une liste

- **Statut** : accepté
- **Date** : 2026-09-14
- **Décideur** : Nelkaël
- **Amende** : [ADR-0001](0001-arbitrages-initiaux.md) Q3/Q4/Q9 et [ADR-0003](0003-schema-postgres.md) §2

---

## Le défaut

ADR-0001 Q3/Q4/Q9 énonce la règle qui décide `merge` ou `rename` :

```
1.  strip  /\s*-?\s*NEW$/i
2.  trim()
3.  comparaison casefold()  ->  jumeau trouvé ? merge : rename
```

Elle a été appliquée **à la main**, une fois, pour fabriquer `normalisation-outils.yaml`,
puis figée en 12 entrées : 5 `merge` et 7 `rename`. Le code, lui, ne connaissait que le
fichier.

Conséquence, relevée par Nel le 2026-09-14 : le jour où le scraper ramène `"Nmap NEW"`,
aucune entrée ne correspond. Le tag `nmap-new` est créé à côté de `nmap`. Et le journal des
tags — le garde posé la veille précisément pour rendre l'écart visible — **ne voit rien** :
rien n'a été écarté, rien n'a été absorbé, la réconciliation tombe juste. Doublon silencieux.

Le défaut n'est pas la liste elle-même, c'est sa nature. Quatre des sept fusions ne sont pas
quatre exceptions : c'est un motif systématique de la source. Un motif appartient au code.

## Décision

**Le retrait du badge est appliqué par le code, à toute valeur, avant toute consultation du
mapping.** `stripDisplaySuffix`, dans `apps/api/src/scripts/normalise.ts`.

Le mapping ne garde que ce qu'aucune règle ne peut attraper : les **coquilles réelles**,
c'est-à-dire les fautes de frappe dont la forme correcte existe déjà dans les données.
Aujourd'hui deux, `Burpe Suite` → `Burp Suite` et `Autospy` → `Autopsy`.

`rename:` est vide. La section reste, documentée, pour le cas d'une correction qui ne serait
ni un badge ni une coquille.

### L'espace est exigé devant le badge

**Écart assumé avec la lettre d'ADR-0001**, qui écrit `/\s*-?\s*NEW$/i`. Cette forme est
dangereuse dès qu'on l'implémente vraiment : tout y est optionnel, donc en insensible à la
casse `"Renew"` devient `"Re"`. Le badge est un **jeton séparé**, pas une terminaison.

La règle retenue est `/\s+-?\s*NEW$/i`. Mesure sur le dataset 1.0.0, 304 valeurs distinctes :

```
badge, espace exigé, casse exacte     12
badge, espace exigé, casse libre      12
finissant par NEW sans espace devant   0
contenant `new` ailleurs               0
```

Le resserrement ne change donc rien sur les données livrées et retire un mode de défaillance
sur celles à venir. Le tiret optionnel reste indispensable : sans lui `"Empire - NEW"` donne
`"Empire -"`, dont le jumeau `"Empire"` n'est jamais trouvé.

### Le garde dormant d'ADR-0003 se réveille

ADR-0003 §2 notait que `canonical:` était vide et que le filet du slug n'attrapait rien,
tout en écrivant que la collision apparaîtrait « avec un mapping écrit autrement — par
exemple un `rename` de `Enum4Linux NEW` vers `Enum4Linux` laissant `Enum4linux` intact ».

C'est exactement ce que fait la règle. `Enum4Linux NEW` est rabattu sur `Enum4Linux`, qui
rejoint `Enum4linux` par la casefold du slug. La collision est **réelle** depuis aujourd'hui,
et `canonical:` porte enfin une entrée :

```yaml
canonical:
  enum4linux: "enum4linux"
```

Forme retenue tout en minuscules : c'est un script Perl, le binaire s'appelle `enum4linux`,
comme `enum4linux-ng`. `Enum4Linux` serait une troisième variante inventée.

L'affirmation d'ADR-0003 « le filet ne sert à rien aujourd'hui » devient donc fausse. Elle
n'était pas fausse quand elle a été écrite : le mapping listait les deux variantes à la main,
ce qui les faisait converger dès le niveau du nom.

### Le mapping et la règle ne doivent pas se recouvrir

Une clé du mapping qui porte encore le badge ne serait **jamais consultée** : la règle l'a
déjà retiré avant la recherche. Elle resterait dans le fichier comme une intention sans
effet, et rien ne le signalerait.

`findSuffixedMappingKeys` les détecte et **l'import refuse de tourner**. Même philosophie que
le garde des 5 % et que celui des collisions non déclarées : quand deux mécanismes se
contredisent, on s'arrête.

## Ce que ça change sur les données

Rien. Mesuré, avant et après :

```
304 - 1 absence - 0 sans slug - 7 absorbées = 296  OK
technology  15 -> 14     tool  186 -> 179     skill  103 -> 103
```

Les mêmes 296 tags, par un chemin qui couvre le cas suivant au lieu de le rater.

## Ce que le journal d'import montre désormais

Chaque valeur rabattue par la règle est nommée, avec ses occurrences et le fait qu'elle ait
trouvé un jumeau ou non — **qu'elle soit connue ou inédite**. Les fusions portent leur cause :
`règle`, `mapping`, ou `slug`.

## Alternative écartée

**Garder la liste et ajouter un garde qui refuse tout nom badgé non déclaré.** L'import se
serait arrêté à chaque nouveau badge, pour réclamer une entrée que le code sait produire
seul. C'est reporter sur un humain un travail mécanique, et transformer une livraison
normale du scraper en incident.

## À réévaluer

| Déclencheur | Action |
|---|---|
| TryHackMe change de libellé de badge (`BETA`, `UPDATED`…) | Étendre la règle, pas le mapping. Le journal des noms rabattus rendra le nouveau badge visible dès le premier import. |
| Une coquille dont la forme correcte est absente des données | Reste un arbitrage humain, dans `merge:` ou `rename:`. Cf. `MFTCmd.exe` / `MFTECmd.exe`, toujours ouvert. |
