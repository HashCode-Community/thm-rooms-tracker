import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ErrorState } from "../components/states.js";

function Layout(): ReactNode {
  return (
    <>
      {/* Premier element focalisable de la page : au clavier, une tabulation
          permet de sauter l'entete et la navigation. */}
      <a className="lien-evitement" href="#contenu">
        Aller au contenu
      </a>

      <header className="entete">
        <div className="entete__interieur">
          <Link to="/" className="marque">
            THM Roadmap
          </Link>
          <nav className="nav" aria-label="Navigation principale">
            <Link to="/">Accueil</Link>
            <Link to="/rooms">Catalogue</Link>
          </nav>
        </div>
      </header>

      <main id="contenu" className="page">
        <Outlet />
      </main>

      <footer className="pied">
        <div className="pied__interieur">
          <p>
            Projet independant, <strong>non affilie a TryHackMe</strong>. Seules des metadonnees
            publiques des 714 rooms gratuites sont affichees ; les contenus restent sur{" "}
            <a href="https://tryhackme.com" rel="noopener noreferrer" target="_blank">
              tryhackme.com
            </a>
            .
          </p>
        </div>
      </footer>
    </>
  );
}

function NotFound(): ReactNode {
  return (
    <div className="etat">
      <div className="etat__titre">Page introuvable</div>
      <p className="petit doux">Cette adresse ne correspond a aucune page.</p>
      <p style={{ marginTop: 8 }}>
        <Link to="/rooms">Retour au catalogue</Link>
      </p>
    </div>
  );
}

export const rootRoute = createRootRoute({
  component: Layout,
  notFoundComponent: NotFound,
  errorComponent: ({ error }) => (
    <div className="page">
      <ErrorState error={error instanceof Error ? error : new Error(String(error))} />
    </div>
  ),
});
