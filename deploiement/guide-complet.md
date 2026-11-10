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
| **La base de données** — le catalogue de rooms et les parcours | **Neon** | le palier gratuit n'expire jamais, contrairement à celui de Render |
| **L'API** — le programme qui lit la base et répond | **Render** | Fastify est un programme qui tourne en permanence, pas une fonction |
| **Le site** — les pages que le visiteur voit | **Cloudflare Pages** | des fichiers à servir, rien à exécuter |

**L'ordre compte** : base → la remplir → API → site → rebrancher les deux. Si vous inversez, vous
tournerez en rond sur des erreurs qui n'ont pas l'air liées.

**Une seule branche de production.** Tout correctif relu et fusionné arrive sur **`main`**.
Partout où un service demande une branche, répondez `main`.

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

Les rooms ne sont pas dans la base : elles sont dans un fichier du dépôt, et six commandes les y
mettent. **Ces commandes tournent depuis votre machine**, pas depuis un serveur.

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

Le script affiche les six étapes et s'arrête à la première qui échoue, en disant laquelle. Sa ligne
« Base visée » n'affiche que l'hôte. Les outils externes peuvent toutefois inclure des informations
sensibles dans leurs erreurs : ne publiez pas la sortie du terminal sans la relire.

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

### 2.3 Les six commandes, dans cet ordre

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

**Attendu : un nombre de rooms supérieur à 0, et 3 parcours.** Si vous voyez 0, une des commandes
n'a pas tourné ou le `--apply` manque.

---

## Étape 3 — L'API, chez Render

### 3.1 Créer le compte

1. Ouvrir **<https://render.com>** puis **Get Started**.
2. **Sign in with GitHub**, et autoriser Render à voir le dépôt
   **`HashCode-Community/thm-rooms-tracker`**.

### 3.2 Créer le service

1. Dans le tableau de bord : **New +** (en haut à droite) → **Web Service**.
2. Ouvrir l'onglet **Public Git Repository**, coller
   `https://github.com/HashCode-Community/thm-rooms-tracker`, puis **Connect**.
3. Remplir le formulaire :

   | Champ | Valeur | Pourquoi |
   |---|---|---|
   | Name | `thm-roadmap-api` | il donnera l'adresse `thm-roadmap-api.onrender.com` |
   | Region | **Frankfurt (EU Central)** | la même que la base |
   | Branch | **`main`** | branche de production |
   | Language / Runtime | **Docker** | la recette de construction est dans le dépôt |
   | Dockerfile Path | `./deploiement/2-api/Dockerfile` | |
   | Docker Build Context Directory | `./app` | |
   | Health Check Path | `/health` | Render vérifie aussi la connexion à la base |
   | Instance Type | **Free** | |

### 3.3 Les variables d'environnement

Toujours dans le même formulaire, section **Environment Variables** → **Add Environment Variable**,
neuf fois :

| Key | Value |
|---|---|
| `DATABASE_URL` | votre chaîne Neon complète |
| `NODE_ENV` | `production` |
| `API_HOST` | `0.0.0.0` |
| `API_PORT` | `10000` |
| `PORT` | `10000` |
| `TRUST_PROXY` | `1` |
| `CORS_ORIGINS` | `https://exemple.invalid` — **valeur provisoire**, corrigée à l'étape 5 |
| `RATE_LIMIT_MAX` | `120` |
| `LOG_LEVEL` | `info` |

**Ce que chacune évite**, parce qu'aucune n'est là par habitude :

- `NODE_ENV=production` : sans elle, l'API publie sa documentation interne et le détail technique
  de ses erreurs.
- `API_HOST=0.0.0.0` : la valeur par défaut, `127.0.0.1`, signifie « joignable seulement depuis
  l'intérieur du conteneur », c'est-à-dire par personne.
- `API_PORT=10000` et `PORT=10000` : l'application et Render doivent écouter et sonder le même
  port. Si les valeurs divergent, Render déclare le service en échec sans autre explication.
- `TRUST_PROXY=1` : le **nombre** d'intermédiaires devant l'application, et jamais `true` —
  l'application refuse désormais cette valeur, qui laissait l'appelant choisir l'adresse sur
  laquelle il était compté. Sans cette variable, toutes les requêtes
  semblent venir de la même adresse et la limite anti-abus devient une limite globale.
- `RATE_LIMIT_MAX=120` : plafond de requêtes par fenêtre et par visiteur.
- `LOG_LEVEL=info` : garde les diagnostics utiles sans activer les traces de développement.

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

**Attendu** : un long JSON dont `rooms.total` est supérieur à 0. Si `total` vaut 0, la base n'a
pas été remplie — retour à l'étape 2.

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
suivi le raccourci 4.0 et déposé `site-a-deposer`, votre projet Cloudflare existe déjà : passez
directement à l'**étape 5**. Ne créez pas un second projet avec « Connect to Git ».

Le site doit savoir **deux** choses, et elles ne se règlent pas au même endroit.

**a) L'adresse de l'API, compilée dans le site.** Le code n'écrit aucune adresse en dur : il lit
`VITE_API_BASE_URL` **au moment de la construction**. Sans elle, le site demande `/api/stats` à sa
propre adresse ; Cloudflare, ne trouvant aucun fichier à ce chemin, applique la règle de repli et
renvoie `index.html` avec un code **200**. Le site s'affiche donc normalement et montre
`Unexpected token '<'` à la place des données, **sans aucune erreur CORS** pour mettre sur la voie.
Cette variable se pose à l'étape 4.2, à côté de `NODE_VERSION`.

**b) Les deux fichiers `_headers` et `_redirects`**, que Cloudflare ne lit que s'ils sont dans le
dossier publié. Vite recopie tel quel tout ce qui se trouve dans `public/`.

1. Copier les deux modèles vers `app/apps/web/public/` sans modifier les originaux :

```powershell
cd C:\Users\N\Projets\thm-roadmap
copy deploiement\3-site\_headers app\apps\web\public\
copy deploiement\3-site\_redirects app\apps\web\public\
```

2. Ouvrir **`app/apps/web/public/_headers`**, puis y remplacer
   `https://api.exemple.fr` par votre adresse Render, sans barre oblique finale :
   `https://thm-roadmap-api.onrender.com`.
3. Versionner uniquement les copies destinées à la construction Git :

```powershell
git add app/apps/web/public/_headers app/apps/web/public/_redirects
git commit -m "chore(deploy): en-tetes et repli du front"
git push origin main
```

Le modèle `deploiement/3-site/_headers` doit garder l'adresse d'exemple : le script d'upload direct
s'en sert comme garde et refuse un modèle déjà modifié.

**Attendu** : deux fois `1 fichier(s) copié(s).`. Si vous lisez « Le fichier spécifié est
introuvable », vous n'êtes pas à la racine du dépôt — le `cd` ci-dessus y mène.

### 4.2 Créer le projet — chemin Git uniquement

1. Ouvrir **<https://dash.cloudflare.com>**, créer un compte si besoin (**Sign up**, gratuit).
2. Menu de gauche : **Workers & Pages** → **Create** → onglet **Pages** → **Connect to Git**.
3. Autoriser Cloudflare à accéder au dépôt **`HashCode-Community/thm-rooms-tracker`**, le choisir,
   **Begin setup**.
4. Remplir :

   | Champ | Valeur |
   |---|---|
   | Project name | `thm-roadmap` |
   | Production branch | **`main`** |
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

- l'accueil affiche le nombre de rooms et d'heures renvoyé par l'API, ainsi que le graphe des trois parcours ;
- **Catalogue** affiche des rooms et les filtres répondent ;
- ouvrir un parcours, cocher une room : la progression se met à jour ;
- **coller directement** `https://thm-roadmap.pages.dev/roadmap/fondamentaux` dans la barre
  d'adresse et valider — la page doit s'afficher, **pas** une erreur 404. C'est le test du fichier
  `_redirects`.

---

## Étape 6 — Vérifier les mentions

La page **Mentions** nomme déjà Cloudflare pour le site, Render pour l'API et Neon pour la base.
Ouvrez-la une fois sur le site publié et vérifiez que ces trois rôles sont toujours exacts.

Une modification future de cette page suit la procédure ci-dessous. Si vous avez utilisé le
raccourci 4.0, un `git push` ne met pas le site en ligne : Cloudflare n'est pas connecté à Git.

---

## Mettre à jour ce qui est en ligne

Une poussée Git ne suffit pas avec les deux services créés dans ce guide.

### API — déploiement manuel sur Render

Le service a été créé depuis **Public Git Repository**. Dans cette configuration, Render ne
redéploie pas automatiquement les nouveaux commits.

1. Pousser le correctif sur la branche de production.
2. Ouvrir **Render** → le service `thm-roadmap-api`.
3. Choisir **Manual Deploy** → **Deploy latest commit**.
4. Attendre la fin de la construction, puis vérifier `/health` et les journaux du service.

Tant que cette action manuelle n'est pas faite, l'ancienne version de l'API reste en ligne même si
GitHub contient déjà le correctif.

### Site — reconstruire puis redéposer sur Cloudflare

Le projet créé par le raccourci 4.0 est un dépôt direct d'assets, sans connexion Git.

1. Récupérer le dernier code sur l'ordinateur.
2. Relancer :

   ```powershell
   cd C:\Users\N\Projets\thm-roadmap\deploiement\3-site
   .\preparer-le-site.ps1 -ApiUrl 'https://thm-roadmap-api.onrender.com'
   ```

3. Dans **Cloudflare** → **Workers & Pages** → le projet, créer un nouveau déploiement par
   **Upload assets**.
4. Déposer le **contenu** du nouveau dossier `site-a-deposer`, puis refaire les vérifications de
   l'étape 5, notamment le rechargement direct d'une URL `/roadmap/…`.

Ne connectez pas ce projet à Git après coup : ce serait un second chemin de construction, avec un
risque de publier sans les fichiers de sécurité assemblés par le script.

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
| Render : **Build failed** | souvent la branche ou le chemin du Dockerfile | vérifier `main`, `./deploiement/2-api/Dockerfile`, contexte `./app` |
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
