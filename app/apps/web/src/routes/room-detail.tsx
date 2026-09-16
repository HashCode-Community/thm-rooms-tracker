import { createRoute, Link } from "@tanstack/react-router";
import type { RoomDetail as RoomDetailPayload, TagRef } from "@thm/shared";
import type { ReactNode } from "react";
import { ApiError, urls, useResource } from "../api.js";
import {
  DifficultyBadge,
  formatDate,
  formatDuration,
  formatUsers,
  TeamBadge,
  TypeBadge,
} from "../components/badges.js";
import { Empty, ErrorState, Loading } from "../components/states.js";
import { RoomCompletionControl } from "../progression.js";
import { rootRoute } from "./root.js";

function RoomDetail(): ReactNode {
  const { code } = roomDetailRoute.useParams();
  const room = useResource<RoomDetailPayload>(urls.room(code));

  if (room.status === "loading" && room.data === null) {
    return <Loading label="Chargement de la room" />;
  }

  if (room.status === "error" && room.data === null) {
    // Un 404 n'est pas une panne : c'est une reponse. La distinction compte pour
    // l'utilisateur qui a suivi un lien perime.
    if (room.error instanceof ApiError && room.error.status === 404) {
      return (
        <Empty title={`Aucune room ne porte le code « ${code} »`}>
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
  return (
    <div className={stale ? "perime" : undefined}>
      <p className="fil">
        <Link to="/rooms">Catalogue</Link> <span aria-hidden="true">/</span> {room.title}
      </p>

      <div className="detail">
        <div className="detail__corps">
          <div>
            <h1>{room.title}</h1>
            <div className="rang" style={{ marginTop: 8 }}>
              <DifficultyBadge difficulty={room.difficulty} />
              <TypeBadge type={room.type} />
              {room.teams.map((team) => (
                <TeamBadge key={team.key} team={team} />
              ))}
            </div>
          </div>

          {room.description === null ? (
            <p className="doux">Cette room n'a pas de description dans les données source.</p>
          ) : (
            <p>{room.description}</p>
          )}

          {/*
            Le lien sortant est le point de sortie utile de la page : c'est la
            que se fait la room. `rel="noopener noreferrer"` avec `target="_blank"`,
            et le `code` part TEL QUEL — jamais de repli de casse, l'URL TryHackMe
            en depend (ADR-0001 Q1).
          */}
          <p>
            <a
              className="lien-sortant"
              href={room.thmUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ouvrir sur TryHackMe
              <span aria-hidden="true">↗</span>
              <span className="visuellement-cache">(nouvel onglet)</span>
            </a>
          </p>

          <p>
            <RoomCompletionControl code={room.code} />
          </p>

          <TagGroup title="Technologies" tags={room.tags.technology} facet="tech" />
          <TagGroup title="Outils" tags={room.tags.tool} facet="tool" />
          <TagGroup title="Compétences" tags={room.tags.skill} facet="skill" />

          <section>
            <h2>Parcours qui contiennent cette room</h2>
            {room.trackSteps.length === 0 ? (
              <p className="petit doux" style={{ marginTop: 4 }}>
                Aucun pour l'instant. Les parcours sont un contenu editorial : ils ne se deduisent
                d'aucune donnee TryHackMe.
              </p>
            ) : (
              <ul>
                {room.trackSteps.map((step) => (
                  <li key={`${step.trackSlug}-${step.stepPosition}`}>
                    {step.trackTitle} — étape {step.stepPosition} : {step.stepTitle}
                    {step.note !== null && <span className="doux"> ({step.note})</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="fiche" aria-label="Informations">
          <dl>
            <dt>Code</dt>
            {/* Affiche a la casse exacte : c'est l'identifiant, pas un libelle. */}
            <dd>
              <code>{room.code}</code>
            </dd>
            <dt>Durée</dt>
            <dd>{formatDuration(room.durationMinutes)}</dd>
            <dt>Participants</dt>
            <dd>{formatUsers(room.usersCount).replace(" participants", "")}</dd>
            <dt>Republiée le</dt>
            <dd>{formatDate(room.publishedAt)}</dd>
          </dl>
          <p className="petit doux">
            « Republiee » est la date fournie par TryHackMe. Ce n'est pas une date de creation :
            n'en tirez aucune conclusion sur l'anciennete du contenu.
          </p>
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

export const roomDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/rooms/$code",
  component: RoomDetail,
});
