import { createRoute, Link } from "@tanstack/react-router";
import { computeTrackProgress, nextStepPosition } from "@thm/shared";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type Async, loadProgressionResources, type ProgressionResources } from "../api.js";
import { AnneauProgression } from "../components/AnneauProgression.js";
import { formatDuration } from "../components/badges.js";
import { CheminEnPointilles } from "../components/CheminEnPointilles.js";
import { EntetePage } from "../components/EntetePage.js";
import { Empty, ErrorState, Loading } from "../components/states.js";
import { Button, ProgressBar } from "../components/ui/index.js";
import { ProgressionDownloadLink, RoomCompletionControl, useProgression } from "../progression.js";
import { grouperParParcours, type RoomTerminee } from "../progression-groupes.js";
import { summarizeCompletedRooms } from "../progression-summary.js";
import { useTitre } from "../titre.js";

const EMPTY_RESOURCES: ProgressionResources = { rooms: [], missing: [], tracks: [] };

function useProgressionResources(codes: readonly string[]): Async<ProgressionResources> & {
  reload(): void;
} {
  const key = codes.join("\u0000");
  const [state, setState] = useState<Async<ProgressionResources>>(
    codes.length === 0
      ? { status: "ok", data: EMPTY_RESOURCES }
      : { status: "loading", data: null },
  );

  const run = useCallback((): (() => void) => {
    if (key === "") {
      setState({ status: "ok", data: EMPTY_RESOURCES });
      return () => {};
    }

    const controller = new AbortController();
    const requestedCodes = key.split("\u0000");
    setState((previous) => ({ status: "loading", data: previous.data }));
    loadProgressionResources(requestedCodes, controller.signal)
      .then((data) => {
        setState({ status: "ok", data });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState((previous) => ({
          status: "error",
          error: error instanceof Error ? error : new Error(String(error)),
          data: previous.data,
        }));
      });

    return () => controller.abort();
  }, [key]);

  useEffect(() => run(), [run]);

  const reload = useCallback(() => {
    run();
  }, [run]);
  return { ...state, reload };
}

function formatCompletedAt(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

/**
 * Les rooms que le navigateur connait mais que le catalogue ignore.
 *
 * Elles sont NOMMEES et retirables. Les tolerer en silence laisserait
 * l'utilisateur avec une entree fantome qu'il ne peut ni voir ni supprimer, et
 * un total qui ne correspond a rien de visible. Le retrait passe par `forget`,
 * qui ne touche a aucune autre entree.
 */
function MissingRooms({
  codes,
  onForget,
}: {
  codes: readonly string[];
  onForget(): void;
}): ReactNode {
  if (codes.length === 0) return null;
  const pluriel = codes.length > 1;

  return (
    <div className="alerte-disparues" role="status">
      <p>
        <strong>
          {codes.length} room{pluriel ? "s" : ""} de votre progression n
          {pluriel ? "'existent" : "'existe"} plus dans le catalogue.
        </strong>{" "}
        Elle{pluriel ? "s ne sont" : " n'est"} compte{pluriel ? "es" : "e"} ni dans vos heures
        cumulées, ni dans l'avancement des parcours.
      </p>
      <ul className="petit doux">
        {codes.map((code) => (
          <li key={code}>
            <code>{code}</code>
          </li>
        ))}
      </ul>
      <button type="button" className="bouton" onClick={onForget}>
        Retirer de ma progression
      </button>
    </div>
  );
}

function CompletedRoomRow({ room, completedAt }: RoomTerminee): ReactNode {
  return (
    <li className="progression-room">
      <div className="progression-room__corps">
        <div className="rang">
          <Link to="/rooms/$code" params={{ code: room.code }} className="progression-room__titre">
            {room.title}
          </Link>
          {!room.isActive && <span className="badge badge--retiree">Retirée du catalogue</span>}
        </div>
        <p className="petit doux">
          {/*
            Une date dans un futur lointain vient d'une horloge machine dereglee.
            Elle est VALIDE au format, donc le magasin la garde — mais l'afficher
            reviendrait a annoncer a l'utilisateur qu'il a termine une room en
            2027. On dit ce qu'on sait, et on ne touche pas au stockage.
          */}
          {completedAt === null
            ? "Date d'achevement inconnue"
            : `Terminée le ${formatCompletedAt(completedAt)}`}{" "}
          · {formatDuration(room.durationMinutes)}
        </p>
      </div>
      <RoomCompletionControl code={room.code} />
    </li>
  );
}

export default function ProgressionPage(): ReactNode {
  useTitre("Ma progression");
  const progression = useProgression();
  const completedCodes = progression.completedRooms.map((room) => room.code);
  const resources = useProgressionResources(completedCodes);
  const completedSet = useMemo(() => new Set(completedCodes), [completedCodes]);
  const completionByCode = useMemo(
    () => new Map(progression.completedRooms.map((room) => [room.code, room.completedAt])),
    [progression.completedRooms],
  );

  if (progression.completedRooms.length === 0) {
    return (
      <>
        <EntetePage
          titre="Ma progression"
          sousTitre="Enregistrée dans ce navigateur, sans compte."
        />
        {/* UN ETAT VIDE EST UNE INVITATION. Deux liens en fin de paragraphe
            demandaient de lire avant d'agir ; l'illustration montre le chemin
            qui attend, et les deux commandes sont de vrais boutons. */}
        <div className="etat etat--vide progression-vide">
          <CheminEnPointilles />
          <p className="etat__titre">Rien de terminé pour l'instant</p>
          <p className="petit doux progression-vide__texte">
            Cochez une room depuis sa fiche et elle apparaîtra ici, avec votre avancement par
            parcours. Rien ne part sur un serveur : tout reste dans ce navigateur.
          </p>
          <p className="rang progression-vide__actions">
            <Link
              to="/roadmap/$slug"
              params={{ slug: "fondamentaux" }}
              className="bouton bouton--principal"
            >
              Commencer les Fondamentaux
            </Link>
            <Link to="/rooms" className="bouton">
              Explorer le catalogue
            </Link>
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <EntetePage titre="Ma progression" sousTitre="Enregistrée dans ce navigateur, sans compte." />

      {resources.status === "loading" && resources.data === null && (
        <Loading label="Chargement de votre progression" />
      )}
      {resources.status === "error" && resources.data === null && (
        <ErrorState error={resources.error} onRetry={resources.reload} />
      )}

      {resources.data !== null && (
        <>
          <MissingRooms
            codes={resources.data.missing}
            onForget={() => {
              progression.forget(resources.data?.missing ?? []);
            }}
          />
          <ProgressionContent
            resources={resources.data}
            completedSet={completedSet}
            completionByCode={completionByCode}
            stale={resources.status === "loading"}
          />
        </>
      )}
    </>
  );
}

function ProgressionContent({
  resources,
  completedSet,
  completionByCode,
  stale,
}: {
  resources: ProgressionResources;
  completedSet: ReadonlySet<string>;
  completionByCode: ReadonlyMap<string, string>;
  stale: boolean;
}): ReactNode {
  const progression = useProgression();
  const completedRooms = resources.rooms.filter((room) => completedSet.has(room.code));
  // Les totaux comptent chaque room UNE fois, meme si elle apparait dans deux
  // groupes plus bas : la duplication est un fait d'affichage, pas de comptage.
  const summary = summarizeCompletedRooms(completedRooms);
  const groupes = grouperParParcours(
    completedRooms,
    completionByCode,
    resources.tracks.map((track) => track.data),
  );

  // L'anneau global agrege les trois parcours : c'est la meme question que sur
  // une page de parcours, posee une fois pour tout le produit.
  const global = resources.tracks.reduce(
    (total, { data: track }) => {
      const avancement = computeTrackProgress(track.steps, completedSet);
      return {
        faits: total.faits + avancement.coreDone,
        total: total.total + avancement.coreTotal,
      };
    },
    { faits: 0, total: 0 },
  );
  const pourcentGlobal = global.total === 0 ? 0 : Math.round((global.faits / global.total) * 100);

  return (
    <div className={`grille-page${stale ? " perime" : ""}`}>
      <div className="colonne-principale">
        <section className="progression-section">
          <h2>Avancement par parcours</h2>
          <ul className="progression-parcours">
            {resources.tracks.map(({ data: track }) => {
              const trackProgress = computeTrackProgress(track.steps, completedSet);
              return (
                <li key={track.slug}>
                  <div className="rang progression-parcours__ligne">
                    <Link to="/roadmap/$slug" params={{ slug: track.slug }}>
                      {track.title}
                    </Link>
                    <strong>{trackProgress.percent} %</strong>
                  </div>
                  <ProgressBar
                    faits={trackProgress.coreDone}
                    total={trackProgress.coreTotal}
                    pourcent={trackProgress.percent}
                  />
                  <p className="petit doux">
                    {trackProgress.coreDone} sur {trackProgress.coreTotal} rooms recommandées
                    {(() => {
                      const suite = nextStepPosition(trackProgress);
                      const etape = track.steps.find((step) => step.position === suite);
                      return etape === undefined ? " — terminé" : ` — suite : ${etape.title}`;
                    })()}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        {/*
        GROUPEES PAR PARCOURS, chaque groupe dans l'ordre du parcours.

        Le produit vend un parcours, pas un journal. Trier la page par date
        repond a « qu'ai-je fait recemment » ; la question du debutant est « ou
        j'en suis, c'est quoi la suite ». Ce qui n'appartient a aucun parcours
        garde le tri par date, parce que la il n'y a pas d'autre ordre a suivre.
      */}
        {groupes.parcours.map((groupe) => (
          <section className="progression-section" key={groupe.slug}>
            <h2>
              <Link to="/roadmap/$slug" params={{ slug: groupe.slug }}>
                {groupe.titre}
              </Link>
            </h2>
            <ul className="progression-rooms">
              {groupe.rooms.map((terminee) => (
                <CompletedRoomRow
                  key={terminee.room.code}
                  room={terminee.room}
                  completedAt={terminee.completedAt}
                />
              ))}
            </ul>
          </section>
        ))}

        <GroupesHorsParcours groupes={groupes} />
      </div>

      <aside className="colonne-laterale" aria-label="Vos totaux">
        <div className="panneau suivi">
          <h2 className="panneau__titre">Vos totaux</h2>
          <AnneauProgression pourcent={pourcentGlobal} faits={global.faits} total={global.total} />
          <p className="suivi__reste">
            <strong>{summary.roomCount}</strong> room{summary.roomCount > 1 ? "s" : ""} terminée
            {summary.roomCount > 1 ? "s" : ""},{" "}
            <strong>{formatDuration(summary.totalMinutes)}</strong> cumulées
          </p>
          {summary.unknownDurationCount > 0 && (
            <p className="petit doux">
              {summary.unknownDurationCount} room
              {summary.unknownDurationCount > 1 ? "s ont" : " a"} une durée non renseignée et
              {summary.unknownDurationCount > 1 ? " ne sont" : " n'est"} pas incluse
              {summary.unknownDurationCount > 1 ? "s" : ""} dans le total.
            </p>
          )}

          {/* ZONE SECONDAIRE. Exporter et effacer ne sont pas ce qu'on vient
              faire ici : elles sont accessibles, en bas, separees par un trait,
              et l'effacement demande une confirmation. */}
          <div className="zone-secondaire">
            <ProgressionDownloadLink completedRooms={progression.completedRooms} />
            <ReinitialiserProgression
              codes={progression.completedRooms.map((faite) => faite.code)}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}

/**
 * Effacement de la progression.
 *
 * DEUX TEMPS, PAS UNE BOITE DE DIALOGUE. `confirm()` bloque le fil, n'est pas
 * stylable et se fait bloquer par certains navigateurs. Le bouton se transforme
 * en question, et la reponse est un second clic — annulable.
 */
function ReinitialiserProgression({ codes }: { codes: readonly string[] }): ReactNode {
  const progression = useProgression();
  const [confirme, setConfirme] = useState(false);

  if (!confirme) {
    return (
      <Button variante="discret" onClick={() => setConfirme(true)}>
        Effacer ma progression
      </Button>
    );
  }

  return (
    <div className="rang">
      <Button
        onClick={() => {
          progression.forget(codes);
          setConfirme(false);
        }}
      >
        Effacer les {codes.length} rooms
      </Button>
      <Button variante="discret" onClick={() => setConfirme(false)}>
        Annuler
      </Button>
    </div>
  );
}

function GroupesHorsParcours({
  groupes,
}: {
  groupes: ReturnType<typeof grouperParParcours>;
}): ReactNode {
  return (
    <>
      {groupes.horsParcours.length > 0 && (
        <section className="progression-section">
          <h2>Hors parcours</h2>
          <p className="petit doux">
            Des rooms choisies librement dans le catalogue, de la plus recente a la plus ancienne.
          </p>
          <ul className="progression-rooms">
            {groupes.horsParcours.map((terminee) => (
              <CompletedRoomRow
                key={terminee.room.code}
                room={terminee.room}
                completedAt={terminee.completedAt}
              />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
