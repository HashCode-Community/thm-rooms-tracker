import { Link } from "@tanstack/react-router";
import type { StepProgress, TrackRoom, TrackStep } from "@thm/shared";
import type { ReactNode } from "react";
import { RoomCompletionControl } from "../progression.js";
import { DifficultyBadge, formatDuration, TypeBadge } from "./badges.js";
import { Callout } from "./ui/index.js";

/**
 * Le parcours rendu comme un CHEMIN.
 *
 * Trois parcours, vingt-deux etapes : c'est une carte, pas une liste. C'est la
 * seule chose qui distingue ce produit d'un annuaire, et elle doit se voir en
 * trois secondes.
 *
 * LA VARIABLE VISUELLE PRINCIPALE EST L'ETAT DE PROGRESSION, pas la difficulte.
 * Mesure sur le dataset : 87,7 % des rooms sont `easy` ou `medium`. Un chemin
 * colore par la difficulte serait donc quasi monochrome, et la couleur
 * n'informerait de rien. La difficulte descend au rang de pastille secondaire.
 *
 * COLONNE VERTICALE A TOUTES LES LARGEURS. L'epine a gauche, les etapes
 * empilees. Les paliers superieurs elargissent, ils ne reorganisent pas : une
 * carte horizontale casse a 360 px, et le public vise est majoritairement sur
 * mobile.
 */

export type EtatEtape = "faite" | "prochaine" | "a-venir";

export function etatDeLEtape(
  progress: StepProgress | undefined,
  prochaine: number | null,
): EtatEtape {
  if (progress?.complete === true) return "faite";
  if (progress !== undefined && progress.position === prochaine) return "prochaine";
  return "a-venir";
}

/**
 * Seules les rooms QUI NE SONT PAS le coeur portent un libelle.
 *
 * « Recommandee » s'affichait sur 17 rooms sur 17 : un badge que tout le monde
 * porte n'informe personne, il occupe la premiere place de chaque ligne et
 * repousse la difficulte. Le defaut est d'etre recommandee ; ce qui merite d'etre
 * dit, c'est l'ecart.
 */
const LIBELLE_HORS_SOCLE: Readonly<Record<string, string>> = {
  optional: "Optionnelle",
  bonus: "Bonus",
};

/**
 * Une room du chemin.
 *
 * L'etat de completion ouvre la ligne, avant le titre : c'est ce qu'on vient
 * chercher. La bascule est en fin de ligne, avec une zone tactile de 44 px
 * obtenue par EXTENSION, pas par agrandissement du dessin — la zone cliquable
 * n'a pas a avoir la taille de ce qu'on voit.
 */
function RoomDuChemin({ room, terminee }: { room: TrackRoom; terminee: boolean }): ReactNode {
  return (
    <li className={`chemin-room${terminee ? " chemin-room--faite" : ""}`}>
      <div className="chemin-room__ligne">
        <Link to="/rooms/$code" params={{ code: room.code }} className="chemin-room__titre">
          {room.title}
        </Link>
        <RoomCompletionControl code={room.code} presentation="checkbox" />
      </div>

      <div className="chemin-room__meta">
        {room.requirement !== "core" && (
          <span className="badge badge--neutre">{LIBELLE_HORS_SOCLE[room.requirement]}</span>
        )}
        <DifficultyBadge difficulty={room.difficulty} />
        <TypeBadge type={room.type} />
        <span className="petit doux">{formatDuration(room.durationMinutes)}</span>
      </div>

      {/* Jamais repliee : plusieurs notes signalent que la suite d'une serie est
          payante, et c'est souvent l'information la plus utile de l'etape. */}
      {room.note !== null && <NoteDeRoom note={room.note} />}
    </li>
  );
}

/**
 * La note d'une room, et son avertissement s'il y en a un.
 *
 * Certaines notes commencent par « ATTENTION : » — la seule facon qu'avait le
 * contenu editorial de crier dans du texte brut. Ce cri devient un encart : le
 * ton porte l'alerte, le titre la nomme, et les capitales disparaissent. Ecrire
 * en majuscules est le dernier recours de qui n'a pas de composant.
 */
function NoteDeRoom({ note }: { note: string }): ReactNode {
  const alerte = /attention\s*:/i.test(note);
  if (!alerte) return <p className="chemin-room__note">{note}</p>;

  const texte = note.replace(/attention\s*:\s*/i, "").trim();
  return (
    <Callout ton="alerte" titre="À savoir avant de commencer">
      <p className="petit">{texte}</p>
    </Callout>
  );
}

const ETAT_LIBELLE: Readonly<Record<EtatEtape, string>> = {
  faite: "Étape terminée",
  prochaine: "Prochaine étape",
  "a-venir": "Étape à venir",
};

export function EtapeDuChemin({
  step,
  progress,
  etat,
  completedCodes,
}: {
  step: TrackStep;
  progress: StepProgress | undefined;
  etat: EtatEtape;
  completedCodes: ReadonlySet<string>;
}): ReactNode {
  const faits = progress?.coreDone ?? 0;
  const total = progress?.coreTotal ?? 0;

  return (
    <li className={`chemin__etape chemin__etape--${etat}`} id={`etape-${step.position}`}>
      {/*
        La marque porte l'etat par sa FORME autant que par sa couleur : pleine
        et cochee quand c'est fait, cerclee quand c'est la suite, vide sinon.
        Le libelle d'etat est lu par les lecteurs d'ecran dans tous les cas.
      */}
      <div className="chemin__marque" aria-hidden="true">
        {etat === "faite" ? "✓" : step.position}
      </div>

      {/* UNE ETAPE TERMINEE SE REPLIE. Sur un parcours de huit etapes, celles
          qui sont faites poussent la suivante hors de l'ecran — or c'est la
          suivante qu'on vient voir. Repliee, l'etape garde son resume et se
          rouvre d'un clic. `<details>` natif : clavier, annonce et recherche de
          page fonctionnent sans qu'on ait rien a ecrire. */}
      <details className="chemin__corps" open={etat !== "faite"}>
        <summary className="chemin__entete">
          <h2 className="chemin__titre">
            <span className="visuellement-cache">
              Étape {step.position}, {ETAT_LIBELLE[etat]} :{" "}
            </span>
            {step.title}
          </h2>
          {etat === "prochaine" && <span className="chemin__marqueur">Prochaine étape</span>}
          {etat === "faite" && (
            <span className="chemin__marqueur chemin__marqueur--faite">Terminée</span>
          )}
        </summary>

        {step.objective !== null && <p className="doux">{step.objective}</p>}

        <p className="petit doux chemin__compteur">
          {total === 0
            ? "Aucune room recommandée à cette étape"
            : `${faits} sur ${total} room${total > 1 ? "s" : ""} recommandée${total > 1 ? "s" : ""}`}
          {step.estimatedMinutes !== null && ` — ${formatDuration(step.estimatedMinutes)}`}
        </p>

        <ul className="chemin__rooms">
          {step.rooms.map((room) => (
            <RoomDuChemin key={room.code} room={room} terminee={completedCodes.has(room.code)} />
          ))}
        </ul>
      </details>
    </li>
  );
}

/**
 * Squelette du chemin, AUX DIMENSIONS DU CONTENU REEL.
 *
 * Trois etapes de la hauteur qu'auront les vraies, epine comprise. Un squelette
 * generique de trois barres a 60 / 85 / 40 % garantit au contraire un decalage
 * de mise en page au moment ou les donnees arrivent, c'est-a-dire la seule chose
 * qu'un squelette existe pour eviter.
 */
export function CheminEnChargement(): ReactNode {
  return (
    <div className="chemin-squelette" aria-busy="true" aria-live="polite">
      <span className="visuellement-cache">Chargement du parcours</span>
      <ol className="chemin">
        {[1, 2, 3].map((position) => (
          <li key={position} className="chemin__etape chemin__etape--a-venir">
            <div className="chemin__marque" aria-hidden="true">
              {position}
            </div>
            <div className="chemin__corps">
              <div className="squelette squelette--titre" />
              <div className="squelette squelette--ligne" />
              <div className="squelette squelette--room" />
              <div className="squelette squelette--room" />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
