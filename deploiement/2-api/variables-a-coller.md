# Les six variables de l API

A coller dans Render : votre service, onglet **Environment**, puis **Add Environment Variable**.
Une ligne par variable, la cle a gauche, la valeur a droite.

| Cle | Valeur |
|---|---|
| `DATABASE_URL` | votre chaine Neon complete |
| `NODE_ENV` | `production` |
| `API_HOST` | `0.0.0.0` |
| `API_PORT` | `10000` |
| `TRUST_PROXY` | `true` |
| `CORS_ORIGINS` | l adresse du site, **sans barre oblique finale** |

**Aucune n est la par habitude.** Le detail de ce que chacune evite est en commentaire ci-dessous,
dans le format d un fichier `.env` — c est celui que la plupart des plateformes acceptent en
copier-coller groupe.

```dotenv
# Variables de l'API en production.
#
# A REPORTER DANS L'INTERFACE DE L'HEBERGEUR, pas dans un fichier versionne. Ce
# fichier-ci est un modele : il ne contient aucune valeur reelle, et ne doit
# jamais en contenir.
#
# Le front n'a AUCUN secret : tout ce qui y est embarque est lisible par
# n'importe quel visiteur. S'il faut un jour une variable cote front, elle sera
# publique par construction.

# --- Obligatoires -----------------------------------------------------------

# Sans elle, l'API ne demarre pas. Chez Neon, prendre la chaine « pooled »
# (celle qui contient `-pooler`) : elle supporte les connexions courtes et
# nombreuses d'un service qui se rendort.
DATABASE_URL=postgresql://utilisateur:motdepasse@hote/base?sslmode=require

# DOIT VALOIR production. Sinon /docs publie la surface d'API complete, et le
# detail technique des erreurs 500 part dans les reponses.
NODE_ENV=production

# --- A adapter a la plateforme ----------------------------------------------

# 0.0.0.0 dans un conteneur. La valeur par defaut, 127.0.0.1, veut dire
# « joignable par personne » des qu'il y a une couche reseau entre le service et
# le monde.
API_HOST=0.0.0.0
# La plupart des plateformes imposent le port par la variable PORT : reporter
# ici la valeur qu'elles attendent.
API_PORT=3000

# AUCUNE VALEUR PAR DEFAUT N'EST SURE. A `false` derriere un proxy, toutes les
# requetes semblent venir de la meme adresse et la limite de debit devient une
# limite globale. A `true` sans proxy, n'importe qui peut usurper son adresse
# via `x-forwarded-for` et contourner cette limite. Voir docs/deploiement.md.
TRUST_PROXY=true

# L'origine EXACTE du front, protocole compris, sans barre oblique finale. Sans
# elle, le navigateur refusera tous les appels a l'API depuis un autre domaine.
CORS_ORIGINS=https://thm-roadmap.pages.dev

# --- Reglables --------------------------------------------------------------

RATE_LIMIT_MAX=120
RATE_LIMIT_WINDOW_MS=60000
LOG_LEVEL=info
```
