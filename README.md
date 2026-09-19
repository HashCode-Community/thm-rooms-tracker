# 🚩🔍 Scraper de Rooms Gratuites TryHackMe — Roadmap d'équipe

> 🎓 Projet étudiant en cybersécurité — réalisé en équipe.
>
> 📌 **Document mis à jour le 12 septembre 2026.** La roadmap d'origine (cadrage initial de Malick) est
> conservée à l'identique ; les cases cochées, les statuts et les sections marquées 🆕 reflètent
> l'avancement réel. Les écarts par rapport au cadrage initial sont listés et justifiés
> en section « ⚖️ Écarts assumés ».

## 📈 Avancement en un coup d'œil 🆕

| Indicateur | Valeur |
|---|---|
| Rooms au catalogue TryHackMe | 1 321 |
| **Rooms gratuites collectées** | **714** |
| Phases terminées | **7 sur 10** (voir statuts ci-dessous) |
| Base de données | 15 tables, 296 tags, opérationnelle |
| Restitution | API documentée + site web avec recherche à facettes |
| Parcours d'apprentissage rédigés | 3 (61 rooms) — *initialement prévu en « pistes futures »* |
| Tests automatisés | 168 |

---

## 🎯 Objectif

Construire un système qui collecte automatiquement les rooms
**gratuites** de la plateforme TryHackMe, les stocke dans une base de
données, et les classe par niveau — du plus débutant au plus expert —
afin d'aider les nouveaux arrivants sur la plateforme à savoir par où
commencer.

## 👥 Public cible

- 🆕 Nouveaux utilisateurs de TryHackMe cherchant un parcours progressif
  parmi le contenu gratuit.
- 🔭 L'auteur, comme outil de veille sur le contenu disponible.

## ⚠️ Prérequis légaux / éthiques (à traiter avant tout développement)

> ⚠️ **Transparence : ces vérifications ont été menées le 12 septembre 2026, donc APRÈS
> la première extraction de données (10 septembre) et non avant, contrairement à la consigne.**
> C'est un manquement de notre part au processus. Aucune de ces vérifications n'a révélé de
> problème, mais l'ordre n'a pas été respecté et nous le signalons plutôt que de le masquer.

- [x] Vérifier les conditions d'utilisation (ToS) de TryHackMe
      concernant l'automatisation/le scraping de leur site.
      → *Relecture effectuée le 12/09/2026. Décision retenue : republier uniquement les
      métadonnées publiques (titre, difficulté, durée, tags, lien), jamais le contenu
      pédagogique des rooms ; attribution visible et lien sortant vers chaque room d'origine ;
      page de mentions précisant l'absence d'affiliation avec TryHackMe.*
- [x] Vérifier le fichier `robots.txt` du site (à la date de rédaction
      de cette roadmap, il n'y avait aucune règle `Disallow`, mais cela
      peut changer — à revérifier).
      → *Vérifié le 12/09/2026 : bloc `User-agent: *` suivi de `Allow: /`.
      **Aucune règle `Disallow`, aucun `Crawl-delay`.** Sitemap déclaré.
      À revérifier à chaque reprise du projet.*
- [ ] Prévoir un rate limiting raisonnable (délai entre requêtes) pour
      ne pas surcharger le service.
      → *À implémenter dans le scraper (Malick, phase 9). Valeur retenue : 1 requête/seconde
      minimum, avec pause exponentielle sur code 429.*
- [ ] Utiliser un `User-Agent` identifiable et honnête (pas
      d'usurpation de navigateur dans une intention trompeuse).
      → *À implémenter dans le scraper (Malick, phase 3). Format retenu :
      `thm-rooms-tracker/1.0 (projet étudiant; contact: <email>)`.*
- [x] Ne collecter que des informations publiques déjà visibles sans
      connexion (titre, difficulté, statut gratuit/payant).
      → *Vérifié le 12/09/2026 : l'API interne répond en **HTTP 200 sans aucun cookie de
      session** (requête émise avec `credentials: 'omit'`). Les données collectées sont
      donc publiques. Aucune donnée d'utilisateur, aucun contenu de room n'est collecté.*

## 🧰 Prérequis techniques

- 🐍 Notions de base en programmation (Python recommandé pour son
  écosystème de scraping).
- 💻 Notions de HTML/CSS de base (sélection d'éléments dans une page) et
  idéalement des DevTools navigateur (onglet Réseau).
- 🗄️ Une base de données simple (SQLite suffit).

## 🤝 Équipe & organisation

- 🧭 **Coordinateur (transverse aux 3 projets du groupe) :** Malick Ramzy SOPODOU.
- 🧑‍🤝‍🧑 **Coéquipier·ère dédié·e à ce projet :** Nelkael.

### 🧩 Répartition des rôles proposée (à ajuster ensemble)

| Rôle | Responsabilités principales | Titulaire | État 🆕 |
|---|---|---|---|
| **🕷️ Scraping & données** | Reconnaissance technique, développement du scraper, pagination, robustesse/erreurs (Phases 2, 5, 9). | Malick | Phase 2 faite · phases 5 et 9 à démarrer |
| **🗄️ Modèle de données & restitution** | Schéma DB, classification par niveau, persistance sans doublons, CLI/export/API (Phases 4, 6, 7, 8). | Nelkael | Phases 4, 7, 8 faites · phase 6 partielle |

La Phase 1 (cadrage légal/éthique) et la Phase 10 (documentation) se
font ensemble : ce sont des points d'engagement communs, pas une
tâche d'une seule personne.

> 🆕 **Point d'organisation à trancher ensemble.** Une extraction ponctuelle des 714 rooms
> a été réalisée pour débloquer le travail sur la base de données et la restitution, qui étaient
> bloqués sans jeu de données. **Cette extraction ne remplace pas le scraper de la phase 5** :
> le scraper automatisé, reproductible et respectueux du rate limiting reste à écrire, et c'est
> la responsabilité de Malick. Un contrat de données (`docs/data-contract.md`) a été rédigé côté
> restitution pour spécifier précisément le format que le scraper doit produire ; il est à ce
> jour **une proposition non ratifiée**, en attente de la relecture de Malick.

## 🛠️ Choix techniques (indicatif, adaptable)

| Besoin | Option recommandée | Retenu 🆕 | Raison de l'écart |
|---|---|---|---|
| Requêtes HTTP simples | `requests` (Python) | `requests` | — |
| Parsing HTML | `BeautifulSoup` | *non nécessaire* | API interne JSON identifiée en phase 2 : pas de HTML à parser, source plus stable |
| Rendu JavaScript (si nécessaire) | `Playwright` | *non nécessaire* | idem |
| Base de données | SQLite (`SQLModel`/`SQLAlchemy`) | **PostgreSQL 16** | voir « Écarts assumés » |
| Planification | cron / tâche planifiée | cron quotidien | rythme de publication mesuré : ≈ 13 rooms/mois |

## ⚖️ Écarts assumés par rapport au cadrage initial 🆕

Trois écarts, chacun assumé et justifié. Aucun n'a été décidé pour le plaisir de la technique.

**1. PostgreSQL au lieu de SQLite.** SQLite aurait suffi pour un catalogue de 714 lignes en
lecture seule. Il ne suffit plus dès qu'on ajoute la progression d'un utilisateur et les
parcours d'apprentissage, qui sont relationnels par nature (un parcours contient des étapes
ordonnées, une étape contient des rooms ordonnées, une room peut appartenir à plusieurs
parcours). PostgreSQL apporte aussi la recherche plein texte native, ce qui évite d'ajouter
un moteur de recherche externe. **L'écart est justifié par la fonctionnalité, pas par le volume.**

**2. Un site web au lieu d'une CLI.** Le cadrage demandait « CLI, export CSV/JSON, ou petite API ».
L'API existe et est documentée ; l'export CSV existe aussi. Le site web est venu par-dessus,
parce que le public cible — un débutant qui ne sait pas par où commencer — ne va pas installer
Python pour consulter une liste. **La CLI aurait rempli le contrat sans servir le public visé.**

**3. Les parcours d'apprentissage, livrés en avance.** Le cadrage les place en « pistes
d'évolution futures ». Nous les avons rédigés maintenant, parce que c'est la seule partie du
projet qui ne se déduit d'aucune donnée : TryHackMe **ne publie aucun prérequis entre rooms**.
Sans ce travail éditorial, le produit reste une liste triée, pas un parcours — c'est-à-dire
qu'il ne répond pas à l'objectif écrit en tête de ce document.

## ✨ Fonctionnalités attendues

### 🚀 MVP (indispensable)

- [x] Récupération de la liste des rooms disponibles sur TryHackMe.
      → *1 321 rooms parcourues via l'API interne.*
- [x] Filtrage pour ne garder que les rooms **gratuites**.
      → *714 rooms retenues sur le champ `freeToUse`.*
- [x] Extraction des champs : titre, lien/slug, difficulté brute, tags
      (si disponibles).
      → *Champs collectés : code, titre, description, difficulté, type, durée, nombre de
      participants, date de publication, orientation d'équipe, compétences, technologies, outils.*
- [ ] Classification en niveaux normalisés, du plus débutant au plus
      expert (ex. `débutant`, `facile`, `intermédiaire`, `avancé`,
      `expert`), à partir de la difficulté brute de THM.
      → 🆕 **Partiellement fait.** La difficulté brute est stockée avec un rang numérique
      permettant le tri. Le libellé normalisé français reste à ajouter. Correspondance retenue,
      à valider ensemble :
      `info → débutant` · `easy → facile` · `medium → intermédiaire` · `hard → avancé` ·
      `insane → expert`.
- [x] Stockage en base de données avec mise à jour (upsert) sans
      doublons.
      → *Import idempotent : une seconde exécution consécutive produit zéro modification.
      Clé d'unicité : le code TryHackMe, jamais le titre (3 rooms distinctes portent un
      titre identique). Une room disparue est désactivée, jamais supprimée.*
- [x] Un moyen simple de consulter le résultat par niveau (CLI, export
      CSV/JSON, ou petite API).
      → *API documentée (OpenAPI) + export CSV + site web avec filtres croisés.*

### 🎁 Bonus (si le temps le permet)

- [ ] Historique des changements de difficulté d'une room dans le
      temps.
      → *La donnée source complète est conservée à chaque import, ce qui rendra cet
      historique reconstituable.*
- [x] Mini interface web pour parcourir les rooms par niveau.
      → *Livré : recherche plein texte, filtres croisés par difficulté, type, équipe,
      technologie, outil et compétence, tri, pagination, fiche détaillée par room.*
- [ ] Export vers le projet `veille-cyber-ia` comme source de contenu
      supplémentaire.
- [x] Suivi du nombre de rooms ajoutées à chaque exécution (statistiques).
      → *Table `import_runs` : rooms ajoutées, modifiées, désactivées, anomalies, durée,
      empreinte du jeu de données. Le journal survit à un échec d'import.*

## 🗺️ Étapes de réalisation

### ✅ Phase 1 — Cadrage légal et éthique — *partiellement fait*
- [x] Valider les points de la section "Prérequis légaux / éthiques"
      ci-dessus avant de coder quoi que ce soit.
      → 🆕 3 points sur 5 vérifiés. Les 2 restants (rate limiting, User-Agent) sont des
      éléments du scraper et seront traités en phases 3 et 9. **Vérifications menées après
      le début du développement : écart de processus signalé en tête de section.**

### ✅ Phase 2 — Reconnaissance technique — *terminée*
- [x] Explorer la page listant les rooms (ex. `/hacktivities`) avec les
      DevTools du navigateur, onglet Réseau.
- [x] Déterminer si les données sont chargées via une **API interne
      JSON** ou si elles sont présentes dans le **HTML directement**.
      → 🆕 **API interne JSON confirmée** : `/api/v2/hacktivities/extended-search`.
      Pas de parsing HTML nécessaire, pas de rendu JavaScript nécessaire.
- [x] Identifier les champs exacts disponibles.
      → *14 champs exploitables documentés dans `docs/data-contract.md`.*
- [x] Documenter ces observations.
      → 🆕 **Limite identifiée à documenter** : le compteur de l'API annonce 1 351 rooms,
      la pagination n'en restitue que 1 321, quelle que soit la stratégie de tri.
      30 rooms restent inaccessibles.

### 🔸 Phase 3 — Setup du projet — *fait côté restitution, à faire côté scraper*
- [x] Initialiser le repo et la structure du projet.
- [ ] Mettre en place la configuration (URL de base, délai entre
      requêtes, user-agent) via variables d'environnement.
      → *Responsabilité Malick. C'est ici que se règlent 2 des 5 points de la phase 1.*

### ✅ Phase 4 — Modèle de données — *terminée*
- [x] Définir la table `Room` : titre, slug (unique), URL, statut
      gratuit, difficulté brute, niveau normalisé, tags, description,
      date de collecte.
      → 🆕 Élargi à **15 tables** : référentiels (difficultés, types, équipes), catalogue
      (rooms, tags, liaisons), catégorisation, parcours, progression utilisateur, journal
      d'imports. La donnée source brute est conservée pour permettre de rejouer toute
      transformation.

### 🔸 Phase 5 — Développement du scraper — *extraction faite, scraper à écrire*
- [x] Implémenter la récupération des données selon la méthode
      identifiée en Phase 2.
      → *Extraction ponctuelle réalisée : 714 rooms, intégrité vérifiée par empreinte SHA-256.*
- [x] Gérer la pagination s'il y en a.
      → *Pagination confirmée nécessaire. Trois stratégies de tri croisées ont été employées
      pour combler les trous de pagination de l'API.*
- [x] Filtrer pour ne garder que les rooms gratuites.
- [ ] 🆕 **Industrialiser** : transformer l'extraction ponctuelle en scraper reproductible,
      configurable, avec rate limiting et User-Agent identifiable. **Responsabilité Malick.**

### 🔸 Phase 6 — Classification — *partiellement faite*
- [ ] Définir la table de correspondance difficulté brute → niveau
      normalisé.
      → *Correspondance proposée ci-dessus, à valider ensemble puis à implémenter.*
- [ ] Ajouter des règles complémentaires si nécessaire (ex. utiliser
      les tags pour distinguer "avancé" d'"expert").
      → *Non nécessaire : TryHackMe fournit déjà 5 niveaux distincts qui se transposent
      un pour un.*
- [ ] Valider la classification sur un échantillon de rooms connues.

### ✅ Phase 7 — Persistance — *terminée*
- [x] Implémenter l'insertion/mise à jour en base sans dupliquer les
      rooms déjà connues.
      → 🆕 Garde-fou ajouté : un import qui désactiverait plus de 5 % du catalogue refuse
      de s'exécuter. Un scraper défaillant ne peut pas vider la base.

### ✅ Phase 8 — Restitution — *terminée*
- [x] Fournir un moyen de consulter les résultats.
      → *API documentée, export CSV, site web. 10 points d'entrée d'API.*

### 🔸 Phase 9 — Automatisation & robustesse — *à faire*
- [ ] Planifier une exécution périodique.
      → *Rythme mesuré : ≈ 13 nouvelles rooms par mois. Une exécution quotidienne suffit
      largement ; le temps réel serait inutile et impoli envers le service.*
- [ ] Gérer proprement les erreurs réseau (timeout, code 429 avec backoff/pause).
- [ ] Journaliser les exécutions.
      → *Côté base, déjà fait (`import_runs`). Reste la journalisation côté scraper.*

### 🔸 Phase 10 — Documentation & remise — *en cours*
- [ ] README complet : installation, configuration, exécution.
- [x] Documenter les limitations connues.
      → *Limites documentées : 30 rooms inaccessibles via l'API ; 164 rooms sans technologie
      et 85 sans compétence renseignées côté TryHackMe ; date de publication non fiable
      (elle reflète des republications) ; offre gratuite fragmentée — certaines séries
      n'ont que leur premier épisode en accès libre.*

## ✅ Définition de "terminé" (Definition of Done)

- ✅ Le scraper récupère uniquement des rooms gratuites. — **atteint**
- ⏳ Chaque room est associée à un niveau cohérent, du plus débutant au
  plus expert. — *difficulté brute et rang de tri en place ; libellé normalisé français à ajouter*
- ✅ Une exécution répétée ne crée pas de doublons. — **atteint et testé**
- ✅ Il est possible d'obtenir facilement "la liste des rooms gratuites
  niveau débutant" en une commande/requête. — **atteint** (API, export CSV, filtre web)

## 🔀 Workflow Git & collaboration

- 📦 Un repo GitHub dédié à ce projet, avec vous deux comme
  collaborateurs.
- 🌿 `main` reste toujours stable ; le travail se fait sur des branches
  `feature/nom-court`.
- 🔍 Une Pull Request par fonctionnalité ou par phase, relue par l'autre
  avant merge.
- 📋 Idéalement, chaque tâche de la roadmap devient une Issue GitHub.
- 📝 Messages de commit clairs.

> 🆕 **Écart à régulariser.** Le travail de restitution a été mené dans un dépôt local séparé,
> sans PR croisée. Ce n'est pas conforme au workflow ci-dessus et ça doit être corrigé avant
> d'aller plus loin. Décision à prendre ensemble : soit tout remonter dans ce dépôt sous forme
> de deux dossiers (`scraper/` et `app/`), soit assumer deux dépôts avec le contrat de données
> comme unique interface. **Notre recommandation : un seul dépôt**, conforme au cadrage, et qui
> rend les PR croisées possibles — c'est justement sur les questions légales et éthiques que le
> cadrage initial demande une relecture mutuelle.

## 📊 Suivi & compte-rendu

| Date | Fait | En cours | Bloquants | Prochaine étape |
|---|---|---|---|---|
| 10/09/2026 | Reconnaissance technique (phase 2) : API interne JSON identifiée, champs documentés. Extraction de 1 321 rooms, dont 714 gratuites, intégrité vérifiée. | — | Aucun | Modèle de données |
| 11/09/2026 | Modèle de données (phase 4) : 15 tables, migrations, index de recherche. Persistance (phase 7) : import idempotent avec garde-fou anti-vidage. | — | Aucun | API de restitution |
| 12/09/2026 | Restitution (phase 8) : API documentée + site web avec recherche à facettes. Rédaction de 3 parcours d'apprentissage (61 rooms). Cadrage légal (phase 1) : 3 points sur 5 vérifiés. | Intégration des parcours | **Rôle scraping non démarré** : le scraper automatisé de la phase 5 reste à écrire. **Workflow Git non conforme** : deux dépôts séparés, aucune PR croisée. | Trancher le dépôt unique · démarrer le scraper (Malick) · ajouter le niveau normalisé français |
| 13/09/2026 | **Intégration des parcours terminée** : 3 parcours en base, 22 étapes, 62 rooms recommandées dont 53 sur le chemin principal. Le contrat de provenance de chaque parcours est devenu strict — une clé inconnue est refusée au lieu d'être ignorée en silence. **Dépôt unique tranché et appliqué** : la plateforme est remontée sous `app/`, `scraper/` reste libre. 168 tests verts. | Relecture de la PR par Malick | **Rôle scraping non démarré**, inchangé. `docs/data-contract.md` toujours en attente de ratification. | Relire et fusionner la PR · démarrer le scraper (Malick) · ajouter le niveau normalisé français |

## 🌱 Pistes d'évolution futures

- 🧭 ~~Suggestions de parcours ("path" débutant → expert basé sur les rooms collectées).~~
  → 🆕 **Livré en avance.** 3 parcours rédigés : Fondamentaux (7 étapes, ≈ 10 h),
  Red Team débutant (7 étapes, ≈ 16 h), Blue Team débutant (8 étapes, ≈ 14 h).
  Méthode de sélection documentée. **Limite affichée publiquement : ces parcours n'ont pas
  encore été intégralement suivis par l'équipe** ; chaque parcours porte un indicateur de
  validation qui basculera au fur et à mesure que nous les ferons nous-mêmes.
- 🔗 Intégration avec le blog (article "par où commencer" pointant vers
  les rooms classées).
- 🔔 Alertes sur les nouvelles rooms gratuites ajoutées.
  → *Mécanisme déjà en place : la comparaison des codes entre deux exécutions détecte les
  nouveautés. La date de publication fournie par TryHackMe n'est pas exploitable pour ça.*

---

## 📎 Annexe technique 🆕

Un document séparé détaille l'architecture, le modèle de données, les décisions techniques
et leurs alternatives écartées, les anomalies de données traitées, et les défauts identifiés
avant mise en production : **`ROADMAP-PROJET.pdf`** (10 pages).
