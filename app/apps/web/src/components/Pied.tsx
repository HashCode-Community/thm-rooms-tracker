import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * Pied de page.
 *
 * LA NON-AFFILIATION RESTE EN PREMIER, et en toutes lettres. Ce n'est pas une
 * formule de politesse : le site affiche les titres et descriptions d'un service
 * tiers, et l'utilisateur doit savoir des le premier coup d'oeil qu'il n'est pas
 * chez eux. La ranger dans une colonne parmi trois la rendrait decorative.
 *
 * Les colonnes viennent APRES elle, pas autour.
 */
export function Pied(): ReactNode {
  return (
    <footer className="pied">
      <div className="pied__interieur">
        <p className="pied__mention">
          Projet indépendant, <strong>non affilié à TryHackMe</strong>. Seules des métadonnées
          publiques des 714 rooms gratuites sont affichées ; les contenus restent sur{" "}
          <a href="https://tryhackme.com" rel="noopener noreferrer" target="_blank">
            tryhackme.com
          </a>
          .
        </p>

        <div className="pied__colonnes">
          <nav className="pied__colonne" aria-label="Le produit">
            <p className="pied__titre">Le produit</p>
            <Link to="/roadmap">Parcours</Link>
            <Link to="/rooms">Catalogue</Link>
            <Link to="/progression">Ma progression</Link>
          </nav>

          <nav className="pied__colonne" aria-label="À propos">
            <p className="pied__titre">À propos</p>
            <Link to="/mentions">Mentions et données personnelles</Link>
            <a href="https://tryhackme.com" rel="noopener noreferrer" target="_blank">
              TryHackMe
            </a>
          </nav>

          <div className="pied__colonne">
            <p className="pied__titre">Vos données</p>
            <p className="petit doux">
              Aucun compte, aucun cookie, aucun traceur. Votre progression reste dans ce navigateur.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
