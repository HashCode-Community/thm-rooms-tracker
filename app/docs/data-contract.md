# Contrat de données — scraper ⇄ importer

> ## PROPOSITION — non ratifiée
>
> **Auteur : Nel. Relecteur requis : Malick.**
> **Ce document n'engage personne tant que Malick n'a pas approuvé la PR.**
>
> Il est écrit en premier jet parce que Nel connaît les contraintes d'implémentation côté import,
> pas parce que la décision serait prise. Tout est discutable : conteste, propose, refuse.
> Cet encadré disparaît au merge.

---

Ce document décrit **le seul point de contact** entre le scraper Python et l'application.

```
scraper Python  ──►  data/datasets/rooms.v1.json   ──►  importer TypeScript  ──►  PostgreSQL
    Malick              + rooms.v1.json.sha256              Nel
                        zone partagée
```

Le scraper **ne parle jamais à PostgreSQL**. Il produit un fichier. C'est tout.
L'application **ne lance jamais de Python**. Elle lit un fichier. C'est tout.

Aucune connaissance de TypeScript n'est nécessaire pour implémenter le côté scraper. Tout ce qui suit
est décrit en Python et en JSON.

---

## 1. Les deux fichiers à produire

| Fichier | Rôle |
|---|---|
| `data/datasets/rooms.v1.json` | les données |
| `data/datasets/rooms.v1.json.sha256` | l'empreinte d'intégrité, **obligatoire** |

Sans le second, **l'import refuse de tourner**.

---

## 2. Structure du fichier

```json
{
  "meta": { ... },
  "rooms": [ { ... }, { ... } ]
}
```

Deux clés à la racine, `meta` et `rooms`, et **aucune autre**. Une clé supplémentaire à la racine
fait échouer l'import.

### 2.1 `meta`

| Champ | Type | Obligatoire | Contrainte |
|---|---|:--:|---|
| `datasetVersion` | string | **oui** | format `X.Y.Z` exactement, ex. `"1.0.0"` |
| `scrapedAt` | string | **oui** | ISO 8601, ex. `"2026-09-10T21:45:00Z"` |
| `source` | string | **oui** | d'où viennent les données, texte libre |
| `freeRoomsCount` | int | **oui** | ≥ 0, doit valoir `len(rooms)` |
| `checksum` | string | **oui** | `"sha256:"` + 64 caractères hexadécimaux minuscules |
| `scope` | string | non | ex. `"freeToUse === true"` |
| `totalRoomsInCatalog` | int | non | ≥ 0 |
| `catalogCountReportedByApi` | int | non | ≥ 0 |
| `checksumAlgorithm` | string | non | texte libre |
| `notes` | liste de strings | non | remarques du scrape |

**Des clés supplémentaires sont tolérées dans `meta`** (contrairement au reste du fichier). L'import
les signale dans son rapport sans échouer. Si tu ajoutes une information utile, mets-la ici plutôt
que dans une room.

> **`meta.checksum` est en voie de suppression.** Il est aujourd'hui purement **informatif** :
> l'import ne bloque pas dessus. Sa définition historique (« sha256 de `json.dumps(rooms)` trié par
> clé ») est trop ambiguë — tri récursif ou non, encodage, normalisation Unicode, séparateurs — et
> casserait le jour où un titre contiendrait un caractère non-ASCII. Il est remplacé par le fichier
> sidecar, décrit en §3. Tu peux continuer à le produire ou l'abandonner, dis-nous ce que tu préfères.

### 2.2 Une room

`rooms` est une liste triée par `code` croissant, avec au moins un élément.

| Champ | Type | Obligatoire | Contrainte |
|---|---|:--:|---|
| `code` | string | **oui** | 1 à 128 caractères. **Clé primaire.** Voir §4 |
| `title` | string | **oui** | non vide |
| `difficulty` | string | **oui** | `info` \| `easy` \| `medium` \| `hard` \| `insane` |
| `type` | string | **oui** | `walkthrough` \| `challenge` |
| `url` | string | **oui** | doit commencer par `https://tryhackme.com/room/` |
| `description` | string | non | peut être `""` |
| `durationMinutes` | int ou `null` | non | ≥ 0 |
| `usersCount` | int ou `null` | non | ≥ 0 |
| `publishedAt` | string ou `null` | non | format `AAAA-MM-JJ` exactement |
| `teams` | liste | non | valeurs parmi `Red`, `Blue`, `Purple`, 3 maximum |
| `skills` | liste de strings | non | — |
| `technologies` | liste de strings | non | — |
| `tools` | liste de strings | non | — |

**Aucun autre champ n'est accepté dans une room.** Un champ inconnu fait échouer l'import — ce n'est
pas un oubli, c'est délibéré : voir §5.

**Absence vs vide.** Préfère la clé présente avec une valeur vide (`""` ou `[]`) plutôt que la clé
absente. Le dataset actuel fait déjà ça partout, garde cette habitude : elle rend les diffs lisibles.

---

## 3. Le fichier sidecar `rooms.v1.json.sha256`

C'est le **seul** contrôle d'intégrité qui bloque. Il porte sur les **octets bruts** du fichier, pas
sur une re-sérialisation : aucune ambiguïté possible sur le tri, l'encodage ou les séparateurs.

Format standard `sha256sum` : le hash, **deux espaces**, le nom du fichier sans son chemin.

```
15b1dd501ea832f93cb8d30fcce37aa518a2a17db5b1f931e907db7c76131495  rooms.v1.json
```

### Le produire en Python

```python
import hashlib
from pathlib import Path

dataset = Path("data/datasets/rooms.v1.json")
digest = hashlib.sha256(dataset.read_bytes()).hexdigest()
dataset.with_suffix(".json.sha256").write_text(f"{digest}  {dataset.name}\n", encoding="utf-8")
```

**`read_bytes()`, pas `read_text()`.** Le mode texte peut réécrire les fins de ligne et changer
l'empreinte sans que tu le voies.

### Le vérifier

```bash
cd data/datasets && sha256sum -c rooms.v1.json.sha256     # Linux, Git Bash
```
```powershell
Get-FileHash data/datasets/rooms.v1.json -Algorithm SHA256   # PowerShell
```

### ⚠ Le piège des fins de ligne

Ce contrôle échoue **au moment du clone, pas du commit**. Il est donc invisible sur le poste qui a
produit le fichier et n'apparaît que sur une copie fraîche.

Le dépôt a un `.gitattributes` qui met `data/datasets/**` en `-text` : git n'y touche pas. **Ne
modifie pas cette ligne.** Elle est la seule chose qui empêche `core.autocrlf` de réécrire les
16 737 fins de ligne du fichier au prochain clone Windows et d'invalider l'empreinte.

Ça n'est pas théorique : c'est arrivé au CSV, qui a été corrompu en base de dépôt avant que la règle
soit posée.

---

## 4. `code` est la clé primaire, et il est sensible à la casse

`code` doit être **unique**, **stable dans le temps**, et n'est **jamais** le titre.

`url` doit toujours valoir `https://tryhackme.com/room/` + `code`. L'import vérifie la cohérence et
échoue si elle est rompue.

**14 des 714 codes contiennent des majuscules** (`AIforcyber-aoc2025-y9wWQ1zRgB`, `csrfV2`,
`searchskillscS`…). Ne les mets **jamais** en minuscules : le lien vers TryHackMe est sensible à la
casse et tomberait en 404. C'est aussi notre URL publique.

Trois rooms portent des **titres identiques** avec des `code` distincts (`Preparation`,
`Threat Hunting: Introduction`, `Intro to Detection Engineering`). Ce ne sont **pas** des doublons.
**Ne déduplique jamais sur le titre.**

---

## 5. Versionnement : la règle qui évite qu'on se désynchronise

Le contrat est **strict** : un champ inconnu est rejeté, pas ignoré. C'est volontaire — ça force la
coordination plutôt que la dérive silencieuse. Mais ça n'a de sens que si l'erreur est lisible.

L'importer déclare la plage qu'il accepte (`^1.0.0`, donc `>= 1.0.0` et `< 2.0.0`) et vérifie
`meta.datasetVersion` **avant toute autre validation**.

| Changement | Bump | Fichier | Ce qu'il faut faire |
|---|---|---|---|
| ajout d'un champ | **mineur** `1.0.0 → 1.1.0` | même fichier | PR sur `rooms.schema.json`, relue par nous deux |
| suppression d'un champ, ou changement de type | **majeur** `1.x → 2.0.0` | **`rooms.v2.json`** | idem, plus mise à jour de l'importer |
| correction de données, même périmètre | **patch** `1.0.0 → 1.0.1` | même fichier | rien de particulier |

**Le dataset et le schéma voyagent ensemble, jamais l'un sans l'autre.**

### Les messages d'erreur que tu obtiendras

Un contrat qui montre l'erreur est plus clair qu'un contrat qui décrit la règle. Ce sont les messages
réels de `pnpm data:audit`, vérifiés sur des fichiers fabriqués :

**Tu as ajouté un champ et bumpé en `1.1.0` :**
```
Version : Dataset v1.1.0 incompatible : cet importer supporte ^1.0.0. Le dataset est PLUS
RECENT que l'importer : le scraper a probablement ajoute un champ. Mettre a jour l'importer
et le contrat Zod, ou regenerer le dataset avec l'ancien scraper. Ne PAS contourner en
relachant le schema.
```

**Tu as bumpé en `2.0.0` :**
```
Version : Dataset v2.0.0 incompatible : cet importer supporte ^1.0.0. Changement majeur =
rupture de contrat (champ supprime ou type modifie). Attendre la mise a jour de l'importer,
ou repartir d'un fichier rooms.v1.json.
```

**`datasetVersion` mal formé :**
```
Version : `meta.datasetVersion` absent ou malforme ("v1"). Le contrat impose le format
X.Y.Z. Corriger le scraper avant de relivrer.
```

**Empreinte qui ne correspond pas :**
```
Integrite : le SHA-256 des octets bruts ne correspond pas au sidecar.
attendu 0000..., obtenu 15b1dd50...
```

Si tu vois le premier message, **ne relâche pas le schéma pour faire passer l'import.** Préviens Nel :
c'est l'importer et le contrat qui doivent être mis à jour, dans la même PR que ton champ.

---

## 6. Rooms disparues : désactivation, jamais suppression

Une room absente d'un nouveau scrape est marquée `is_active = false` en base. **Elle n'est jamais
supprimée.** La progression des utilisateurs qui l'ont terminée est conservée.

**Conséquence pour le scraper : ne « complète » jamais un scrape partiel avec des données d'un scrape
précédent.** Si l'API TryHackMe ne renvoie que 400 rooms un jour, livre 400 rooms. L'import a un
garde-fou : **s'il devait désactiver plus de 5 % des rooms, il refuse de s'exécuter** et réclame un
`--force` explicite. Un scraper cassé ne doit pas pouvoir vider la base.

Ce garde-fou ne fonctionne que si tu livres ce que tu as vu, sans le maquiller.

---

## 7. Ce qui n'est PAS ta responsabilité

**Livre la donnée brute, telle que TryHackMe la renvoie.** Ne normalise rien. C'est important : la
donnée brute doit rester rejouable, et toute transformation doit pouvoir être refaite différemment
plus tard sans re-scraper.

| Traitement | Qui | Où |
|---|---|---|
| supprimer les espaces de début/fin | **importer** | automatique sur tous les champs texte |
| retirer le suffixe `" NEW"` des outils | **importer** | `data/mappings/normalisation-outils.yaml` |
| fusionner `Burpe Suite` → `Burp Suite` | **importer** | idem, validé à la main |
| traiter la technologie `"N/A"` comme une absence | **importer** | — |
| slugifier les tags | **importer** | — |
| choisir la forme d'affichage d'un tag | **importer** | section `canonical:` du mapping |
| déduplication des rooms | **importer**, sur `code` | jamais sur le titre |

Le dataset actuel contient **volontairement** 14 titres à espaces parasites, 37 descriptions à
espaces parasites, 12 outils suffixés `" NEW"`, un outil nommé `" Microsoft Sentinel"` et 6
technologies `"N/A"`. **Ce ne sont pas des bugs de ton scraper.** Ce sont les données réelles, et
c'est très bien ainsi.

Si tu normalisais de ton côté, on perdrait l'information d'origine et on ne pourrait plus revenir en
arrière sur une décision de normalisation.

---

## 8. Ce qui n'est pas dans le contrat, et ne le sera pas

Les données TryHackMe ne contiennent **aucun prérequis**, **aucun ordre pédagogique**, **aucune notion
de parcours**. Ne cherche pas à en produire.

Ces informations sont saisies à la main dans `data/roadmap/tracks/*.yaml`, côté Nel. C'est assumé :
une recommandation éditoriale ne se scrape pas.

`publishedAt` est peu fiable : 110 rooms sont datées 2026, ce sont des dates de **republication**, pas
de création. Livre-les telles quelles, on n'en tire aucune conclusion.

Environ **30 rooms sont introuvables** : le compteur de l'API annonce 1 351 rooms, la pagination n'en
restitue que 1 321, toutes stratégies de tri confondues. C'est documenté et hors périmètre. Si tu
trouves un moyen de les récupérer, dis-le, mais ne bricole pas de contournement silencieux.

---

## 9. Comment vérifier ta livraison avant de la pousser

```bash
pnpm data:audit
```

Le script vérifie, dans cet ordre : l'empreinte sidecar, la version, le contrat champ par champ, puis
22 statistiques de contrôle et 18 catégories d'anomalies. Il produit un rapport lisible dans
`data/reports/`.

**Il ne corrige rien**, par construction. Il observe et signale.

S'il sort en code 0, ta livraison est bonne. S'il sort en code 1, le rapport dit exactement pourquoi.

---

## 10. Ce qui reste à trancher ensemble

1. **`meta` accepte-t-il des clés non déclarées ?** Aujourd'hui oui, parce que le JSON Schema ne les
   interdit pas — contrairement à la racine et aux rooms. Faut-il fermer ça en v2 ?
2. **`meta.checksum` disparaît-il en v2 ?** Le sidecar le remplace entièrement.
3. **Périmètre.** On reste sur les 714 rooms gratuites, ou tu scrapes aussi les ~607 payantes en les
   marquant `isFree: false` ? La colonne existe déjà en base, elle vaut constamment `true`.
4. **Fréquence de re-scrape, et qui déclenche l'import.**
5. **Format d'échange.** JSON unique aujourd'hui. Des JSON Lines seraient plus faciles à produire en
   flux de ton côté — ça change le calcul d'empreinte, pas le reste.
6. **Champs qui manqueraient.** `imageUrl` ? `isFree` explicite ? Dis ce que l'API te donne et qu'on
   jette aujourd'hui, on décidera ensemble si ça vaut un bump mineur.

---

## Références

- Schéma faisant foi : `data/datasets/rooms.schema.json` (JSON Schema draft 2020-12)
- Décisions et justifications : `docs/adr/0001-arbitrages-initiaux.md`
- Mapping de normalisation : `data/mappings/normalisation-outils.yaml`
- Dernier rapport d'audit : `data/reports/`
