# Ce que la licence couvre, et ce qu'elle ne couvre pas

Le dépôt est publié sous **licence MIT** ([`LICENSE`](LICENSE)). Le texte de la licence n'est pas
modifié : une licence MIT amendée n'est plus une licence MIT, et les outils qui la détectent ne la
reconnaissent plus.

## Couvert par la licence MIT

- le code : `app/apps/api`, `app/apps/web`, `app/packages/shared`, les scripts ;
- le **contenu éditorial des parcours** — `app/data/roadmap/tracks/*.yaml` — écrit et relu à la
  main par l'équipe. L'ordre des étapes, les objectifs et les notes sont un travail d'auteur, pas
  une donnée extraite ;
- la documentation et les décisions d'architecture (`app/docs`).

## Non couvert, et pourquoi

### Les métadonnées TryHackMe

`app/data/datasets/rooms.v1.json` décrit des rooms publiées par **TryHackMe** : titres, durées,
difficultés, nombre de participants. Ces informations appartiennent à TryHackMe et à ses auteurs.
Ce dépôt les affiche, il ne les licencie pas, et **aucun contenu de room n'y est reproduit** —
seulement des métadonnées publiques et un lien vers la room.

Ce projet est **indépendant et non affilié à TryHackMe**.

### Les polices

`app/apps/web/public/fonts/` embarque **Inter** et **Space Grotesk**, publiées sous **SIL Open Font
License 1.1**. Leur licence est reproduite à côté d'elles, dans
[`app/apps/web/public/fonts/OFL.txt`](app/apps/web/public/fonts/OFL.txt). La licence MIT de ce dépôt
ne s'y applique pas.

### Les dépendances

Chaque dépendance reste sous sa propre licence. `pnpm licenses list` en donne l'inventaire.
