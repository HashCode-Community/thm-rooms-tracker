# THM Roadmap

Plateforme d'apprentissage cybersecurite construite sur les **714 rooms gratuites**
de TryHackMe. Ce n'est pas un annuaire : le catalogue est une commodite, la valeur
est le parcours d'apprentissage structure et le suivi de progression.

Projet non affilie a TryHackMe. Seules des metadonnees publiques sont indexees,
avec un lien sortant vers chaque room d'origine.

> Documentation complete (architecture, contrat de donnees, redaction des parcours)
> en phase 10. Ce README ne couvre pour l'instant que l'installation.

---

## Prerequis

| Outil | Version | Verification |
|---|---|---|
| Node.js | 24 LTS (`.nvmrc`) | `node -v` |
| pnpm | **12.3.4 exactement** | `pnpm -v` |
| Docker | avec Docker Desktop demarre | `docker info` |

### Installer pnpm : lire avant de lancer corepack

`corepack enable pnpm` **echoue sur un poste Windows standard** :

```
Internal Error: EPERM: operation not permitted, open 'C:\Program Files\nodejs\pnpm'
```

Corepack ecrit son shim dans `C:\Program Files\nodejs`, ce qui demande une elevation.
Deux voies :

```bash
# Voie 1 - sans droits administrateur (recommandee)
# Installe dans %AppData%\Roaming\npm. La version est EPINGLEE : ne pas mettre @latest,
# sinon les resolutions divergeront entre les deux postes et la CI.
npm install -g pnpm@12.3.4

# Voie 2 - avec un terminal administrateur
corepack enable pnpm
```

Le `package.json` racine declare `packageManager: "pnpm@12.3.4"` et
`engines.pnpm: ">=12 <13"` : une version hors de cette plage sera signalee.

---

## Installation

```bash
git clone <url> thm-roadmap && cd thm-roadmap
cp .env.example .env
pnpm install
docker compose up -d
pnpm dev
```

`pnpm dev` demarre l'API sur `http://127.0.0.1:3000` et le front sur
`http://localhost:5173`. La page d'accueil affiche le resultat de `GET /health`,
qui n'est `ok` qu'apres un `SELECT 1` reellement execute sur Postgres.

---

## Fins de ligne : a lire si tu as clone avant le commit `e2580a1`

Le depot force **LF partout** via `.gitattributes`, et exclut `data/datasets/**` de
toute conversion : le dataset est verifie par SHA-256 sur ses **octets bruts**, et une
conversion CRLF invaliderait ce controle.

Ce mode de defaillance se declenche **au checkout, pas au commit**. Il est donc
invisible sur le poste qui a produit le fichier et n'apparait que sur un clone neuf.

Si ta copie locale date d'avant `e2580a1`, elle peut contenir des CRLF indexes a tort.
Repars proprement :

```bash
# Option A - repartir d'un clone neuf (le plus sur)
cd .. && rm -rf thm-roadmap && git clone <url> thm-roadmap

# Option B - reconstruire l'index en place
#   ATTENTION : `git reset --hard` detruit les modifications non commitees.
#   Verifie `git status` et mets de cote ce que tu veux garder avant.
git rm -r --cached . && git reset --hard
```

Verifier ensuite que le dataset est intact :

```bash
sha256sum -c data/datasets/rooms.v1.json.sha256      # Linux / Git Bash
Get-FileHash data/datasets/rooms.v1.json -Algorithm SHA256   # PowerShell
```

---

## Pieges d'environnement deja rencontres

**`pnpm install` sort en exit 1 avec `ERR_PNPM_IGNORED_BUILDS`.**
pnpm bloque les scripts post-install par defaut. esbuild en a besoin pour recuperer
son binaire natif. La cle de configuration a ete **renommee en pnpm 12** : c'est
`allowBuilds` dans `pnpm-workspace.yaml`, plus `onlyBuiltDependencies`. Elle est
deja en place. Ce n'est pas un simple avertissement : le code de sortie est 1, ce
qui casserait la CI.

```yaml
# pnpm-workspace.yaml
allowBuilds:
  esbuild: true
```

**Docker Desktop n'est pas dans `C:\Program Files`.**
Installation par utilisateur : `%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe`.

---

## Arborescence

```
apps/api/          Fastify 5 + Drizzle (API typee, documentee sur /docs)
apps/web/          React 19 + Vite 8
packages/shared/   Schemas Zod partages API <-> web <-> importer
data/datasets/     SOURCE DE VERITE. Territoire de Malick. Octets verbatim.
data/mappings/     Normalisation editee a la main, versionnee
data/roadmap/      Contenu editorial des parcours (YAML)
data/reports/      Rapports d audit et d import (.md) - VERSIONNES, ils font foi
data/exports/      Derives regenerables (CSV) - GITIGNORES
scraper/           Python. Territoire de Malick. Ne parle jamais a Postgres.
```

**Regle de frontiere** : `scraper/` ne connait pas `apps/`, `apps/api` ne connait pas
Python. Le seul point de contact est `data/datasets/rooms.v1.json` et son schema.

---

## Scripts

| Commande | Effet |
|---|---|
| `pnpm dev` | API + front en parallele |
| `pnpm build` | Build des deux apps |
| `pnpm typecheck` | `tsc --noEmit` sur tout le monorepo |
| `pnpm lint` | Biome (lint + format) |
| `pnpm db:up` / `db:down` / `db:logs` | Postgres 16 local |

### Tests

| Commande | Perimetre | Base de donnees |
|---|---|---|
| `pnpm --filter @thm/api test:unit` | dataset, contrat, normalisation | **non** |
| `pnpm --filter @thm/api test:api` | endpoints via `fastify.inject()` | **oui, peuplee** |
| `pnpm --filter @thm/api test` | les deux | oui |
| `pnpm --filter @thm/api typecheck:guard` | verifie que la sonde d'inference mord encore | non |

> **A lire avant de conclure que le depot est casse.**
> `pnpm test` **echoue si Docker n'est pas lance** : les tests d'API ont besoin d'une
> base peuplee. Ce n'est pas un bug, c'est voulu — un test qui se desactive tout seul
> quand l'infrastructure manque est un test qui ment, et une CI verte qui ne teste
> rien est pire que pas de CI.
>
> `pnpm --filter @thm/api test:unit` n'exige rien et couvre le dataset, le contrat et
> la normalisation. C'est la commande a lancer pour verifier un clone.

Pour obtenir une base utilisable :

```bash
pnpm db:up
pnpm --filter @thm/api db:migrate
pnpm --filter @thm/api db:seed
pnpm data:import --apply --apply-mappings
```

Le message d'echec des tests d'API rappelle ces quatre commandes.

---

## API : semantique des filtres

Une seule regle, valable sur `/api/rooms` et `/api/facets` :

- **OU** a l'interieur d'une meme facette : `?tech=linux&tech=windows` = Linux **ou** Windows
- **ET** entre facettes : `?tech=linux&tool=nmap` = Linux **et** Nmap

`?tech[]=a&tech[]=b` et `?tech=a&tech=b` sont equivalents. Un parametre vide est
traite comme absent.

Deux comportements a connaitre, parce qu'ils ne se devinent pas :

1. **Tout `ORDER BY` se termine par `code ASC`.** 710 des 714 rooms sont ex aequo sur
   la duree ; sans ce departage, la pagination par offset rend des doublons. Mesure :
   sept pages de 50 triees par duree donnent 350 lignes pour **276 codes distincts**
   sans departage, 350 pour 350 avec.
2. **Le compteur d'une facette ignore son propre filtre.** Sinon, cocher « Linux »
   ferait tomber toutes les autres technologies a zero et l'interface se
   verrouillerait sur un seul choix.

**Donnees de reference contre resultats de requete.** `/api/tags` rend les NOMS des
tags (`max-age=300, stale-while-revalidate=3600` : ils ne changent qu'a l'import, mais
cinq minutes bornent la fenetre pendant laquelle un tag tout neuf s'afficherait sous
son slug). `/api/facets` ne rend que des couples `slug` -> compteur, jamais mis en
cache. Le front joint les deux sur le `slug`, et affiche le slug brut a defaut de nom.

Les reponses sont compressees (`br`, `gzip`, `deflate`) au-dela de 1 ko.

La documentation interactive est sur `/docs` — **en developpement uniquement**.

---

## Parcours

Contenu **editorial**, ecrit et relu a la main dans `data/roadmap/tracks/*.yaml`. Les
donnees TryHackMe ne contiennent ni prerequis, ni ordre pedagogique, ni notion de
parcours : rien ici n'est genere.

```bash
pnpm roadmap:seed                 # dry-run, le defaut
pnpm roadmap:seed --apply         # ecrit en base
pnpm roadmap:candidates           # regenere data/reports/roadmap-candidates.md
```

`roadmap:seed` **echoue bruyamment** plutot que d'ignorer quoi que ce soit :

| Cas | Comportement |
|---|---|
| repertoire vide ou absent | refus |
| `provenance` incomplete (dont `validated_by_completion`) | refus, chemin exact dans le YAML |
| slug ou position en double | refus |
| meme room deux fois dans le MEME parcours | refus |
| etape sans aucune room `core` | refus |
| `code` de room absent de la base | refus, rappelle que la casse compte |
| `code` de room INACTIVE | refus, message distinct du precedent |

Trois regles qui ne se devinent pas :

1. **La progression se compte sur les rooms `core` seules.** Une room `optional` ou
   `bonus` terminee ne gonfle pas le pourcentage.
2. **La progression se compte par CODE DE ROOM, jamais par couple (etape, room).** Une
   meme room appartient a plusieurs parcours ; la terminer quelque part la termine
   partout. Scoper a l'etape casserait ce cas et seulement celui-la, donc sans se voir.
3. **Le vocabulaire dit « recommande », jamais « requis ».** Un parcours est une
   recommandation editoriale, pas un prerequis technique.

`data/reports/roadmap-candidates.md` est marque `derived` : c'est un regroupement
MECANIQUE des 714 rooms par tag, matiere premiere des prochains parcours. Ce n'est pas
une roadmap et ca ne peut pas en devenir une par transformation.

---

## Front

`http://localhost:5173`, proxifie vers l'API sur le meme origine (aucun CORS en
developpement, et c'est la cible de production decidee en D3).

**L'etat des filtres vit dans l'URL, et nulle part ailleurs.** Une vue filtree est
partageable telle quelle, et le bouton retour fonctionne sans code dedie. TanStack
Router serialiserait les tableaux en JSON encode ; on lui substitue la convention du
projet (`packages/shared/src/querystring.ts`), si bien que la barre d'adresse et la
requete HTTP ont la meme syntaxe :

```
/rooms?difficulty=easy&tech=linux
```

Les valeurs par defaut (`sort=popular`, `page=1`, `limit=24`) sont IMPLICITES : elles
n'apparaissent jamais dans l'URL. Le contrat de filtre est valide par le meme schema
Zod des deux cotes du reseau — `RoomSearchSchema` cote client, `RoomListQuerySchema`
cote serveur, memes definitions de champ, memes bornes.

Trois points a ne pas casser :

1. **Aucun `.toLowerCase()` sur un `rooms.code`**, ni dans les liens internes, ni dans
   le lien sortant. 14 des 714 codes portent des majuscules. Cas temoin :
   [`/rooms/AIforcyber-aoc2025-y9wWQ1zRgB`](http://localhost:5173/rooms/AIforcyber-aoc2025-y9wWQ1zRgB).
2. **Les trois etats sont explicites** — chargement, vide, erreur — sur chaque
   ressource. Jamais d'ecran blanc. Pendant un rechargement, la liste precedente reste
   affichee, grisee.
3. **La couleur n'est jamais le seul porteur d'information.** Chaque badge de
   difficulte, de type et d'equipe affiche son libelle. Contrastes mesures : 6,54 a
   7,38 pour le blanc sur les couleurs d'equipe, 14,8 a 16,2 pour les fonds de
   difficulte.

---

## Repartition

- **Malick** : `scraper/`, `data/datasets/`. Scraping, nettoyage, production du dataset.
- **Nelkael** : tout le reste. Architecture, Postgres, API, front, roadmap, deploiement.
- **Zone partagee** : `data/datasets/rooms.schema.json` et `docs/data-contract.md`.
  Toute modification y est une decision commune.
