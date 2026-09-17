# Le dossier de déploiement

**Tout ce qu'il faut pour mettre le site en ligne est ici.** Rien à chercher ailleurs dans le dépôt.

Vous n'avez rien à payer : les trois services utilisés ont un palier gratuit, et le chemin décrit ne
demande aucune carte bancaire.

---

## Par où commencer

**Ouvrez [`guide-complet.md`](guide-complet.md) et suivez-le du début à la fin.** Il est écrit pour
une première fois : chaque étape dit où cliquer, quoi coller, et comment savoir que ça a marché.

Comptez une heure la première fois, dont la moitié à attendre des constructions.

---

## Ce qu'il y a dans ce dossier

| Dossier | Quand vous vous en servez | Ce que c'est |
|---|---|---|
| [`1-base/`](1-base) | étape 2 | `remplir-la-base.ps1` — une commande qui remplit la base avec les 714 rooms, et le SQL pour vérifier |
| [`2-api/`](2-api) | étape 3 | le `Dockerfile` de l'API et les six variables à coller |
| [`3-site/`](3-site) | étape 4 | `preparer-le-site.ps1` — une commande qui construit le site et produit le dossier à déposer |

Et à la racine du dépôt, un fichier qui ne peut pas être ailleurs :

| Fichier | Pourquoi là-bas |
|---|---|
| [`../render.yaml`](../render.yaml) | Render ne cherche ce fichier **qu'à la racine du dépôt**. Rangé ici, il serait invisible |

---

## L'ordre, et pourquoi il ne se change pas

```
1. la base          →  vide, chez Neon
2. la remplir       →  depuis votre ordinateur, 6 commandes
3. l'API            →  chez Render, elle lit la base
4. le site          →  chez Cloudflare, il appelle l'API
5. rebrancher       →  dire à l'API que le site a le droit de l'appeler
```

**Le site et l'API doivent chacun connaître l'adresse de l'autre**, et aucune des deux n'existe avant
d'être déployée. D'où l'étape 5 : elle n'est pas un oubli, c'est l'ordre obligé.

---

## Les trois choses qui font perdre une soirée

1. **La branche.** Partout où un service demande quelle branche déployer, répondez
   **`feat/refonte-ui`**. `main` a 61 commits de retard : vous mettriez en ligne la version d'il y a
   une semaine.
2. **`CORS_ORIGINS` sans barre oblique finale.** `https://mon-site.pages.dev` et non
   `https://mon-site.pages.dev/`. Avec la barre, le site s'affiche mais reste vide, sans message.
3. **Le `--apply` des commandes de l'étape 2.** Sans lui, elles font une simulation, se terminent
   **sans erreur**, et n'écrivent rien.

---

## Si quelque chose casse

[`aide-si-ca-casse.md`](aide-si-ca-casse.md) liste les symptômes les plus probables, leur cause et
le geste qui les corrige.

Et si vous restez bloqué : arrêtez-vous au premier « attendu » du guide qui ne correspond pas, et
dites lequel. C'est bien plus simple à démêler qu'un « ça ne marche pas » à la fin.
