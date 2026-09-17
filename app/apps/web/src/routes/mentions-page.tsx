import { createRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTitre } from "../titre.js";

/**
 * Mentions.
 *
 * REGLE DE CETTE PAGE : elle n'affirme que ce qui est verifiable dans le code ou
 * dans les données, et chaque affirmation qui engage est tenue par un test.
 * `apps/api/tests/api/promesses.test.ts` fait tomber la construction si l'API
 * cesse d'etre en lecture seule, ou si une adresse IP revient dans les journaux.
 * Une page de mentions que personne ne relit vieillit en mensonge ; celle-ci ne
 * peut pas vieillir sans que quelque chose casse.
 *
 * CE QUI N'Y EST TOUJOURS PAS : l'HEBERGEUR. Il ne se deduit ni du code ni des
 * données, et il n'existera qu'une fois le site en ligne. Mieux vaut une ligne
 * absente qu'une ligne remplie au hasard — celle-la est due le jour du premier
 * deploiement public.
 *
 * La licence, l'editeur et le contact, eux, sont arrives le 2026-09-17.
 */

/** Extrait de `data/datasets/rooms.v1.json`, section `meta`. */
const DATASET = {
  version: "1.0.0",
  extraitLe: "2026-09-10",
  roomsGratuites: 714,
  roomsAuCatalogue: 1321,
} as const;

function Section({ titre, children }: { titre: string; children: ReactNode }): ReactNode {
  return (
    <section className="mentions__section">
      <h2>{titre}</h2>
      {children}
    </section>
  );
}

export default function Mentions(): ReactNode {
  useTitre("Mentions et données personnelles");
  return (
    <div className="mentions">
      <div className="intro">
        <h1>Mentions</h1>
        <p className="doux">
          Ce que ce site affiche, d'ou viennent les données, et ce qu'il fait de ce que vous y
          faites.
        </p>
      </div>

      <Section titre="Projet indépendant">
        <p>
          Ce site n'est <strong>pas affilié à TryHackMe</strong>, ni approuvé ni soutenu par eux.
          C'est un projet indépendant, construit a partir de métadonnées publiques.
        </p>
        <p>
          Les marques, noms de rooms et contenus pédagogiques appartiennent a leurs auteurs. Ce site
          n'en héberge aucun : chaque room renvoie vers{" "}
          <a href="https://tryhackme.com" rel="noopener noreferrer" target="_blank">
            tryhackme.com
          </a>
          , ou elle se fait.
        </p>
      </Section>

      <Section titre="Données affichées">
        <p>
          Uniquement des <strong>métadonnées</strong> : titre, description courte, difficulté, type,
          durée annoncée, nombre de participants, étiquettes. Jamais l'énoncé d'une room, jamais une
          solution, jamais un drapeau.
        </p>
        <ul className="mentions__liste">
          <li>
            Jeu de données <code>{DATASET.version}</code>, extrait le {DATASET.extraitLe}
          </li>
          <li>
            {DATASET.roomsGratuites} rooms gratuites retenues sur {DATASET.roomsAuCatalogue}{" "}
            présentes au catalogue
          </li>
          <li>
            Un jeu de données est une <strong>photographie datée</strong> : TryHackMe publie, retire
            et modifie des rooms en continu. Une room retirée du catalogue reste visible ici,
            signalée comme telle, plutot que de disparaitre de votre progression sans explication.
          </li>
        </ul>
        <p className="petit doux">
          Les parcours, eux, ne viennent pas des données : ils sont écrits a la main. Les données
          TryHackMe ne contiennent aucun ordre pédagogique, et aucun prérequis technique.
        </p>
      </Section>

      <Section titre="Vos données">
        <p>
          <strong>Aucun compte. Aucun cookie. Aucun traceur. Aucune mesure d'audience.</strong>
        </p>
        <ul className="mentions__liste">
          <li>
            Votre progression est enregistrée dans le{" "}
            <strong>stockage local de ce navigateur</strong>, sur cet appareil. Elle ne part jamais
            sur le réseau.
          </li>
          <li>
            Le site écrit <strong>deux clés</strong> dans ce navigateur, et aucune autre :
            <code>thm-roadmap.progression</code>, votre progression ; et une clé de session qui
            retient la position de défilement d'une page à l'autre, effacée à la fermeture de
            l'onglet. Aucune ne vous identifie, aucune n'est lue par un tiers — c'est pourquoi ce
            site n'affiche <strong>aucun bandeau de consentement</strong> : il n'a rien à faire
            accepter.
          </li>
          <li>
            Ce n'est pas une intention, c'est une impossibilité : l'API ne sait que{" "}
            <strong>lire</strong>. Elle n'expose aucune route capable de recevoir quoi que ce soit,
            et un test le vérifie a chaque construction.
          </li>
          <li>
            Vous pouvez <strong>exporter</strong> votre progression en JSON depuis la page{" "}
            <Link to="/progression">Ma progression</Link>. Vider les données de site de votre
            navigateur l'efface définitivement — il n'en existe aucune copie ailleurs.
          </li>
        </ul>
      </Section>

      <Section titre="Journaux du serveur">
        <p>
          Le serveur enregistre les requêtes qu'il reçoit — méthode, chemin, code de réponse, durée
          — pour diagnostiquer les pannes.
        </p>
        <p>
          <strong>L'adresse IP n'y figure pas.</strong> Elle est retirée avant écriture, y compris
          celle transmise par un serveur intermédiaire. Elle reste employée en mémoire, le temps
          d'une requête, pour limiter le nombre d'appels par visiteur — jamais conservée.
        </p>
      </Section>

      <Section titre="Éditeur, licence et contact">
        <ul className="mentions__liste">
          <li>
            <strong>Éditeur</strong> : Nel, pour HashCode Community.
          </li>
          <li>
            <strong>Contact</strong> :{" "}
            <a href="https://github.com/neltolofon-dot" target="_blank" rel="noopener noreferrer">
              github.com/neltolofon-dot
              <span className="visuellement-cache"> (nouvel onglet)</span>
            </a>
            . Une remarque sur une room, un parcours ou cette page se dépose là.
          </li>
          <li>
            <strong>Licence</strong> : le code et les parcours sont publiés sous licence MIT. Les
            métadonnées TryHackMe affichées ici ne le sont pas : elles appartiennent à TryHackMe et
            à ses auteurs.
          </li>
          <li>
            <strong>Hébergeur</strong> : à renseigner à la mise en ligne.
          </li>
        </ul>
      </Section>

      <Section titre="Accessibilité">
        <p>
          Les contrastes sont <strong>mesurés</strong>, pas estimés : 37 paires de couleurs, et la
          construction échoue si une seule passe sous le seuil AA.
        </p>
        <p>
          La couleur n'est jamais le seul porteur d'information :{" "}
          <strong>chaque badge porte son libellé en toutes lettres</strong>. Les niveaux de
          difficulté sont en revanche codés par la teinte, et deux d'entre eux ne se distinguent
          plus en niveaux de gris — c'est le libellé qui les sépare, pas la couleur.
        </p>
        <p>
          Les animations sont coupées, pas raccourcies, lorsque le système demande moins de
          mouvement.
        </p>
        <p className="petit doux">
          Un manquement remarqué est une erreur à corriger, pas un arbitrage à défendre.
        </p>
      </Section>
    </div>
  );
}
