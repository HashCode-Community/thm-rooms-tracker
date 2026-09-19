# Déploiement

Ce document dit **ce qu'il faut poser et pourquoi**. Il ne choisit pas l'hébergeur : ce choix
appartient à Nel, et rien ici n'en dépend.

Chaque chiffre est mesuré, pas estimé. Chaque réglage nomme ce qui casse quand il est absent ou
faux — un réglage dont on a oublié la raison finit par être « simplifié ».

---

## Ce qui se déploie : deux artefacts, pas un

| Artefact | Produit par | Servi comment |
|---|---|---|
| API | `pnpm build` → `apps/api/dist/` | processus Node, `node apps/api/dist/server.js` |
| Front | `pnpm build` → `apps/web/dist/` | fichiers statiques |

Le front est une application à page unique : **toute route inconnue doit renvoyer `index.html`**,
sinon un rechargement sur `/roadmap/fondamentaux` donnera un 404 de l'hébergeur. Ce n'est pas un
détail : c'est le premier symptôme que remonte un utilisateur qui partage un lien.

**`packages/shared` doit être construit avant l'API.** `pnpm build` à la racine le fait dans le bon
ordre. Le paquet expose son source sous la condition `development` et son artefact construit par
défaut : en production, rien ne transpile à la volée. Ce point a déjà cassé une fois — voir la dette
n° 11.

---

## Ordre des opérations

```bash
pnpm install --frozen-lockfile
pnpm build

pnpm --filter @thm/api run db:migrate
pnpm --filter @thm/api run db:seed
pnpm data:import -- --apply-mappings --apply
pnpm --filter @thm/api run roadmap:seed -- --apply
```

**`--apply` sur les deux dernières lignes.** La simulation est leur défaut, volontairement : sans le
drapeau elles sortent en **code 0 sans rien écrire**, la base reste vide, et la panne se manifeste
plus loin sous une forme qui n'a aucun rapport.

---

## Variables d'environnement

| Variable | Défaut | Ce qui casse sans elle, ou avec la mauvaise valeur |
|---|---|---|
| `DATABASE_URL` | — | l'API ne démarre pas |
| `NODE_ENV` | `development` | **doit valoir `production`**. Sinon `/docs` publie la surface d'API complète, et le détail technique des erreurs 500 part dans les réponses |
| `API_HOST` / `API_PORT` | `127.0.0.1` / `3000` | à adapter à la plateforme |
| `TRUST_PROXY` | `false` | voir ci-dessous — **aucune valeur par défaut n'est sûre** |
| `CORS_ORIGINS` | vide | le front ne pourra pas appeler l'API depuis un autre domaine |
| `RATE_LIMIT_MAX` | `120` | 120 requêtes par minute et par adresse |
| `RATE_LIMIT_WINDOW_MS` | `60000` | |
| `LOG_LEVEL` | `info` | |

Il n'y a **aucun secret côté front**. Tout ce qui est préfixé `VITE_` est embarqué en clair dans le
paquet et donc public par nature.

### `TRUST_PROXY` — un piège à deux faces

Décide si `request.ip` lit `X-Forwarded-For`. C'est la clé de comptage de la limite de débit.

- À **`false` derrière un proxy** : toutes les requêtes portent l'adresse du proxy. La limite devient
  **un seul seau partagé par tous les visiteurs**, et le site se limite lui-même dès qu'il a du
  trafic.
- À **`true` sans proxy devant** : n'importe qui pose l'en-tête et s'attribue un seau neuf à chaque
  requête. La limite ne limite plus rien.

La valeur retenue par défaut, `false`, est la moins dangereuse — elle dégrade le service au lieu de
l'ouvrir. **Le déploiement doit trancher, il n'y a pas de bon défaut.**

### `CORS_ORIGINS`

Vide par défaut : aucun en-tête CORS n'est posé, seule la même origine appelle l'API. C'est juste en
développement, où le front passe par le proxy de Vite.

[ADR-0001](adr/0001-arbitrages-initiaux.md) D3 met le front sur `<domaine>` et l'API sur
`api.<domaine>` : **deux origines différentes**. Sans cette variable, le navigateur refusera chaque
appel.

```
CORS_ORIGINS=https://thm.example
```

`*` est **refusé au démarrage**, pas ignoré. Une étoile est une intention ; la traiter comme une
faute de frappe laisserait quelqu'un croire qu'il a ouvert l'API alors que non, ou l'inverse.

---

## Ce que l'hébergeur doit poser, et que le code ne peut pas

### En-têtes du front

L'API pose les siens elle-même (`apps/api/src/http/securite.ts`). Le front est servi en statique :
sa politique se pose chez l'hébergeur ou le proxy, et **aucun test de ce dépôt ne peut l'atteindre**.

```
Content-Security-Policy: default-src 'self'; img-src 'self' data:;
    style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.<domaine>;
    frame-ancestors 'none'; base-uri 'none'; form-action 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

`connect-src` doit nommer l'origine de l'API. C'est pour ça qu'aucune balise `<meta>` CSP n'est posée
dans `index.html` : elle serait écrite avant que ce domaine soit connu et casserait la production le
jour du déploiement.

`style-src 'unsafe-inline'` est nécessaire tant que des styles en ligne subsistent dans les
composants. Le jour où ils disparaissent, retirer cette permission.

### Ligne de requête d'au moins 2 ko

`/api/rooms/batch` prend les codes en paramètres répétés. Le client borne l'URL à **1 900 octets**
par construction, et un test l'exige pour n'importe quelle longueur de code. Mesuré au navigateur sur
les 714 rooms : **8 tranches, URL la plus longue 1 895 octets**.

Un proxy réglé sous 2 ko rendrait **414** sur la page `/progression` d'un utilisateur avancé, et sur
lui seul.

### Journal persistant

L'API écrit sur la sortie standard. **L'adresse IP en est retirée** avant écriture,
`x-forwarded-for` compris : c'est une promesse faite sur la page `/mentions` et tenue par un test.

Conserver la sortie quelque part : le 15 septembre, un arrêt du serveur de développement n'a pas pu
être diagnostiqué parce que sa sortie était partie avec la session qui l'avait lancé.

---

## Vérification après mise en ligne

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://api.<domaine>/health        # 200
curl -s -o /dev/null -w '%{http_code}\n' https://api.<domaine>/docs          # 404
curl -s -o /dev/null -w '%{http_code}\n' https://api.<domaine>/docs/json     # 404
curl -sD - -o /dev/null https://api.<domaine>/api/stats | grep -i strict-transport-security
```

Les quatre sont déjà vérifiés **à chaque commit** par la CI, sur un build de production réel. Les
rejouer après déploiement vérifie la plateforme, pas le code.

À vérifier en plus, et seulement là :

- un rechargement direct sur `https://<domaine>/roadmap/fondamentaux` rend la page, pas un 404 ;
- la page `/progression` d'un compte à plus de 200 rooms terminées se charge — c'est le test de la
  ligne de requête ;
- les en-têtes du front sont bien ceux listés plus haut.

---

## Ce qui reste à décider, et qui n'est pas technique

La page `/mentions` n'affirme que du vérifiable. **Quatre informations manquent**, et aucune ne se
déduit du code :

1. l'**éditeur** et le responsable de publication ;
2. l'**hébergeur** ;
3. une **adresse de contact** ;
4. la **licence** — le dépôt n'a ni fichier `LICENSE` ni champ `license`.

Elles sont **dues avant toute mise en ligne publique**. Une section absente vaut mieux qu'une section
remplie au hasard, mais l'absence n'est pas tenable une fois le site en ligne.
