import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Entete } from "../components/Entete.js";
import { Pied } from "../components/Pied.js";
import { ErrorState } from "../components/states.js";
import { EmptyState } from "../components/ui/index.js";
import { ProgressionPersistenceWarning } from "../progression.js";
import { useTitre } from "../titre.js";

function Layout(): ReactNode {
  return (
    <>
      {/* Premier element focalisable de la page : au clavier, une tabulation
          permet de sauter l'entete et la navigation. */}
      <a className="lien-evitement" href="#contenu">
        Aller au contenu
      </a>

      <Entete />

      <main id="contenu" className="page">
        <ProgressionPersistenceWarning />
        <Outlet />
      </main>

      <Pied />
    </>
  );
}

/**
 * Page introuvable.
 *
 * ELLE PORTE UN `<h1>`. Sans lui, un lecteur d'ecran arrive sur une page sans
 * point d'entree — et c'est precisement la page ou l'on est deja perdu.
 *
 * Elle propose plusieurs sorties, pas une seule : quelqu'un qui se trompe
 * d'adresse ne cherche pas forcement le catalogue.
 */
function NotFound(): ReactNode {
  useTitre("Page introuvable");
  return (
    <EmptyState
      titre="Cette page n'existe pas"
      icone={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <title>Panneau d'avertissement</title>
          <path d="M12 3 2 21h20L12 3Z" strokeLinejoin="round" />
          <path d="M12 10v5" strokeLinecap="round" />
          <circle cx="12" cy="18" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      }
    >
      <p className="petit doux">
        L'adresse demandée ne correspond à aucune page du site. Elle a peut-être changé, ou comporte
        une faute de frappe.
      </p>
      <p className="rang" style={{ marginTop: 12, justifyContent: "center" }}>
        <Link to="/">Accueil</Link>
        <Link to="/roadmap">Parcours</Link>
        <Link to="/rooms">Catalogue</Link>
      </p>
    </EmptyState>
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
