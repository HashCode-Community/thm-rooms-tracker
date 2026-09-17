# Image de l'API.
#
# TROIS ETAGES, et le dernier ne contient aucun outil de construction. Une image
# qui embarque TypeScript, Vitest et les 400 Mo de `node_modules` de developpement
# expose une surface qu'elle n'utilise pas et coute a chaque demarrage.
#
# Le monorepo impose l'ordre : `@thm/shared` se construit AVANT l'API. Le paquet
# expose son source sous la condition `development` et son artefact construit par
# defaut — en production, rien ne transpile a la volee. Ce point a deja casse une
# fois.

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
# La version de pnpm vient de `packageManager` dans package.json : corepack la
# lit, personne ne la recopie ici.
RUN corepack enable
WORKDIR /app

# --- Dependances ------------------------------------------------------------
# Les manifestes d'abord, le code ensuite : tant qu'aucun `package.json` ne
# change, cette couche est reutilisee et l'installation n'est pas rejouee.
FROM base AS dependances
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# FILTRE SUR L API, pas sur tout l espace de travail : sans lui, l image
# telecharge la chaine de construction du front — vite, rolldown, ses binaires
# natifs — que l API n execute jamais. Premier essai sans filtre : plus de dix
# minutes, et toujours en cours.
RUN pnpm install --frozen-lockfile --filter @thm/api... --filter @thm/shared...
# Le projet racine reste installe : `typescript` y est declare, et l API se
# construit avec. C est une propriete de l espace de travail, pas de ce fichier —
# le jour ou `tsc` descendra dans les paquets qui s en servent, cette couche
# maigrira d autant.

# --- Construction -----------------------------------------------------------
FROM dependances AS construction
# LES SOUS-DOSSIERS, PAS LE DOSSIER. `COPY packages/shared packages/shared`
# recouvrait le `node_modules` installe a l etage precedent par celui de la
# machine hote — des liens Windows, inutilisables dans l image. Resultat mesure :
# `Cannot find module zod` a la compilation, alors que zod etait bien installe.
COPY packages/shared/src packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/tsconfig.build.json packages/shared/
COPY apps/api/src apps/api/src
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/
RUN pnpm --filter @thm/shared run build \
  && pnpm --filter @thm/api run build

# --- Dependances de production ----------------------------------------------
# Reinstallation sans les outils de developpement. `--frozen-lockfile` garantit
# que ce sont les memes versions que celles qui viennent d'etre construites.
FROM base AS production
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --prod --filter @thm/api...

COPY --from=construction /app/packages/shared/dist packages/shared/dist
COPY --from=construction /app/apps/api/dist apps/api/dist

# L'API ne tourne pas en root.
USER node

# CE PORT ET CET HOTE NE SONT PAS DES DETAILS. Par defaut l'API ecoute sur
# 127.0.0.1, ce qui, dans un conteneur, veut dire « joignable par personne ».
ENV API_HOST=0.0.0.0
ENV API_PORT=3000
EXPOSE 3000

# Le meme repertoire de travail que le script `start`, pour que les chemins
# relatifs se comportent pareil.
WORKDIR /app/apps/api
CMD ["node", "dist/server.js"]
