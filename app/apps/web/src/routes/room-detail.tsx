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
import { Callout } from "../components/ui/index.js";
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

      <article className="fiche-room">
        <h1>{room.title}</h1>
        <div className="rang">
          <DifficultyBadge difficulty={room.difficulty} />
          <TypeBadge type={room.type} />
          {room.teams.map((team) => (
            <TeamBadge key={team.key} team={team} />
          ))}
        </div>

        {/*
          LES QUATRE FAITS, SOUS LE TITRE. Ils occupaient une colonne de 280 px
          a droite qui ne portait qu'eux — et qui, sous 860 px, tombait APRES
          tout le reste : apres les tags, apres les parcours, tout en bas de
          page. La duree d'une room est ce qu'on lit en premier, pas en dernier.
        */}
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

        {room.description === null ? (
          <p className="doux">Cette room n'a pas de description dans les données source.</p>
        ) : (
          <p>{room.description}</p>
        )}

        {/*
          LES DEUX ACTIONS COTE A COTE. Faire la room et la cocher sont le meme
          geste en deux temps ; chacune dans son paragraphe, la seconde se
          cherchait. Le lien sortant porte le bouton principal : c'est le point
          de sortie utile de la page, et `rel="noopener noreferrer"` accompagne
          `target="_blank"`. Le `code` part TEL QUEL — jamais de repli de casse,
          l'URL TryHackMe en depend (ADR-0001 Q1).
        */}
        <div className="fiche-room__actions">
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
        </div>

        <TagGroup title="Technologies" tags={room.tags.technology} facet="tech" />
        <TagGroup title="Outils" tags={room.tags.tool} facet="tool" />
        <TagGroup title="Compétences" tags={room.tags.skill} facet="skill" />

        <section>
          <h2>Parcours qui contiennent cette room</h2>
          {room.trackSteps.length === 0 ? (
            <p className="petit doux" style={{ marginTop: 4 }}>
              Aucun pour l'instant. Les parcours sont un contenu éditorial : ils ne se déduisent
              d'aucune donnée TryHackMe.
            </p>
          ) : (
            <ul className="parcours-de-la-room">
              {room.trackSteps.map((step) => (
                <li key={`${step.trackSlug}-${step.stepPosition}`}>
                  {/* LE PARCOURS EST CLIQUABLE. Il ne l'etait pas : la fiche
                      nommait le parcours et laissait l'utilisateur retrouver son
                      adresse tout seul, alors que c'est la suite naturelle. */}
                  <Link to="/roadmap/$slug" params={{ slug: step.trackSlug }}>
                    {step.trackTitle}
                  </Link>
                  <span className="doux">
                    {" — "}étape {step.stepPosition} : {step.stepTitle}
                    {step.note !== null && ` (${step.note})`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* La nuance sur la date est vraie et utile, mais elle ne merite pas
            quatre lignes en permanence sous les faits qu'elle nuance. */}
        <Callout repliable ouvertParDefaut={false} titre="Ce que « Republiée » veut dire">
          <p className="petit doux">
            C'est la date fournie par TryHackMe. Ce n'est pas une date de création : n'en tirez
            aucune conclusion sur l'ancienneté du contenu.
          </p>
        </Callout>
      </article>
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
