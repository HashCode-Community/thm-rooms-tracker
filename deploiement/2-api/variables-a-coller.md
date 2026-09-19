# Les six variables de l API

A coller dans Render : votre service, onglet **Environment**, puis **Add Environment Variable**.
Une ligne par variable, la cle a gauche, la valeur a droite.

| Cle | Valeur |
|---|---|
| `DATABASE_URL` | votre chaine Neon complete |
| `NODE_ENV` | `production` |
| `API_HOST` | `0.0.0.0` |
| `API_PORT` | `10000` |
| `TRUST_PROXY` | `1` — le NOMBRE d'intermédiaires, jamais `true` |
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
# ici la valeur qu'elles attendent. Chez Render c'est 10000, et le tableau plus
# haut dit la meme chose. Laisser 3000 ici fait echouer le deploiement sur
# « No open ports detected » : Render sonde le port qu'il a impose, l'API ecoute
# ailleurs, et rien dans le message ne dit lequel des deux a tort.
API_PORT=10000

# LE NOMBRE D'INTERMEDIAIRES DEVANT L'APPLICATION. Sur Render : 1.
#
# `true` EST REFUSE PAR L'APPLICATION, et ce n'est pas de la pedanterie : c'est
# la valeur qui a ouvert une faille en production le 2026-09-18. Elle signifie
# « fais confiance a TOUS les sauts », donc l'appelant choisit lui-meme
# l'adresse sur laquelle il est compte. Mesure faite ce jour-la sur le service
# en ligne : trois requetes portant chacune un `X-Forwarded-For` different ont
# obtenu trois compteurs neufs, pendant que le compteur reel continuait de
# descendre. La limite de debit ne limitait personne.
#
# A l'inverse, `0` ou l'absence mettent tous les visiteurs dans un seul seau :
# genant, mais sur. Des deux erreurs, c'est celle qui degrade au lieu d'ouvrir.
TRUST_PROXY=1

# L'origine EXACTE du front, protocole compris, sans barre oblique finale. Sans
# elle, le navigateur refusera tous les appels a l'API depuis un autre domaine.
CORS_ORIGINS=https://thm-roadmap.pages.dev

# --- Reglables --------------------------------------------------------------

RATE_LIMIT_MAX=120
RATE_LIMIT_WINDOW_MS=60000
LOG_LEVEL=info
```
