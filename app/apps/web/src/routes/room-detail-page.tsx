import { createRoute, Link } from "@tanstack/react-router";
import type { RoomDetail as RoomDetailPayload, TagRef } from "@thm/shared";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { ApiError, urls, useResource } from "../api.js";
import { useAvancement } from "../avancement.js";
import {
  DifficultyBadge,
  formatDate,
  formatDuration,
  formatUsers,
  TeamBadge,
  TypeBadge,
} from "../components/badges.js";
import { EntetePage } from "../components/EntetePage.js";
import { Empty, ErrorState, Loading } from "../components/states.js";
import { Callout, ProgressBar } from "../components/ui/index.js";
import { RoomCompletionControl, useProgression } from "../progression.js";
import { useTitre } from "../titre.js";
import { roomDetailRoute } from "./room-detail.js";

export default function RoomDetail(): ReactNode {
  const { code } = roomDetailRoute.useParams();
  const room = useResource<RoomDetailPayload>(urls.room(code));
  const introuvable =
    room.status === "error" && room.error instanceof ApiError && room.error.status === 404;
  // Le titre vient de la reponse : tant qu'elle n'est pas la, on garde celui de
  // la page precedente plutot que d'annoncer un gabarit vide. Une room qui
  // n'existe pas n'aura jamais de reponse : elle porte son propre titre, sinon
  // l'onglet annonce encore la page d'ou l'on vient.
  useTitre(introuvable ? "Room introuvable" : (room.data?.title ?? null));

  if (room.status === "loading" && room.data === null) {
    return <Loading label="Chargement de la room" />;
  }

  if (room.status === "error" && room.data === null) {
    // Un 404 n'est pas une panne : c'est une reponse. La distinction compte pour
    // l'utilisateur qui a suivi un lien perime.
    if (room.error instanceof ApiError && room.error.status === 404) {
      return (
        <Empty titrePrincipal title={`Aucune room ne porte le code « ${code} »`}>
          <p className="petit doux">
            Le code est sensible a la casse : <code>{code}</code> n'existe pas tel quel.
          </p>
          <p style={{ marginTop: 8 }}>
            <Link to="/rooms">Retour au catalogue</Link>
          </p>
        </Empty>
      );
    }
    return <ErrorState error={room.error} onRetry={room.reload} />;
  }

  if (room.data === null) return null;
  return <RoomView room={room.data} stale={room.status === "loading"} />;
}

function RoomView({ room, stale }: { room: RoomDetailPayload; stale: boolean }): ReactNode {
  const progression = useProgression();
  const codes = useMemo(
    () => progression.completedRooms.map((faite: { code: string }) => faite.code),
    [progression.completedRooms],
  );
  const slugs = useMemo(
    () => [...new Set(room.trackSteps.map((etape) => etape.trackSlug))],
    [room.trackSteps],
  );
  const avancements = useAvancement(slugs, codes);

  return (
    <div className={stale ? "perime" : undefined}>
      <EntetePage
        fil={
          <>
            <Link to="/rooms">Catalogue</Link> <span aria-hidden="true">/</span>{" "}
            <span aria-current="page">{room.title}</span>
          </>
        }
        titre={room.title}
        sousTitre={
          room.description === null
            ? "Cette room n'a pas de description dans les données source."
            : room.description
        }
        actions={
          <>
            {/* Le lien sortant est le point de sortie utile de la page :
                `rel="noopener noreferrer"` accompagne `target="_blank"`, et le
                code part TEL QUEL — jamais de repli de casse, l'URL TryHackMe
                en depend (ADR-0001 Q1). */}
            <a
              className="bouton bouton--principal lien-externe"
              href={room.thmUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ouvrir sur TryHackMe
              <span aria-hidden="true">↗</span>
              <span className="visuellement-cache">(nouvel onglet)</span>
            </a>
            <RoomCompletionControl code={room.code} />
          </>
        }
      />

      <div className="grille-page">
        <div className="colonne-principale fiche-room">
          <div className="rang">
            <DifficultyBadge difficulty={room.difficulty} />
            <TypeBadge type={room.type} />
            {room.teams.map((team) => (
              <TeamBadge key={team.key} team={team} />
            ))}
          </div>

          {/* Les quatre faits, en ligne sous les badges. Ils occupaient une
              colonne de 280 px qui ne portait qu'eux et qui, en mobile, tombait
              apres tout le reste. */}
          <dl className="meta-room">
            <div>
              <dt>Durée</dt>
              <dd>{formatDuration(room.durationMinutes)}</dd>
            </div>
            <div>
              <dt>Participants</dt>
              <dd>{formatUsers(room.usersCount).replace(" participants", "")}</dd>
            </div>
            <div>
              <dt>Republiée le</dt>
              <dd>{formatDate(room.publishedAt)}</dd>
            </div>
            <div>
              {/* Affiche a la casse exacte : c'est l'identifiant, pas un libelle. */}
              <dt>Code</dt>
              <dd>
                <code>{room.code}</code>
              </dd>
            </div>
          </dl>

          <TagGroup title="Technologies" tags={room.tags.technology} facet="tech" />
          <TagGroup title="Outils" tags={room.tags.tool} facet="tool" />
          <TagGroup title="Compétences" tags={room.tags.skill} facet="skill" />

          {/* La nuance sur la date est vraie et utile, mais elle ne merite pas
              quatre lignes en permanence sous les faits qu'elle nuance. */}
          <Callout repliable ouvertParDefaut={false} titre="Ce que « Republiée » veut dire">
            <p className="petit doux">
              C'est la date fournie par TryHackMe. Ce n'est pas une date de création : n'en tirez
              aucune conclusion sur l'ancienneté du contenu.
            </p>
          </Callout>
        </div>

        <aside className="colonne-laterale" aria-label="Dans vos parcours">
          <section className="panneau">
            <h2 className="panneau__titre">Dans vos parcours</h2>
            {room.trackSteps.length === 0 ? (
              <p className="petit doux">
                Aucun pour l'instant. Les parcours sont un contenu éditorial : ils ne se déduisent
                d'aucune donnée TryHackMe.
              </p>
            ) : (
              <ul className="parcours-de-la-room">
                {room.trackSteps.map((etape) => {
                  const avancement = avancements.get(etape.trackSlug);
                  return (
                    <li
                      key={`${etape.trackSlug}-${etape.stepPosition}`}
                      className="renvoi-parcours"
                    >
                      <h3 className="renvoi-parcours__titre">
                        {/* Le parcours est CLIQUABLE, et toute la carte l'est :
                            la fiche nommait le parcours et laissait retrouver son
                            adresse a la main. */}
                        <Link to="/roadmap/$slug" params={{ slug: etape.trackSlug }}>
                          {etape.trackTitle}
                        </Link>
                      </h3>
                      <p className="renvoi-parcours__etape">
                        Étape {etape.stepPosition} : {etape.stepTitle}
                        {etape.note !== null && <span className="doux"> ({etape.note})</span>}
                      </p>
                      {avancement !== undefined && (
                        <ProgressBar
                          faits={avancement.faits}
                          total={avancement.total}
                          pourcent={avancement.pourcentage}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function TagGroup({
  title,
  tags,
  facet,
}: {
  title: string;
  tags: TagRef[];
  facet: "tech" | "tool" | "skill";
}): ReactNode {
  if (tags.length === 0) return null;

  // Cle calculee interdite : `{ [facet]: [...] }` s'inferait en
  // `{ [x: string]: string[] }` et le routeur ne pourrait plus verifier que la
  // cible existe. Trois litteraux explicites, trois types exacts.
  const searchFor = (slug: string) =>
    facet === "tech" ? { tech: [slug] } : facet === "tool" ? { tool: [slug] } : { skill: [slug] };

  return (
    <section>
      <h2 style={{ marginBottom: 6 }}>{title}</h2>
      <ul className="groupe-tags">
        {tags.map((tag) => (
          <li key={tag.slug}>
            {/* Chaque tag ramene au catalogue filtre : c'est la navigation la
                plus utile depuis une fiche. */}
            <Link to="/rooms" search={searchFor(tag.slug)}>
              <span className="badge badge--neutre">{tag.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
