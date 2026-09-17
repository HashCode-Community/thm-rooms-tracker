# `deploy/` — ce qu'il faut pour mettre en ligne

Le guide est dans [`../docs/deploiement-pas-a-pas.md`](../docs/deploiement-pas-a-pas.md). Ce dossier
ne contient que les fichiers que les plateformes lisent.

| Fichier | Pour qui | Ce qu'il fait |
|---|---|---|
| [`api/Dockerfile`](api/Dockerfile) | Render, Koyeb, Fly, n'importe quel hébergeur d'images | construit l'API en trois étages ; le dernier n'a ni TypeScript ni outil de test |
| [`api/.dockerignore`](api/.dockerignore) | Docker | tient `node_modules`, `.env` et le jeu de données hors du contexte de construction |
| [`cloudflare/_redirects`](cloudflare/_redirects) | Cloudflare Pages | repli de l'application à page unique sur `index.html` |
| [`cloudflare/_headers`](cloudflare/_headers) | Cloudflare Pages | politique de sécurité du front et durées de cache |
| [`render.yaml`](render.yaml) | Render | déclare l'API et le front d'un coup |
| [`.env.production.example`](.env.production.example) | vous | la liste des variables, et **ce qui casse sans chacune** |

## Trois choses à ne pas manquer

1. **`_headers` nomme l'origine de l'API** dans `connect-src`. Tant que `https://api.exemple.fr` y
   figure, le front n'a le droit d'appeler personne — et la page reste vide sans message lisible.
2. **`API_HOST=0.0.0.0`.** La valeur par défaut, `127.0.0.1`, veut dire « joignable par personne »
   dès qu'il y a une couche réseau entre le service et le monde.
3. **La base ne se remplit pas depuis l'image.** Les migrations, le semis et l'import tournent
   depuis votre machine, avec le `DATABASE_URL` de production. C'est voulu : une image qui embarque
   de quoi réécrire sa propre base peut le faire par accident.

## Ce que ces fichiers ne remplacent pas

[`../docs/deploiement.md`](../docs/deploiement.md) dit **ce que l'hébergeur doit poser et que le
code ne peut pas** : en-têtes du front, ligne de requête d'au moins 2 ko, journal persistant. Les
fichiers de ce dossier en sont l'application pour deux plateformes précises ; le document, lui, vaut
pour n'importe laquelle.
