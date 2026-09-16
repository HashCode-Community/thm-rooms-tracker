import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useId, useState } from "react";
import { appliquerChoix, LIBELLE, lireChoix, suivant, type Theme } from "../theme.js";

/**
 * En-tete.
 *
 * LE MENU MOBILE EST UN VRAI BOUTON, pas une case a cocher deguisee. Le motif
 * « checkbox + label » evite un peu de JavaScript et coute l'annonce correcte :
 * un lecteur d'ecran dit « case a cocher » la ou l'utilisateur ouvre un menu.
 * `aria-expanded` et `aria-controls` disent ce qui se passe.
 *
 * La navigation reste DANS LE DOCUMENT quand le menu est ferme, masquee par
 * `hidden` : le contenu n'est pas detruit puis recree, et le focus ne saute pas.
 */

const LIENS = [
  { to: "/", libelle: "Accueil" },
  { to: "/rooms", libelle: "Catalogue" },
  { to: "/roadmap", libelle: "Parcours" },
  { to: "/progression", libelle: "Progression" },
] as const;

/**
 * Bascule de theme, a trois etats.
 *
 * Le libelle est ECRIT, pas seulement une icone : trois etats dont un
 * « systeme » ne se devinent pas d'un pictogramme, et un bouton dont on ne sait
 * pas ce qu'il fera au clic n'est pas un bouton qu'on ose cliquer.
 */
function BasculeTheme(): ReactNode {
  const [choix, setChoix] = useState<Theme>("systeme");

  // Le theme est deja applique au document par `public/theme.js`, avant la
  // premiere peinture. Ce composant ne fait que reprendre l'etat pour
  // l'afficher : il ne l'applique pas au montage, sinon il ecraserait le
  // travail deja fait par un aller-retour inutile.
  useEffect(() => {
    setChoix(lireChoix(() => window.localStorage));
  }, []);

  return (
    <button
      type="button"
      className="bascule-theme"
      onClick={() => {
        const prochain = suivant(choix);
        setChoix(prochain);
        appliquerChoix(prochain, document.documentElement, () => window.localStorage);
      }}
    >
      <span className="bascule-theme__marque" aria-hidden="true" />
      {LIBELLE[choix]}
    </button>
  );
}

export function Entete(): ReactNode {
  const [ouvert, setOuvert] = useState(false);
  const menuId = useId();

  return (
    <header className="entete">
      <div className="entete__interieur">
        <Link to="/" className="marque" onClick={() => setOuvert(false)}>
          THM<span className="marque__accent">Roadmap</span>
        </Link>

        <button
          type="button"
          className="entete__bascule"
          aria-expanded={ouvert}
          aria-controls={menuId}
          onClick={() => setOuvert((etat) => !etat)}
        >
          <span className="entete__barres" aria-hidden="true" />
          {ouvert ? "Fermer" : "Menu"}
        </button>

        <div className="entete__panneau" id={menuId} hidden={!ouvert}>
          <nav className="nav" aria-label="Navigation principale">
            {LIENS.map((lien) => (
              <Link key={lien.to} to={lien.to} onClick={() => setOuvert(false)}>
                {lien.libelle}
              </Link>
            ))}
          </nav>
          <BasculeTheme />
        </div>
      </div>
    </header>
  );
}
