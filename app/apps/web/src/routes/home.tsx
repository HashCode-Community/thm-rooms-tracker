import { createRoute, Link } from "@tanstack/react-router";
import type { StatsResponse } from "@thm/shared";
import type { ReactNode } from "react";
import { urls, useResource } from "../api.js";
import { ErrorState, Loading } from "../components/states.js";
import { rootRoute } from "./root.js";

function Home(): ReactNode {
  const stats = useResource<StatsResponse>(urls.stats());

  return (
    <>
      <div className="intro">
        <h1>Le catalogue n'est pas le produit. Le parcours l'est.</h1>
        <p className="doux">
          714 rooms TryHackMe gratuites, indexees et filtrables. Mais une liste de 714 entrees ne
          dit pas par ou commencer : c'est le role des parcours, ecrits a la main et assumes comme
          des recommandations, jamais comme des prerequis techniques.
        </p>
      </div>

      <h2 className="visuellement-cache">Chiffres cles</h2>
      {stats.status === "loading" && stats.data === null && (
        <div style={{ margin: "24px 0" }}>
          <Loading label="Chargement des chiffres du catalogue" />
        </div>
      )}
      {stats.status === "error" && stats.data === null && (
        <div style={{ margin: "24px 0" }}>
          <ErrorState error={stats.error} onRetry={stats.reload} />
        </div>
      )}
      {stats.data !== null && (
        <ul className={`chiffres${stats.status === "loading" ? " perime" : ""}`}>
          <Figure value={stats.data.rooms.total.toLocaleString("fr-FR")} label="rooms gratuites" />
          <Figure
            value={Math.round(stats.data.durationMinutes.total / 60).toLocaleString("fr-FR")}
            label="heures de contenu cumulees"
          />
          <Figure
            value={(
              stats.data.tags.technology +
              stats.data.tags.tool +
              stats.data.tags.skill
            ).toLocaleString("fr-FR")}
            label="technologies, outils et competences"
          />
          <Figure
            value={`${stats.data.byDifficulty.find((d) => d.key === "easy")?.count ?? 0}`}
            label="rooms de niveau facile"
          />
        </ul>
      )}

      <h2 style={{ marginBottom: 8 }}>Par ou entrer</h2>
      <ul className="portes">
        <li>
          <Link to="/rooms" className="porte">
            <span className="porte__titre">Catalogue</span>
            <span className="petit doux">
              Chercher, filtrer par technologie, outil, competence, difficulte ou duree.
            </span>
          </Link>
        </li>
        <li>
          <Link to="/roadmap" className="porte">
            <span className="porte__titre">Parcours</span>
            <span className="petit doux">
              Un ordre de lecture dans les 714 rooms. Contenu editorial, ecrit a la main : les
              donnees TryHackMe ne contiennent aucun ordre pedagogique.
            </span>
          </Link>
        </li>
        <li>
          <div className="porte" aria-disabled="true">
            <span className="porte__titre">Ma progression</span>
            <span className="petit doux">Pas encore disponible.</span>
          </div>
        </li>
      </ul>
    </>
  );
}

function Figure({ value, label }: { value: string; label: string }): ReactNode {
  return (
    <li className="chiffre">
      <div className="chiffre__valeur">{value}</div>
      <div className="chiffre__libelle">{label}</div>
    </li>
  );
}

export const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Home,
});
