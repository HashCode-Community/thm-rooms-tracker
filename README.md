# 🚩🔍 Scraper de Rooms Gratuites TryHackMe — Roadmap d'équipe

> 🎓 Projet étudiant en cybersécurité — réalisé en équipe.

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

- [ ] Vérifier les conditions d'utilisation (ToS) de TryHackMe
      concernant l'automatisation/le scraping de leur site.
- [ ] Vérifier le fichier `robots.txt` du site (à la date de rédaction
      de cette roadmap, il n'y avait aucune règle `Disallow`, mais cela
      peut changer — à revérifier).
- [ ] Prévoir un rate limiting raisonnable (délai entre requêtes) pour
      ne pas surcharger le service.
- [ ] Utiliser un `User-Agent` identifiable et honnête (pas
      d'usurpation de navigateur dans une intention trompeuse).
- [ ] Ne collecter que des informations publiques déjà visibles sans
      connexion (titre, difficulté, statut gratuit/payant).

## 🧰 Prérequis techniques

- 🐍 Notions de base en programmation (Python recommandé pour son
  écosystème de scraping).
- 💻 Notions de HTML/CSS de base (sélection d'éléments dans une page) et
  idéalement des DevTools navigateur (onglet Réseau).
- 🗄️ Une base de données simple (SQLite suffit).

## 🤝 Équipe & organisation

- 🧭 **Coordinateur (transverse aux 3 projets du groupe) :** Malick Ramzy SOPODOU.
- 🧑‍🤝‍🧑 **Coéquipier·ère dédié·e à ce projet :** Nelkael.
- 🎓 **Mentor :** [nom du mentor] — voir "📊 Suivi & compte-rendu au mentor"
  ci-dessous.

### 🧩 Répartition des rôles proposée (à ajuster ensemble)

| Rôle | Responsabilités principales |
|---|---|
| **🕷️ Scraping & données** | Reconnaissance technique, développement du scraper, pagination, robustesse/erreurs (Phases 2, 5, 9). |
| **🗄️ Modèle de données & restitution** | Schéma DB, classification par niveau, persistance sans doublons, CLI/export/API (Phases 4, 6, 7, 8). |

La Phase 1 (cadrage légal/éthique) et la Phase 10 (documentation) se
font ensemble : ce sont des points d'engagement communs, pas une
tâche d'une seule personne.

## 🛠️ Choix techniques (indicatif, adaptable)

| Besoin | Option recommandée | Alternatives |
|---|---|---|
| Requêtes HTTP simples | `requests` (Python) | `httpx` |
| Parsing HTML | `BeautifulSoup` | `lxml`, `selectolax` |
| Rendu JavaScript (si nécessaire) | `Playwright` | `Selenium` |
| Base de données | SQLite (`SQLModel`/`SQLAlchemy`) | PostgreSQL |
| Planification | cron / tâche planifiée | script manuel au départ |

## ✨ Fonctionnalités attendues

### 🚀 MVP (indispensable)

- [ ] Récupération de la liste des rooms disponibles sur TryHackMe.
- [ ] Filtrage pour ne garder que les rooms **gratuites**.
- [ ] Extraction des champs : titre, lien/slug, difficulté brute, tags
      (si disponibles).
- [ ] Classification en niveaux normalisés, du plus débutant au plus
      expert (ex. `débutant`, `facile`, `intermédiaire`, `avancé`,
      `expert`), à partir de la difficulté brute de THM.
- [ ] Stockage en base de données avec mise à jour (upsert) sans
      doublons.
- [ ] Un moyen simple de consulter le résultat par niveau (CLI, export
      CSV/JSON, ou petite API).

### 🎁 Bonus (si le temps le permet)

- [ ] Historique des changements de difficulté d'une room dans le
      temps.
- [ ] Mini interface web pour parcourir les rooms par niveau.
- [ ] Export vers le projet `veille-cyber-ia` comme source de contenu
      supplémentaire.
- [ ] Suivi du nombre de rooms ajoutées à chaque exécution (statistiques).

## 🗺️ Étapes de réalisation

### 🔸 Phase 1 — Cadrage légal et éthique
- [ ] Valider les points de la section "Prérequis légaux / éthiques"
      ci-dessus avant de coder quoi que ce soit.

### 🔸 Phase 2 — Reconnaissance technique
- [ ] Explorer la page listant les rooms (ex. `/hacktivities`) avec les
      DevTools du navigateur, onglet Réseau.
- [ ] Déterminer si les données sont chargées via une **API interne
      JSON** (souvent le cas sur les sites modernes type Next.js — à
      privilégier, plus stable) ou si elles sont présentes dans le
      **HTML directement**.
- [ ] Identifier les champs exacts disponibles (titre, slug/URL,
      difficulté, statut gratuit, tags, nombre de tâches, etc.).
- [ ] Documenter ces observations (utile pour la suite et pour
      quiconque reprend le projet).

### 🔸 Phase 3 — Setup du projet
- [ ] Initialiser le repo et la structure du projet.
- [ ] Mettre en place la configuration (URL de base, délai entre
      requêtes, user-agent) via variables d'environnement.

### 🔸 Phase 4 — Modèle de données
- [ ] Définir la table `Room` : titre, slug (unique), URL, statut
      gratuit, difficulté brute, niveau normalisé, tags, description,
      date de collecte.

### 🔸 Phase 5 — Développement du scraper
- [ ] Implémenter la récupération des données selon la méthode
      identifiée en Phase 2 (API interne en priorité, sinon parsing
      HTML, sinon rendu JS via Playwright).
- [ ] Gérer la pagination s'il y en a.
- [ ] Filtrer pour ne garder que les rooms gratuites.

### 🔸 Phase 6 — Classification
- [ ] Définir la table de correspondance difficulté brute → niveau
      normalisé.
- [ ] Ajouter des règles complémentaires si nécessaire (ex. utiliser
      les tags pour distinguer "avancé" d'"expert").
- [ ] Valider la classification sur un échantillon de rooms connues.

### 🔸 Phase 7 — Persistance
- [ ] Implémenter l'insertion/mise à jour en base sans dupliquer les
      rooms déjà connues.

### 🔸 Phase 8 — Restitution
- [ ] Fournir un moyen de consulter les résultats (CLI avec filtre par
      niveau, export, ou API minimale).

### 🔸 Phase 9 — Automatisation & robustesse
- [ ] Planifier une exécution périodique.
- [ ] Gérer proprement les erreurs réseau (timeout, code 429 —
      limitation de débit — avec backoff/pause).
- [ ] Journaliser les exécutions (nombre de rooms ajoutées/mises à
      jour, erreurs rencontrées).

### 🔸 Phase 10 — Documentation & remise
- [ ] README complet : installation, configuration, exécution.
- [ ] Documenter les limitations connues (ex. si les sélecteurs doivent
      être ajustés en cas de changement du site).

## ✅ Définition de "terminé" (Definition of Done)

- ✅ Le scraper récupère uniquement des rooms gratuites.
- ✅ Chaque room est associée à un niveau cohérent, du plus débutant au
  plus expert.
- ✅ Une exécution répétée ne crée pas de doublons.
- ✅ Il est possible d'obtenir facilement "la liste des rooms gratuites
  niveau débutant" en une commande/requête.

## 🔀 Workflow Git & collaboration

- 📦 Un repo GitHub dédié à ce projet, avec vous deux comme
  collaborateurs.
- 🌿 `main` reste toujours stable ; le travail se fait sur des branches
  `feature/nom-court` (ex. `feature/classification-niveaux`).
- 🔍 Une Pull Request par fonctionnalité ou par phase, relue par l'autre
  avant merge — particulièrement important ici pour vérifier ensemble
  le respect des règles légales/éthiques (rate limiting, user-agent,
  données publiques uniquement).
- 📋 Idéalement, chaque tâche de la roadmap devient une Issue GitHub ; la
  PR qui la résout la référence (`Closes #12`).
- 📝 Messages de commit clairs (ex. `feat: ajoute la classification par
  niveau`, `fix: gère le code 429 avec backoff`).

## 📊 Suivi & compte-rendu au mentor

À mettre à jour régulièrement (ex. avant chaque point avec le mentor) :

| Date | Fait | En cours | Bloquants | Prochaine étape |
|---|---|---|---|---|
| | | | | |

## 🌱 Pistes d'évolution futures

- 🧭 Suggestions de parcours ("path" débutant → expert basé sur les rooms
  collectées).
- 🔗 Intégration avec le blog (article "par où commencer" pointant vers
  les rooms classées).
- 🔔 Alertes sur les nouvelles rooms gratuites ajoutées.
