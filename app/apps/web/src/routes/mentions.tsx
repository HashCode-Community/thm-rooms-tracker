import { createRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { rootRoute } from "./root.js";

/**
 * Mentions.
 *
 * REGLE DE CETTE PAGE : elle n'affirme que ce qui est verifiable dans le code ou
 * dans les donnees, et chaque affirmation qui engage est tenue par un test.
 * `apps/api/tests/api/promesses.test.ts` fait tomber la construction si l'API
 * cesse d'etre en lecture seule, ou si une adresse IP revient dans les journaux.
 * Une page de mentions que personne ne relit vieillit en mensonge ; celle-ci ne
 * peut pas vieillir sans que quelque chose casse.
 *
 * CE QUI N'Y EST PAS : l'editeur, l'hebergeur, le contact, la licence. Ces
 * informations ne se deduisent ni du code ni des donnees. Elles sont attendues
 * de Nel, et elles manquent — voir la dette. Mieux vaut une section absente
 * qu'une section remplie au hasard.
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

function Mentions(): ReactNode {
  return (
    <div className="mentions">
      <div className="intro">
        <h1>Mentions</h1>
        <p className="doux">
          Ce que ce site affiche, d'ou viennent les donnees, et ce qu'il fait de ce que vous y
          faites.
        </p>
      </div>

      <Section titre="Projet independant">
        <p>
          Ce site n'est <strong>pas affilie a TryHackMe</strong>, ni approuve ni soutenu par eux.
          C'est un projet independant, construit a partir de metadonnees publiques.
        </p>
        <p>
          Les marques, noms de rooms et contenus pedagogiques appartiennent a leurs auteurs. Ce site
          n'en heberge aucun : chaque room renvoie vers{" "}
          <a href="https://tryhackme.com" rel="noopener noreferrer" target="_blank">
            tryhackme.com
          </a>
          , ou elle se fait.
        </p>
      </Section>

      <Section titre="Donnees affichees">
        <p>
          Uniquement des <strong>metadonnees</strong> : titre, description courte, difficulte, type,
          duree annoncee, nombre de participants, etiquettes. Jamais l'enonce d'une room, jamais une
          solution, jamais un drapeau.
        </p>
        <ul className="mentions__liste">
          <li>
            Jeu de donnees <code>{DATASET.version}</code>, extrait le {DATASET.extraitLe}
          </li>
          <li>
            {DATASET.roomsGratuites} rooms gratuites retenues sur {DATASET.roomsAuCatalogue}{" "}
            presentes au catalogue
          </li>
          <li>
            Un jeu de donnees est une <strong>photographie datee</strong> : TryHackMe publie, retire
            et modifie des rooms en continu. Une room retiree du catalogue reste visible ici,
            signalee comme telle, plutot que de disparaitre de votre progression sans explication.
          </li>
        </ul>
        <p className="petit doux">
          Les parcours, eux, ne viennent pas des donnees : ils sont ecrits a la main. Les donnees
          TryHackMe ne contiennent aucun ordre pedagogique, et aucun prerequis technique.
        </p>
      </Section>

      <Section titre="Vos donnees">
        <p>
          <strong>Aucun compte. Aucun cookie. Aucun traceur. Aucune mesure d'audience.</strong>
        </p>
        <ul className="mentions__liste">
          <li>
            Votre progression est enregistree dans le{" "}
            <strong>stockage local de ce navigateur</strong>, sur cet appareil. Elle ne part jamais
            sur le reseau.
          </li>
          <li>
            Ce n'est pas une intention, c'est une impossibilite : l'API ne sait que{" "}
            <strong>lire</strong>. Elle n'expose aucune route capable de recevoir quoi que ce soit,
            et un test le verifie a chaque construction.
          </li>
          <li>
            Vous pouvez <strong>exporter</strong> votre progression en JSON depuis la page{" "}
            <Link to="/progression">Ma progression</Link>. Vider les donnees de site de votre
            navigateur l'efface definitivement — il n'en existe aucune copie ailleurs.
          </li>
        </ul>
      </Section>

      <Section titre="Journaux du serveur">
        <p>
          Le serveur enregistre les requetes qu'il recoit — methode, chemin, code de reponse, duree
          — pour diagnostiquer les pannes.
        </p>
        <p>
          <strong>L'adresse IP n'y figure pas.</strong> Elle est retiree avant ecriture, y compris
          celle transmise par un serveur intermediaire. Elle reste employee en memoire, le temps
          d'une requete, pour limiter le nombre d'appels par visiteur — jamais conservee.
        </p>
      </Section>

      <Section titre="Accessibilite">
        <p>
          Les contrastes sont <strong>mesures</strong>, pas estimes : la construction echoue si une
          seule paire de couleurs passe sous le seuil AA. La couleur n'est jamais le seul porteur
          d'information — chaque badge porte son libelle, et les niveaux de difficulte restent
          distinguables en niveaux de gris.
        </p>
        <p className="petit doux">
          Un manquement remarque est une erreur a corriger, pas un arbitrage a defendre.
        </p>
      </Section>
    </div>
  );
}

export const mentionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/mentions",
  component: Mentions,
});
