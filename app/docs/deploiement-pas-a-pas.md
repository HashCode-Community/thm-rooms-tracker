# Déploiement, pas à pas

Ce guide met le site en ligne **gratuitement**, en trois services. Il suppose que vous avez lu
[`deploiement.md`](deploiement.md), qui dit **ce que l'hébergeur doit poser et que le code ne peut
pas** : ce document-ci dit **comment**, avec des commandes.

Tous les fichiers cités vivent dans [`../deploy/`](../deploy).

---

## Le découpage, et pourquoi il est en trois

| Ce qui tourne | Où | Pourquoi là |
|---|---|---|
| **Base PostgreSQL** | **Neon** | palier gratuit qui **n'expire pas**, 0,5 Go — la base pèse **12 Mo** |
| **API Node** | **Render** ou **Koyeb** | Fastify est un processus qui tourne, pas une fonction : Cloudflare Workers ne convient pas |
| **Front statique** | **Cloudflare Pages** | bande passante illimitée, en-têtes et repli d'application à page unique en deux fichiers |

**Le piège à éviter d'emblée** : le Postgres gratuit de Render **expire au bout de 30 jours**. Le
site tomberait un mois après la mise en ligne, sans prévenir. La base va chez Neon, quel que soit
l'hébergeur de l'API.

---

## 1. La base, chez Neon

1. Créer un compte, puis un projet — région **Europe** (Francfort ou Amsterdam), PostgreSQL 16.
2. Copier la chaîne de connexion **« pooled »**, celle dont l'hôte contient `-pooler`. Elle supporte
   les connexions courtes et nombreuses d'un service qui se rendort. Elle finit par
   `?sslmode=require` : garder ce paramètre.
3. La garder de côté : c'est `DATABASE_URL`.

Neon met la base en veille au bout de cinq minutes sans requête et la réveille en moins d'une
seconde. Ce n'est pas le même sommeil que celui de l'API.

---

## 2. Remplir la base, depuis votre machine

Les migrations, le semis et l'import tournent avec `tsx` et les sources : ils ne sont **pas** dans
l'image de production, et c'est voulu — une image qui embarque de quoi réécrire sa propre base est
une image qui peut le faire par accident.

```bash
cd app
# La chaine de Neon, le temps de ces quatre commandes seulement.
export DATABASE_URL='postgresql://…-pooler…/neondb?sslmode=require'

pnpm install --frozen-lockfile
pnpm build

pnpm --filter @thm/api run db:migrate
pnpm --filter @thm/api run db:seed
pnpm data:import -- --apply-mappings --apply
pnpm --filter @thm/api run roadmap:seed -- --apply
```

**`--apply` sur les deux dernières lignes.** Sans le drapeau, elles sortent en **code 0 sans rien
écrire** : la base reste vide, et la panne se manifeste bien plus loin sous une forme qui n'a aucun
rapport.

Vérifier :

```bash
psql "$DATABASE_URL" -c 'select count(*) from rooms;'   # 714
psql "$DATABASE_URL" -c 'select count(*) from tracks;'  # 3
```

---

## 3. L'API

### Option A — Render (sans carte bancaire)

1. **New > Blueprint**, pointer sur ce dépôt : [`deploy/render.yaml`](../deploy/render.yaml) est lu
   automatiquement.
2. Renseigner les deux variables marquées `sync: false` dans l'interface :
   - `DATABASE_URL` — la chaîne Neon ;
   - `CORS_ORIGINS` — l'origine du front, **exacte, sans barre oblique finale**. Elle n'existe pas
     encore : y revenir après l'étape 4.
3. Déployer. Le premier build compile l'image Docker : comptez quelques minutes.

Le service gratuit **se rendort après 15 minutes** sans trafic et met **30 à 60 secondes** à se
réveiller. Le front sait l'afficher proprement — l'API rend alors un 502 ou un 503, et
`apps/web/src/api.ts` a un message pour ce cas précis — mais le premier visiteur attend.

### Option B — Koyeb (pas de plafond d'heures, carte demandée pour vérification)

Créer un service depuis le dépôt GitHub, type **Dockerfile**, chemin
`app/deploy/api/Dockerfile`, contexte `app`. Mêmes variables qu'au-dessus, port **3000**.

### Dans les deux cas

| Variable | Valeur | Ce qui casse sans elle |
|---|---|---|
| `NODE_ENV` | `production` | `/docs` publie toute la surface d'API, et le détail des erreurs 500 part dans les réponses |
| `API_HOST` | `0.0.0.0` | dans un conteneur, la valeur par défaut `127.0.0.1` veut dire « joignable par personne » |
| `API_PORT` | celui qu'impose la plateforme | le service ne répond pas au contrôle de santé |
| `TRUST_PROXY` | `true` | derrière un proxy, toutes les requêtes semblent venir de la même adresse : la limite de débit devient une limite globale |
| `DATABASE_URL` | la chaîne Neon | l'API ne démarre pas |
| `CORS_ORIGINS` | l'origine du front | le navigateur refuse tous les appels |

`TRUST_PROXY` n'a **aucune valeur par défaut sûre** : à `true` sans proxy, n'importe qui usurpe son
adresse via `x-forwarded-for` et contourne la limite de débit. Le mettre à `true` **parce qu'il y a
un proxy**, pas par habitude.

---

## 4. Le front, chez Cloudflare Pages

1. **Workers & Pages > Create > Pages > Connect to Git**, choisir ce dépôt.
2. Réglages de construction :

   | Champ | Valeur |
   |---|---|
   | Répertoire racine | `app` |
   | Commande | `corepack enable && pnpm install --frozen-lockfile && pnpm build` |
   | Dossier de sortie | `apps/web/dist` |
   | Version de Node | `24` (variable `NODE_VERSION`) |

3. Copier [`deploy/cloudflare/_headers`](../deploy/cloudflare/_headers) et
   [`deploy/cloudflare/_redirects`](../deploy/cloudflare/_redirects) dans `apps/web/public/`. Vite
   les recopie tels quels dans `dist`, et Cloudflare les lit là.

   **Avant de les copier, remplacer `https://api.exemple.fr`** dans `_headers` par l'origine réelle
   de l'API. C'est le `connect-src` : s'il est faux, le front n'a le droit d'appeler personne et la
   page reste vide sans message d'erreur lisible.

4. Retourner dans l'API renseigner `CORS_ORIGINS` avec l'adresse que Cloudflare vient d'attribuer
   (`https://….pages.dev`), puis redéployer l'API.

Le repli `/* /index.html 200` n'est pas un détail : sans lui, un rechargement direct sur
`/roadmap/fondamentaux` rend un 404 de l'hébergeur. C'est le premier symptôme que remonte quelqu'un
à qui on a partagé un lien.

---

## 5. Vérifier, une fois en ligne

```bash
API=https://votre-api.onrender.com
SITE=https://votre-site.pages.dev

curl -s -o /dev/null -w '%{http_code}\n' "$API/health"        # 200
curl -s -o /dev/null -w '%{http_code}\n' "$API/docs"          # 404
curl -s -o /dev/null -w '%{http_code}\n' "$API/docs/json"     # 404
curl -sD - -o /dev/null "$API/api/stats" | grep -i strict-transport-security
curl -sD - -o /dev/null "$SITE/" | grep -i content-security-policy
```

Les quatre premières sont **déjà vérifiées à chaque commit** par la CI, sur une construction de
production réelle. Les rejouer ici vérifie **la plateforme**, pas le code.

À vérifier en plus, et seulement là :

- un rechargement direct sur `$SITE/roadmap/fondamentaux` rend la page, pas un 404 ;
- la page `/progression` d'un visiteur à plus de 200 rooms terminées se charge — c'est le test de la
  ligne de requête : `/api/rooms/batch` envoie jusqu'à **1 895 octets** d'URL, un proxy réglé sous
  2 ko rendrait **414** sur cette page et sur elle seule ;
- les en-têtes du front sont bien ceux de `_headers`.

---

## 6. Ce qui reste à faire, et qui n'est pas technique

La page `/mentions` porte désormais l'éditeur, le contact et la licence. **L'hébergeur y est encore
« à renseigner à la mise en ligne »** : c'est la dernière des quatre informations, et elle ne peut
être écrite qu'une fois ces étapes faites. La remplir dans
`apps/web/src/routes/mentions-page.tsx`.

---

## Ce dont le site n'a pas besoin

**Aucun bandeau de consentement.** Ce n'est pas une omission, c'est une mesure : le site ne pose
**aucun cookie** — vérifié à vide sur trois pages, `document.cookie` reste vide et le navigateur
n'enregistre rien. Il écrit deux clés dans le navigateur, et aucune n'appelle le consentement :

| Clé | Où | Pourquoi elle est exemptée |
|---|---|---|
| `thm-roadmap.progression` | stockage local | strictement nécessaire au service **expressément demandé** : cocher une room. Rien ne part sur le réseau, aucun identifiant n'est créé |
| `tsr-scroll-restoration-v1_3` | stockage de session | confort d'interface — la position de défilement — effacée à la fermeture de l'onglet |

L'article 82 de la loi Informatique et Libertés exempte les traceurs strictement nécessaires au
service demandé par l'utilisateur, et le bandeau n'est obligatoire que si l'on dépose un traceur qui
exige le consentement : publicité, mesure d'audience non exemptée, traceur tiers. Il n'y en a aucun
ici — ni régie, ni analytique, ni police servie par un tiers.

Afficher un bandeau quand même serait **affirmer une surveillance qui n'existe pas**, et habituer un
visiteur de plus à cliquer « accepter » sans lire. Ce qui reste dû, en revanche, c'est
l'**information** : c'est le rôle de `/mentions`, atteignable depuis le pied de chaque page.

Cette analyse n'est pas un avis juridique. Elle est vraie tant que la liste ci-dessus l'est : le
jour où une mesure d'audience ou une police tierce entre dans le site, la question se repose
entièrement.
