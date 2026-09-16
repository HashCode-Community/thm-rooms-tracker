import { createRoute, Link } from "@tanstack/react-router";
import type { StatsResponse, TrackListResponse } from "@thm/shared";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { urls, useResource } from "../api.js";
import { type AvancementParcours, useAvancement } from "../avancement.js";
import { formatDuration } from "../components/badges.js";
import { Compteur } from "../components/Compteur.js";
import { GrapheParcours } from "../components/GrapheParcours.js";
import { ErrorState } from "../components/states.js";
import { Badge, Skeleton } from "../components/ui/index.js";
import { useProgression } from "../progression.js";
import { useTitre } from "../titre.js";
import { rootRoute } from "./root.js";

const NIVEAUX: Readonly<Record<string, string>> = {
  beginner: "Débutant",
  intermediate: "Intermédiaire",
  advanced: "Avancé",
};

/**
 * Page d'accueil.
 *
 * ELLE DOIT FAIRE CHOISIR, pas informer. Sa version precedente posait un titre,
 * un paragraphe, quatre chiffres plats et trois portes equivalentes — dont le
 * catalogue en premier, alors que le titre affirme que le parcours est le
 * produit. Rien n'appelait a l'action.
 *
 * L'ordre suit maintenant la question de celui qui arrive : qu'est-ce que c'est,
 * par ou je commence, qu'est-ce que ca vaut, comment ca marche.
 */
function Home(): ReactNode {
  useTitre("714 rooms TryHackMe, trois parcours");
  const stats = useResource<StatsResponse>(urls.stats());
  const tracks = useResource<TrackListResponse>(urls.tracks());
  const progression = useProgression();
  const codes = useMemo(
    () => progression.completedRooms.map((room) => room.code),
    [progression.completedRooms],
  );
  const slugs = useMemo(
    () => (tracks.data === null ? [] : tracks.data.data.map((track) => track.slug)),
    [tracks.data],
  );
  const avancements = useAvancement(slugs, codes);
  const reprise = premiereRepriseUtile(slugs, avancements);

  return (
    <>
      <section className="hero">
        {/* Le fond : une trame, un halo tres faible derriere le graphe, un grain.
            Trois couches decoratives, aucune information. */}
        <div className="hero__fond" aria-hidden="true" />

        <div className="hero__colonnes">
          <div className="accroche">
            <h1 className="accroche__titre">
              714 rooms TryHackMe gratuites.
              <br />
              <span className="accroche__accent">Trois chemins pour les traverser.</span>
            </h1>
            <p className="accroche__sous-titre">
              Un catalogue ne dit pas par où commencer. Les parcours, oui : trois chemins écrits à
              la main, assumés comme des recommandations, jamais comme des prérequis.
            </p>

            {/* DEUX actions, une seule principale. Le parcours d'abord : c'est ce
                que le titre vient d'affirmer, et proposer deux portes egales
                reviendrait a ne rien recommander du tout. Quand une progression
                existe, l'action principale dit OU on reprend, pas « reprendre ». */}
            <div className="accroche__actions">
              {reprise === null ? (
                <Link to="/roadmap" className="bouton bouton--principal">
                  Commencer par un parcours
                </Link>
              ) : (
                <Link
                  to="/roadmap/$slug"
                  params={{ slug: reprise.slug }}
                  className="bouton bouton--principal"
                >
                  Reprendre {reprise.titre}, étape {reprise.etape}
                </Link>
              )}
              <Link to="/rooms" className="bouton">
                Explorer le catalogue
              </Link>
            </div>
          </div>

          <div className="hero__visuel">
            {tracks.data === null ? (
              <div className="graphe graphe--attente" aria-hidden="true" />
            ) : (
              <GrapheParcours tracks={tracks.data.data} avancements={avancements} />
            )}
          </div>
        </div>
      </section>

      <h2 className="visuellement-cache">Chiffres clés</h2>
      {stats.status === "error" && stats.data === null && (
        <ErrorState error={stats.error} onRetry={stats.reload} />
      )}
      {stats.data === null && stats.status === "loading" && (
        <ul className="chiffres" aria-busy="true">
          <span className="visuellement-cache">Chargement des chiffres du catalogue</span>
          {[1, 2, 3, 4].map((rang) => (
            <li className="chiffre" key={rang}>
              <Skeleton forme="chiffre" />
              <Skeleton forme="libelle" />
            </li>
          ))}
        </ul>
      )}
      {stats.data !== null && (
        <ul className={`chiffres${stats.status === "loading" ? " perime" : ""}`}>
          <Chiffre valeur={stats.data.rooms.total} libelle="rooms gratuites" />
          <Chiffre
            valeur={Math.round(stats.data.durationMinutes.total / 60)}
            libelle="heures de contenu"
          />
          <Chiffre
            valeur={stats.data.tags.technology + stats.data.tags.tool + stats.data.tags.skill}
            libelle="technologies, outils et compétences"
          />
          {tracks.data !== null && (
            <Chiffre
              valeur={tracks.data.data.length}
              libelle={`parcours écrit${tracks.data.data.length > 1 ? "s" : ""} à la main`}
            />
          )}
        </ul>
      )}

      <section className="section-accueil">
        <div className="section-accueil__entete">
          <h2>Les trois parcours</h2>
          <Link to="/roadmap">Voir le détail</Link>
        </div>

        {tracks.data === null && tracks.status === "loading" && (
          <ul className="apercu-parcours" aria-busy="true">
            <span className="visuellement-cache">Chargement des parcours</span>
            {[1, 2, 3].map((rang) => (
              <li key={rang}>
                <Skeleton forme="carte" />
              </li>
            ))}
          </ul>
        )}

        {tracks.data !== null && (
          <ul className="apercu-parcours">
            {tracks.data.data.map((track) => (
              <li key={track.slug} className="apercu-parcours__carte">
                {/* Le fil : la marque verticale qui identifie un parcours dans
                    tout le produit. Decorative ici, le titre porte le sens. */}
                <span className="apercu-parcours__fil" aria-hidden="true" />
                <h3 className="apercu-parcours__titre">
                  <Link to="/roadmap/$slug" params={{ slug: track.slug }}>
                    {track.title}
                  </Link>
                </h3>
                <div className="rang">
                  <Badge>{NIVEAUX[track.level] ?? track.level}</Badge>
                  <Badge>
                    {track.stepCount} étape{track.stepCount > 1 ? "s" : ""}
                  </Badge>
                  <Badge>{formatDuration(track.estimatedMinutes)}</Badge>
                </div>
                {track.summary !== null && (
                  <p className="petit doux apercu-parcours__resume">{track.summary}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section-accueil">
        <h2>Comment ça marche</h2>
        {/* Le meme fil que sur un parcours, en trois temps. La page d'accueil
            explique le produit avec la forme du produit. */}
        <ol className="marche">
          <li className="marche__etape">
            <span className="marche__marque" aria-hidden="true">
              1
            </span>
            <div>
              <h3>Choisissez un chemin</h3>
              <p className="petit doux">
                Trois parcours, du socle à l'offensive et à la défense. Chaque étape recommande des
                rooms — jamais de prérequis technique.
              </p>
            </div>
          </li>
          <li className="marche__etape">
            <span className="marche__marque" aria-hidden="true">
              2
            </span>
            <div>
              <h3>Avancez room par room</h3>
              <p className="petit doux">
                Chaque room se fait sur TryHackMe. Vous cochez ici ce que vous avez terminé, et la
                suite se met à jour.
              </p>
            </div>
          </li>
          <li className="marche__etape">
            <span className="marche__marque" aria-hidden="true">
              3
            </span>
            <div>
              <h3>Gardez la main sur vos données</h3>
              <p className="petit doux">
                Aucun compte, aucun cookie. Votre progression reste dans ce navigateur, et vous
                pouvez l'exporter quand vous voulez.
              </p>
            </div>
          </li>
        </ol>
      </section>
    </>
  );
}

/**
 * Le parcours a reprendre : le premier, dans l ordre des parcours, qui est
 * entame et pas fini. Sans progression, il n y en a aucun et l action
 * principale redevient « commencer ».
 */
function premiereRepriseUtile(
  slugs: readonly string[],
  avancements: ReadonlyMap<string, AvancementParcours>,
): { slug: string; titre: string; etape: number } | null {
  for (const slug of slugs) {
    const avancement = avancements.get(slug);
    if (avancement === undefined || avancement.prochaine === null) continue;
    if (avancement.pourcentage === 0) continue;
    return { slug, titre: avancement.titre, etape: avancement.prochaine };
  }
  return null;
}

function Chiffre({ valeur, libelle }: { valeur: number; libelle: string }): ReactNode {
  return (
    <li className="chiffre">
      <div className="chiffre__valeur">
        <Compteur valeur={valeur} />
      </div>
      <div className="chiffre__libelle">{libelle}</div>
    </li>
  );
}

export const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Home,
});
