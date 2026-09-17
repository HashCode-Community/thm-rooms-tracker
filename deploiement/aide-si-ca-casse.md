# Quand ça ne marche pas

Les journaux sont la première chose à regarder, et la **première ligne rouge** est presque toujours
la bonne, pas la dernière :

- **Render** → votre service → onglet **Logs**
- **Cloudflare** → votre projet → **Deployments** → **View build log**
- **Neon** → **Monitoring**, pour vérifier que la base reçoit bien des requêtes

---

## Le site s'affiche, mais il est vide

C'est le symptôme le plus fréquent, et il a deux causes possibles. Les deux se voient dans la
**console du navigateur** : `F12`, onglet **Console**.

| Ce que dit la console | Cause | Correction |
|---|---|---|
| `blocked by CORS policy` | l'API ne reconnaît pas le site | `CORS_ORIGINS` sur Render doit être **exactement** l'adresse du site, **sans barre oblique finale** |
| `Refused to connect… Content Security Policy` | le site n'a pas le droit d'appeler l'API | le `connect-src` de `_headers` doit nommer l'adresse de l'API. Le script `preparer-le-site.ps1` s'en charge |
| `502` ou `503` | l'API se réveille | attendre 60 secondes et recharger. C'est normal sur le palier gratuit |

---

## Une page rechargée donne 404

Vous ouvrez `/roadmap/fondamentaux` directement dans la barre d'adresse, et l'hébergeur répond 404.

Le fichier **`_redirects`** n'est pas arrivé dans le dossier publié. Il doit se trouver **à la
racine** du dossier déposé, à côté de `index.html`, et contenir :

```
/*    /index.html   200
```

C'est le fichier qui dit à Cloudflare : « toute adresse inconnue, rends `index.html`, et laisse le
site s'occuper du reste ».

---

## L'API répond, mais le catalogue est vide

Ouvrez `https://votre-api.onrender.com/api/stats`. Si vous lisez `"total":0`, la base est vide : le
site fonctionne, il n'a simplement rien à montrer.

Relancez l'étape 2 **en vérifiant le `--apply`**. Sans lui, les commandes d'import font une
simulation : elles affichent ce qu'elles feraient, se terminent **sans erreur**, et n'écrivent rien.

---

## Render : « Build failed »

| Dans les journaux | Cause |
|---|---|
| `failed to compute cache key… not found` | le **contexte** de construction n'est pas `./app` |
| `Cannot find module` | le chemin du Dockerfile n'est pas `./deploiement/2-api/Dockerfile` |
| la construction part mais le site est ancien | la branche déployée est `main`, qui a 61 commits de retard. Mettre **`feat/refonte-ui`** |

---

## Cloudflare : erreur de syntaxe pendant la construction

Des lignes du type `Unexpected token` ou `SyntaxError` sur du code qui fonctionne chez vous :
Cloudflare construit avec une version de Node trop ancienne.

Ajouter la variable d'environnement **`NODE_VERSION` = `24`** dans les réglages du projet, puis
relancer le déploiement.

---

## PowerShell refuse d'exécuter un script

```
… ne peut pas être chargé car l'exécution de scripts est désactivée sur ce système.
```

C'est la protection par défaut de Windows. Autorisez **la fenêtre en cours seulement** :

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Le réglage disparaît à la fermeture de la fenêtre. Ne le rendez pas permanent.

---

## La base refuse la connexion

| Message | Cause |
|---|---|
| `password authentication failed` | la chaîne a été tronquée à la copie — elle finit par `?sslmode=require` |
| `terminating connection due to administrator command` | la base dormait ; elle se réveille en moins d'une seconde, réessayez |
| `too many connections` | vous n'utilisez pas la chaîne **pooled**, celle dont l'adresse contient `-pooler` |

---

## Rien de tout cela

Arrêtez-vous au **premier « attendu » du guide qui ne correspond pas**, et notez :

1. à quelle étape vous êtes ;
2. ce que vous voyez, mot pour mot ;
3. ce que le guide annonçait.

Ces trois lignes suffisent presque toujours à trouver la cause. Un « ça ne marche pas » à la fin, non.
