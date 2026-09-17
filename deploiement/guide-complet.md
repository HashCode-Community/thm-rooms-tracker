# Mettre le site en ligne, pas à pas

Ce guide part du principe que **c'est la première fois**. Chaque étape dit où cliquer, quoi coller,
et **comment savoir que ça a marché**. Comptez une heure la première fois.

Il n'y a **rien à payer** : les trois services utilisés ont un palier gratuit.

> Vous cherchez le raisonnement plutôt que les clics ? [`app/docs/deploiement.md`](../app/docs/deploiement.md)
> dit ce que l'hébergeur doit poser et pourquoi. Ce document-ci dit comment.

---

## Avant de commencer

**Ce qu'il vous faut** : un compte GitHub (vous l'avez), et de quoi recevoir un courriel de
confirmation. Aucune carte bancaire pour le chemin décrit ici.

**Trois services, trois rôles.** Un site comme celui-ci n'est pas un seul programme :

| Ce que c'est | Où ça va | Pourquoi pas ailleurs |
|---|---|---|
| **La base de données** — les 714 rooms, les parcours | **Neon** | le palier gratuit n'expire jamais, contrairement à celui de Render |
| **L'API** — le programme qui lit la base et répond | **Render** | Fastify est un programme qui tourne en permanence, pas une fonction |
| **Le site** — les pages que le visiteur voit | **Cloudflare Pages** | des fichiers à servir, rien à exécuter |

**L'ordre compte** : base → la remplir → API → site → rebrancher les deux. Si vous inversez, vous
tournerez en rond sur des erreurs qui n'ont pas l'air liées.

**Une branche, pas l'autre.** Tout le travail est sur **`feat/refonte-ui`**. La branche `main` a
**61 commits de retard** : déployer `main` mettrait en ligne une version d'il y a une semaine.
Partout où un service demande une branche, répondez `feat/refonte-ui`.

---

## Étape 1 — La base de données, chez Neon

### 1.1 Créer le compte

1. Ouvrir **<https://neon.com>** puis **Sign up**.
2. Choisir **Continue with GitHub** : un compte de moins à gérer.
3. Neon propose de créer un projet. Remplir :

   | Champ | Valeur |
   |---|---|
   | Project name | `thm-roadmap` |
   | Postgres version | **16** |
   | Region | **Europe (Frankfurt)** — le plus proche de vos visiteurs |

4. **Create project**.

### 1.2 Récupérer la chaîne de connexion

Neon affiche tout de suite un encadré **Connection string**. C'est une longue ligne qui ressemble à :

```
postgresql://neondb_owner:UnMotDePasse@ep-quelque-chose-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

**Vérifiez que l'adresse contient `-pooler`.** S'il y a un sélecteur **Pooled connection** ou
**Connection pooling**, activez-le. Cette version supporte les connexions courtes et nombreuses d'un
service qui se rendort ; l'autre lâcherait au réveil.

Copiez cette ligne et gardez-la de côté — un fichier texte, pas un message public. **C'est un mot de
passe** : qui l'a peut lire et écrire toute la base.

> **Ce qui vient de se passer** : vous avez une base PostgreSQL vide, accessible depuis internet,
> chiffrée. Elle ne contient encore aucune room.

---

## Étape 2 — Remplir la base, depuis votre ordinateur

Les 714 rooms ne sont pas dans la base : elles sont dans un fichier du dépôt, et quatre commandes
les y mettent. **Ces commandes tournent depuis votre machine**, pas depuis un serveur.

### 2.0 Le raccourci : un seul script

Tout ce qui suit tient en une commande. Dans **PowerShell** :

```powershell
cd C:\Users\N\Projets\thm-roadmap\deploiement\1-base
.\remplir-la-base.ps1 -DatabaseUrl 'collez-ici-votre-chaine-neon'
```

Si PowerShell refuse de l'exécuter — c'est sa protection par défaut — autorisez la fenêtre en cours,
une seule fois :

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Le script affiche les six étapes et s'arrête à la première qui échoue, en disant laquelle. **Il
n'affiche jamais votre mot de passe**, même en cas d'erreur.

Si vous préférez voir ce qu'il fait, la suite détaille les mêmes commandes, une par une.

### 2.1 Ouvrir un terminal au bon endroit

Ouvrez **PowerShell** (ou Git Bash) et placez-vous dans le dossier `app` du projet :

```powershell
cd C:\Users\N\Projets\thm-roadmap\app
```

### 2.2 Donner l'adresse de la base au terminal

**PowerShell** — collez votre chaîne Neon entre les guillemets :

```powershell
$env:DATABASE_URL = 'postgresql://…-pooler….neon.tech/neondb?sslmode=require'
```

**Git Bash**, si vous préférez :

```bash
export DATABASE_URL='postgresql://…-pooler….neon.tech/neondb?sslmode=require'
```

Cette valeur ne vit que dans **cette** fenêtre de terminal. Si vous la fermez, il faudra la
redonner. C'est voulu : elle n'est écrite nulle part.

### 2.3 Les quatre commandes, dans cet ordre

```powershell
pnpm install --frozen-lockfile
pnpm build

pnpm --filter @thm/api run db:migrate
pnpm --filter @thm/api run db:seed
pnpm data:import -- --apply-mappings --apply
pnpm --filter @thm/api run roadmap:seed -- --apply
```

**Le `--apply` des deux dernières lignes n'est pas décoratif.** Sans lui, elles font une simulation :
elles affichent ce qu'elles feraient, se terminent **sans erreur**, et n'écrivent rien. La base reste
vide, et la panne apparaît beaucoup plus tard sous une forme qui n'a aucun rapport.

### 2.4 Vérifier

La dernière commande doit finir par `APPLIQUE. 3 parcours en base.`

Pour en être sûr, dans la console Neon, onglet **SQL Editor**, collez :

```sql
select count(*) from rooms;
select count(*) from tracks;
```

**Attendu : 714 et 3.** Si vous voyez 0, une des commandes n'a pas tourné ou le `--apply` manque.

---

## Étape 3 — L'API, chez Render

### 3.1 Créer le compte

1. Ouvrir **<https://render.com>** puis **Get Started**.
2. **Sign in with GitHub**, et autoriser Render à voir le dépôt
   **`HashCode-Community/thm-rooms-tracker`**.

### 3.2 Créer le service

1. Dans le tableau de bord : **New +** (en haut à droite) → **Web Service**.
2. Choisir le dépôt **`thm-rooms-tracker`** → **Connect**.
3. Remplir le formulaire :

   | Champ | Valeur | Pourquoi |
   |---|---|---|
   | Name | `thm-roadmap-api` | il donnera l'adresse `thm-roadmap-api.onrender.com` |
   | Region | **Frankfurt (EU Central)** | la même que la base |
   | Branch | **`feat/refonte-ui`** | `main` a 61 commits de retard |
   | Language / Runtime | **Docker** | la recette de construction est dans le dépôt |
   | Dockerfile Path | `./deploiement/2-api/Dockerfile` | |
   | Docker Build Context Directory | `./app` | |
   | Instance Type | **Free** | |

### 3.3 Les variables d'environnement

Toujours dans le même formulaire, section **Environment Variables** → **Add Environment Variable**,
six fois :

| Key | Value |
|---|---|
| `DATABASE_URL` | votre chaîne Neon complète |
| `NODE_ENV` | `production` |
| `API_HOST` | `0.0.0.0` |
| `API_PORT` | `10000` |
| `TRUST_PROXY` | `true` |
| `CORS_ORIGINS` | `https://exemple.invalid` — **valeur provisoire**, corrigée à l'étape 5 |

**Ce que chacune évite**, parce qu'aucune n'est là par habitude :

- `NODE_ENV=production` : sans elle, l'API publie sa documentation interne et le détail technique
  de ses erreurs.
- `API_HOST=0.0.0.0` : la valeur par défaut, `127.0.0.1`, signifie « joignable seulement depuis
  l'intérieur du conteneur », c'est-à-dire par personne.
- `API_PORT=10000` : le port que Render écoute. S'il ne correspond pas, Render déclare le service en
  échec sans autre explication.
- `TRUST_PROXY=true` : il y a un serveur intermédiaire devant. Sans cela, toutes les requêtes
  semblent venir de la même adresse et la limite anti-abus devient une limite globale.

### 3.4 Déployer et attendre

**Create Web Service**. Render construit l'image — **5 à 10 minutes la première fois**, c'est
normal. Les journaux défilent en direct ; la ligne qui compte est :

```
Your service is live 🎉
```

### 3.5 Vérifier

Render affiche l'adresse en haut de la page, du type
`https://thm-roadmap-api.onrender.com`. Ouvrez, **en ajoutant `/health`** :

```
https://thm-roadmap-api.onrender.com/health
```

**Attendu**, mot pour mot : `{"status":"ok","db":"ok"}`. Le second `ok` dit que l'API a bien
joint la base — s'il manque, c'est `DATABASE_URL` qui est en cause, pas Render. Ouvrez ensuite :

```
https://thm-roadmap-api.onrender.com/api/stats
```

**Attendu** : un long JSON qui commence par `{"rooms":{"total":714,…`. Si `total` vaut 0, la base
n'a pas été remplie — retour à l'étape 2.

**Notez cette adresse**, elle sert deux fois dans la suite.

> **Le service gratuit se rendort** après 15 minutes sans visite, et met 30 à 60 secondes à se
> réveiller. Ce n'est pas une panne. Le site affiche un message clair pendant ce temps.

---

## Étape 4 — Le site, chez Cloudflare Pages

### 4.0 Le raccourci : un seul script

Le site doit connaître l'adresse de l'API **avant** d'être construit. Une commande fait les trois
choses — écrire l'adresse, construire, assembler :

```powershell
cd C:\Users\N\Projets\thm-roadmap\deploiement\3-site
.\preparer-le-site.ps1 -ApiUrl 'https://thm-roadmap-api.onrender.com'
```

Elle produit un dossier **`site-a-deposer`**, environ 600 ko. Chez Cloudflare :
**Workers & Pages** → **Create** → **Pages** → **Upload assets**, et vous glissez le **contenu** de
ce dossier. Aucun dépôt Git à connecter, aucun réglage de construction : c'est le chemin le plus
court, et le plus difficile à rater.

Le revers : à chaque modification du site, il faudra relancer le script et redéposer. La suite décrit
l'autre chemin, celui où Cloudflare reconstruit tout seul à chaque poussée.

### 4.1 Dire au site où est l'API

**Cette section ne concerne que le chemin « Cloudflare reconstruit depuis Git ».** Si vous avez
suivi le raccourci 4.0, le script a déjà tout fait et vous pouvez passer à 4.2.

Le site doit savoir **deux** choses, et elles ne se règlent pas au même endroit.

**a) L'adresse de l'API, compilée dans le site.** Le code n'écrit aucune adresse en dur : il lit
`VITE_API_BASE_URL` **au moment de la construction**. Sans elle, le site demande `/api/stats` à sa
propre adresse ; Cloudflare, ne trouvant aucun fichier à ce chemin, applique la règle de repli et
renvoie `index.html` avec un code **200**. Le site s'affiche donc normalement et montre
`Unexpected token '<'` à la place des données, **sans aucune erreur CORS** pour mettre sur la voie.
Cette variable se pose à l'étape 4.2, à côté de `NODE_VERSION`.

**b) Les deux fichiers `_headers` et `_redirects`**, que Cloudflare ne lit que s'ils sont dans le
dossier publié. Vite recopie tel quel tout ce qui se trouve dans `public/`.

1. Ouvrir `deploiement/3-site/_headers`.
2. Y remplacer **`https://api.exemple.fr`** par votre adresse Render, sans barre oblique finale :
   `https://thm-roadmap-api.onrender.com`.
3. Copier les deux fichiers vers `app/apps/web/public/` :

```powershell
cd C:\Users\N\Projets\thm-roadmap
copy deploiement\3-site\_headers app\apps\web\public\
copy deploiement\3-site\_redirects app\apps\web\public\
git add app/apps/web/public/_headers app/apps/web/public/_redirects
git commit -m "chore(deploy): en-tetes et repli du front"
git push origin feat/refonte-ui
```

**Attendu** : deux fois `1 fichier(s) copié(s).`. Si vous lisez « Le fichier spécifié est
introuvable », vous n'êtes pas à la racine du dépôt — le `cd` ci-dessus y mène.

### 4.2 Créer le projet

1. Ouvrir **<https://dash.cloudflare.com>**, créer un compte si besoin (**Sign up**, gratuit).
2. Menu de gauche : **Workers & Pages** → **Create** → onglet **Pages** → **Connect to Git**.
3. Autoriser Cloudflare à accéder au dépôt **`HashCode-Community/thm-rooms-tracker`**, le choisir,
   **Begin setup**.
4. Remplir :

   | Champ | Valeur |
   |---|---|
   | Project name | `thm-roadmap` |
   | Production branch | **`feat/refonte-ui`** |
   | Framework preset | **None** |
   | Build command | `corepack enable && pnpm install --frozen-lockfile && pnpm build` |
   | Build output directory | `apps/web/dist` |
   | Root directory (advanced) | `app` |

5. Dérouler **Environment variables (advanced)** et ajouter :

   | Variable | Value |
   |---|---|
   | `NODE_VERSION` | `24` |
   | `VITE_API_BASE_URL` | votre adresse Render, **sans barre oblique finale** |

   `NODE_VERSION` : sans elle, Cloudflare construit avec une version de Node trop ancienne et la
   construction échoue sur une erreur de syntaxe incompréhensible.

   `VITE_API_BASE_URL` : sans elle, la construction **réussit** et le site appelle sa propre adresse
   au lieu de l'API. Voir 4.1 (a). C'est la panne la plus difficile à diagnostiquer de tout ce
   guide, parce qu'elle ne produit ni erreur CORS, ni erreur de sécurité, ni code d'erreur HTTP.

6. **Save and Deploy**. Comptez 3 à 5 minutes.

### 4.3 Vérifier

Cloudflare donne une adresse du type `https://thm-roadmap.pages.dev`. Ouvrez-la.

**Attendu** : la page d'accueil, avec le graphe des trois parcours. Si le graphe reste vide, c'est
que le site n'arrive pas à parler à l'API — c'est l'étape 5 qui règle cela.

---

## Étape 5 — Rebrancher les deux

L'API refuse encore les appels du site : à l'étape 3 vous lui avez donné une adresse provisoire.

1. Retourner sur **Render**, votre service, onglet **Environment**.
2. Modifier `CORS_ORIGINS` : mettre l'adresse Cloudflare **exacte**, sans barre oblique finale :

   ```
   https://thm-roadmap.pages.dev
   ```

3. **Save, rebuild, and deploy**. Render redémarre le service, une minute environ.

### Vérifier, cette fois pour de bon

Sur `https://thm-roadmap.pages.dev` :

- l'accueil affiche **714**, **890 heures**, et le graphe des trois parcours ;
- **Catalogue** affiche des rooms et les filtres répondent ;
- ouvrir un parcours, cocher une room : la progression se met à jour ;
- **coller directement** `https://thm-roadmap.pages.dev/roadmap/fondamentaux` dans la barre
  d'adresse et valider — la page doit s'afficher, **pas** une erreur 404. C'est le test du fichier
  `_redirects`.

---

## Étape 6 — La dernière ligne à écrire

La page **Mentions** porte encore « Hébergeur : à renseigner à la mise en ligne ». Maintenant vous
le savez. Dans `app/apps/web/src/routes/mentions-page.tsx`, remplacer cette ligne par :

```
Hébergeur : Cloudflare, Inc. (site) et Render Services, Inc. (API).
```

Puis `git commit` et `git push` : Cloudflare redéploie tout seul à chaque poussée.

---

## Quand ça ne marche pas

| Ce que vous voyez | Ce que c'est | Quoi faire |
|---|---|---|
| Le site s'affiche et montre **`Unexpected token '<'`** au lieu des données | le site appelle sa **propre** adresse au lieu de l'API : `VITE_API_BASE_URL` manquait pendant la construction | la poser et **reconstruire**. La corriger après coup ne suffit pas : l'adresse est compilée dans le site. Étape 4.1 (a) |
| Le site est **vide** et la console dit `blocked by CORS policy` | l'API refuse les appels du site | `CORS_ORIGINS` sur Render doit être **exactement** l'adresse du site, sans `/` final |
| La console dit `Refused to connect… Content Security Policy` | le site n'a pas le droit d'appeler l'API | `connect-src` dans `_headers` doit nommer l'adresse de l'API |
| **404** en rechargeant `/roadmap/…` | le fichier `_redirects` n'est pas dans `apps/web/public/` | étape 4.1, puis repousser |
| La première visite met **une minute** | le service gratuit se réveillait | normal. Rien à corriger |
| `/api/stats` répond `"total":0` | la base est vide | étape 2, en vérifiant le `--apply` |
| Render : **Build failed** | souvent la branche ou le chemin du Dockerfile | vérifier `feat/refonte-ui`, `./deploiement/2-api/Dockerfile`, contexte `./app` |
| Cloudflare : erreur de syntaxe à la construction | version de Node trop ancienne | ajouter `NODE_VERSION=24` |

Les journaux sont vos amis : **Render → Logs**, **Cloudflare → Deployments → View build log**. Le
message utile est presque toujours la **première** ligne rouge, pas la dernière.

---

## Ce que le site n'a pas besoin de faire

**Aucun bandeau de consentement.** Ce n'est pas un oubli, c'est une mesure : le site ne pose
**aucun cookie** — vérifié navigateur vide sur trois pages. Il écrit deux clés, et aucune n'appelle
le consentement :

| Clé | Où | Pourquoi elle est exemptée |
|---|---|---|
| `thm-roadmap.progression` | stockage local | strictement nécessaire au service **expressément demandé** : cocher une room. Rien ne part sur le réseau, aucun identifiant n'est créé |
| `tsr-scroll-restoration-v1_3` | stockage de session | confort d'interface — la position de défilement — effacée à la fermeture de l'onglet |

L'article 82 de la loi Informatique et Libertés exempte les traceurs strictement nécessaires au
service demandé, et le bandeau n'est obligatoire que si l'on dépose un traceur qui exige le
consentement : publicité, mesure d'audience non exemptée, traceur tiers. Il n'y en a aucun ici — ni
régie, ni analytique, ni police servie par un tiers.

Afficher un bandeau quand même serait **affirmer une surveillance qui n'existe pas**, et habituer un
visiteur de plus à cliquer « accepter » sans lire. Ce qui reste dû, c'est l'**information** : c'est
le rôle de `/mentions`, atteignable depuis le pied de chaque page.

Cette analyse n'est pas un avis juridique. Elle est vraie tant que la liste ci-dessus l'est : le
jour où une mesure d'audience ou une police tierce entre dans le site, la question se repose
entièrement.
