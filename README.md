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

---

## Repartition

- **Malick** : `scraper/`, `data/datasets/`. Scraping, nettoyage, production du dataset.
- **Nelkael** : tout le reste. Architecture, Postgres, API, front, roadmap, deploiement.
- **Zone partagee** : `data/datasets/rooms.schema.json` et `docs/data-contract.md`.
  Toute modification y est une decision commune.
