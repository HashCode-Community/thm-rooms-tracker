# ADR-0005 — Thème sombre unique, et le contraste devient un garde

- **Statut** : accepté
- **Date** : 2026-09-15
- **Décideur** : Nelkaël
- **Amende** : la décision de la phase 8b sur le déclenchement de l'avertissement de persistance

---

## Règle de tenue de ce dossier

Posée par Nel le 2026-09-15, elle vaut pour tous les ADR à venir.

> Élargir le périmètre en cours de commit est autorisé quand c'est un défaut de la même
> classe découvert par le travail lui-même. Mais **toute décision validée qui se trouve
> remplacée doit être inscrite comme amendement daté**, nommant la décision remplacée et la
> raison. Pas dans le rapport de commit — ici. Une dérive non écrite est indétectable à trois
> semaines.

Le premier amendement de ce type est en fin de document.

## Q1 — Un seul thème, sombre, sans sélecteur

**Décision.** `color-scheme: dark`. `prefers-color-scheme: light` n'est **pas** géré.

Le brief §7 et la passation §8 listaient « mode sombre » dans *peut attendre*. Cette ligne
visait une **bascule** clair/sombre, c'est-à-dire une préférence utilisateur à stocker et deux
palettes à tenir. Ce qui est livré ici est autre chose : un thème unique, qui est l'apparence
du produit. L'instruction est de Nel, session du 2026-09-14 à 19:33 UTC, sous l'intitulé
« Direction arbitrée » : « Sombre par défaut, c'est l'attente du genre. »

**Pas de demi-support.** Soit `prefers-color-scheme: light` est traité entièrement, soit il ne
l'est pas. Un clair à moitié fait est pire que pas de clair : il produit des pages où certaines
surfaces ont basculé et pas les autres, c'est-à-dire du texte invisible. Le coût réel du support
complet n'est pas la palette, c'est la **matrice de contraste qui double** — 32 paires à
vérifier deviennent 64, et chacune doit être tenue à chaque changement.

Inscrit à ce titre dans [la dette](../dette-phase-10.md), avec son déclencheur.

## Q2 — Les couleurs ont une structure, la structure précède les valeurs

Une liste plate d'hexadécimaux est la façon normale de produire une interface incohérente : rien
n'empêche d'ajouter un dix-huitième gris parce qu'aucun des dix-sept ne convenait tout à fait.
Le groupe est donc déclaré **avant** la valeur, et une couleur qui n'appartient à aucun groupe
n'entre pas.

| Groupe | Nombre | Tokens |
|---|---:|---|
| Fonds | 3 | `--fond`, `--fond-doux`, `--fond-appuye` |
| Bordures | 2 | `--bord`, `--bord-fort` |
| Textes | 3 | `--texte`, `--texte-doux`, `--texte-eteint` |
| Accent | 3 | `--lien`, `--lien-survol`, `--lien-visite` |
| Difficulté | 5 | `--diff-info` … `--diff-insane` |
| États | 4 | `--succes`, `--alerte`, `--erreur`, `--focus` |
| Surfaces d'état | 3 | `--succes-fond`, `--alerte-fond`, `--erreur-fond` |
| **Total** | **23** | |

**Deux écarts avec le découpage proposé (19 tokens), assumés :**

- **Accent à 3 et non 2.** « Visité » n'est pas un survol : c'est un état persistant du lien.
  Le produit est un catalogue de 714 rooms qu'on explore sur plusieurs sessions ; sans cet état,
  l'utilisateur doit se souvenir de ce qu'il a déjà ouvert.
- **Trois surfaces d'état en plus.** Un bandeau a besoin d'un fond **et** d'une couleur. Les
  dériver à l'exécution avec `color-mix()` supprimerait trois tokens et les rendrait **invisibles
  au contrôleur de contraste**, qui lit des valeurs déclarées. Un garde qu'on contourne pour
  gagner trois lignes n'est plus un garde. Le focus n'a pas de surface : c'est un anneau.

**Ni noir pur ni blanc pur.** `--fond: #0f1115`, `--texte: #e6e8eb`, soit 15,4:1. `#000` sous
`#fff` produit du halo sur les écrans OLED et fatigue à la lecture longue : le contraste maximal
n'est pas le plus lisible.

## Q3 — La difficulté ne passe jamais par la seule couleur

Cinq niveaux distingués par la teinte seule excluent environ 8 % des hommes. Trois garanties, et
les deux dernières sont vérifiées par machine :

1. **Le libellé textuel est toujours présent.** `badges.tsx` rend `difficulty.label`, jamais une
   pastille nue.
2. **Les cinq couleurs sont séparées d'au moins 8 en clarté perçue** (L\* de CIELAB), qui est la
   grandeur que préserve un rendu en niveaux de gris. Mesure : 94,1 / 85,0 / 75,9 / 67,2 / 58,0,
   écart minimal 8,7. L'échelle est **monotone** — du plus clair au plus sombre suit l'ordre de
   difficulté — donc en niveaux de gris elle reste une échelle, pas cinq taches.
3. **La couleur est portée par le texte et la bordure, sur un fond commun**, plus jamais par un
   aplat. Cinq aplats saturés côte à côte en thème sombre deviennent cinq taches, et le libellé
   y perd en lisibilité exactement là où il compte.

## Q4 — Le contraste est mesuré, jamais affirmé

L'en-tête de `styles.css` annonçait « contrastes vérifiés au ratio WCAG » avec trois chiffres.
Personne ne pouvait dire quand, ni sur quelles paires, ni ce qui se passait quand une couleur
changeait. C'était une affirmation, pas un garde.

`apps/web/scripts/verifie-contrastes.ts`, branché sur `pnpm lint` et sur `pnpm contrast`, sort en
code 1 sous le seuil. Seuils : **4,5:1** pour le texte, **3:1** pour le texte large et les
bordures porteuses de sens.

Il fait trois choses, et la troisième est celle qui en fait un garde :

1. il mesure les **32 paires déclarées**, plus les 4 couleurs d'équipe servies par l'API — une
   couleur qui vient de la base reste une couleur affichée ;
2. il vérifie la séparation en niveaux de gris des cinq difficultés ;
3. il vérifie que **tout token employé** comme `color:` ou comme fond dans la feuille apparaît
   dans au moins une paire mesurée. Sans ce troisième contrôle, la liste des paires serait une
   liste qu'on oublie de mettre à jour — exactement le défaut corrigé par [ADR-0004](0004-badge-affichage-regle.md),
   sous une autre forme.

**Prouvé en le faisant échouer**, trois fois : un texte secondaire assombri d'un cran (3 paires
tombent), deux difficultés ramenées à la même clarté (écart 0,2), un token neuf employé sans être
déclaré. Un garde dont on n'a pas prouvé qu'il peut échouer n'est pas un garde.

### Ce que ce contrôleur ne couvre pas

Il lit des **tokens déclarés**, pas le rendu. Une couleur écrite en dur dans un composant, ou une
superposition d'opacités, lui échappe. Le contrôle 3 réduit la première faille sans la fermer :
il ne voit que les déclarations `var(--token)` de la feuille. Un contrôle sur le rendu réel
demanderait un navigateur, donc la phase 10 et la CI.

## Amendement daté

### 2026-09-15 — L'avertissement de persistance part au chargement, plus à la première mutation

**Décision remplacée** : phase 8b, validée le 2026-09-14. Le magasin de progression naissait avec
`warning: null` quelle que soit la lecture, au motif écrit dans le code qu'« aucun avertissement
tant que l'utilisateur n'a rien tenté : une valeur illisible qu'il ne cherche pas à modifier ne
lui coûte rien ».

**Raison du remplacement.** Le motif était faux dans les deux cas où il s'appliquait, et la mesure
l'a montré. La page affiche « Aucune room terminée pour l'instant » :

- quand une progression **existe mais est illisible** — l'écran affirme alors le contraire de ce
  qui est stocké ;
- quand le stockage est **saturé et la clé jamais écrite** — `readKind` vaut `absent`, ce qui est
  exact à la lettre, et rien de ce que l'utilisateur fera ensuite ne sera conservé.

Dans les deux cas l'utilisateur investit ses clics avant d'apprendre qu'ils ne comptent pas.
Une lecture ne peut pas distinguer « rien n'a été enregistré » de « rien n'a **pu** l'être » :
les deux laissent la clé absente. Seule une écriture tranche, d'où la sonde de démarrage.

**Portée.** La décision 8b visait un avertissement qui ne ment pas ; le déclencheur est élargi, la
règle ne change pas. Ce qui reste intact : la lecture ne répare jamais, l'écriture n'écrase jamais
une valeur illisible, et chaque mutation retente.

Commit `e8d6d95`.
