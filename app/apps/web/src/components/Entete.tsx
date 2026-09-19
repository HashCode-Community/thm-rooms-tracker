import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useId, useState } from "react";

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
 * Vrai des que la page a quitte le haut.
 *
 * L'en-tete est transparente sur le hero — elle le laisse respirer — et se pose
 * sur un fond des que du contenu passe dessous, sinon le texte defilerait
 * derriere des liens illisibles. Le seuil est bas (24 px) : la bascule doit
 * avoir lieu avant que quoi que ce soit atteigne la barre.
 */
function useDefilee(): boolean {
  const [defilee, setDefilee] = useState(false);

  useEffect(() => {
    const suivre = (): void => {
      setDefilee(window.scrollY > 24);
    };
    suivre();
    // `passive` : ce gestionnaire ne bloque jamais le defilement.
    window.addEventListener("scroll", suivre, { passive: true });
    return () => {
      window.removeEventListener("scroll", suivre);
    };
  }, []);

  return defilee;
}

export function Entete(): ReactNode {
  const [ouvert, setOuvert] = useState(false);
  const menuId = useId();
  const defilee = useDefilee();

  return (
    <header className={`entete${defilee || ouvert ? " entete--posee" : ""}`}>
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
        </div>
      </div>
    </header>
  );
}
