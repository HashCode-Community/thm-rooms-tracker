import { Link } from "@tanstack/react-router";
import type { TrackSummary } from "@thm/shared";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useId, useState } from "react";
import type { AvancementParcours } from "../avancement.js";
import { formatDuration } from "./badges.js";

/**
 * Le graphe des parcours.
 *
 * C'EST LE PRODUIT, DESSINE. L'accueil affirmait « trois chemins » et ne
 * montrait que du texte : le visiteur devait croire sur parole qu'il existait
 * une progression. Ici il la voit — un tronc commun, une bifurcation, des
 * etapes, et sa propre position dessus.
 *
 * Le trace est orthogonal a angles arrondis, pas en courbes libres : c'est le
 * vocabulaire du plan de metro et du circuit imprime, celui d'un outil, pas
 * d'un diagramme de presentation.
 *
 * TOUT VIENT DES DONNEES. Le nombre de points d'une branche est son nombre
 * d'etapes, sa duree est celle de l'API, et les etapes terminees viennent du
 * navigateur. Rien n'est ecrit en dur : un parcours qui gagne une etape gagne un
 * point.
 *
 * Le dessin est DECORATIF au sens de l'accessibilite — `aria-hidden` — et les
 * liens sont de vrais liens HTML poses par-dessus. Un lecteur d'ecran lit trois
 * liens dans l'ordre du chemin, pas une suite de cercles.
 */

type Point = Readonly<{ x: number; y: number }>;

type Segment = Readonly<{
  slug: string;
  titre: string;
  minutes: number;
  chemin: string;
  points: readonly Point[];
  faites: readonly boolean[];
  /** Position du libelle, dans le repere du dessin. */
  ancre: Point;
  /** Rang de dessin : le tronc d'abord, les branches ensuite. */
  rang: number;
}>;

type Geometrie = Readonly<{ largeur: number; hauteur: number; segments: readonly Segment[] }>;

/** Repartit `nombre` points entre deux bornes, incluses. */
function repartir(debut: number, fin: number, nombre: number): number[] {
  if (nombre <= 1) return [debut];
  const pas = (fin - debut) / (nombre - 1);
  return Array.from({ length: nombre }, (_, index) => debut + index * pas);
}

function faitesDe(avancement: AvancementParcours | undefined, etapes: number): boolean[] {
  return Array.from({ length: etapes }, (_, index) => avancement?.etapes[index] === true);
}

/**
 * Le dessin en large : tronc horizontal, bifurcation en haut et en bas.
 */
function geometrieLarge(
  tronc: TrackSummary,
  haute: TrackSummary,
  basse: TrackSummary,
  avancements: ReadonlyMap<string, AvancementParcours>,
): Geometrie {
  const segment = (
    track: TrackSummary,
    chemin: string,
    xs: number[],
    y: number,
    rang: number,
  ): Segment => ({
    slug: track.slug,
    titre: track.title,
    minutes: track.estimatedMinutes,
    chemin,
    points: xs.map((x) => ({ x, y })),
    faites: faitesDe(avancements.get(track.slug), track.stepCount),
    ancre: { x: xs[0] ?? 0, y },
    rang,
  });

  return {
    largeur: 520,
    hauteur: 400,
    segments: [
      segment(tronc, "M 56 200 H 250", repartir(56, 214, tronc.stepCount), 200, 0),
      segment(
        haute,
        "M 250 200 H 268 Q 288 200 288 180 V 116 Q 288 96 308 96 H 486",
        repartir(320, 478, haute.stepCount),
        96,
        1,
      ),
      segment(
        basse,
        "M 250 200 H 268 Q 288 200 288 220 V 284 Q 288 304 308 304 H 486",
        repartir(320, 478, basse.stepCount),
        304,
        2,
      ),
    ],
  };
}

/**
 * Le dessin en colonne : le tronc descend, une branche part a droite, l'autre
 * continue tout droit. Meme lecture, une main.
 */
function geometrieHaute(
  tronc: TrackSummary,
  haute: TrackSummary,
  basse: TrackSummary,
  avancements: ReadonlyMap<string, AvancementParcours>,
): Geometrie {
  const segment = (
    track: TrackSummary,
    chemin: string,
    x: number,
    ys: number[],
    rang: number,
  ): Segment => ({
    slug: track.slug,
    titre: track.title,
    minutes: track.estimatedMinutes,
    chemin,
    points: ys.map((y) => ({ x, y })),
    faites: faitesDe(avancements.get(track.slug), track.stepCount),
    ancre: { x, y: ys[0] ?? 0 },
    rang,
  });

  return {
    largeur: 320,
    hauteur: 460,
    segments: [
      segment(tronc, "M 48 40 V 168", 48, repartir(40, 158, tronc.stepCount), 0),
      // La branche du milieu DESCEND TOUT DROIT, celle d'apres part a droite :
      // en colonne, on lit de gauche a droite, et l'ordre lu doit etre celui du
      // document et celui des cartes.
      segment(haute, "M 48 168 V 436", 48, repartir(268, 428, haute.stepCount), 1),
      segment(
        basse,
        "M 48 168 V 184 Q 48 204 68 204 H 156 Q 176 204 176 224 V 436",
        176,
        repartir(268, 428, basse.stepCount),
        2,
      ),
    ],
  };
}

/** Vrai en dessous du palier ou le graphe passe en colonne. */
function useColonne(): boolean {
  const [colonne, setColonne] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );

  useEffect(() => {
    const requete = window.matchMedia("(max-width: 767px)");
    const suivre = (evenement: MediaQueryListEvent): void => {
      setColonne(evenement.matches);
    };
    requete.addEventListener("change", suivre);
    return () => {
      requete.removeEventListener("change", suivre);
    };
  }, []);

  return colonne;
}

/**
 * Le point « vous en etes la » : la prochaine etape a faire, sur le premier
 * parcours entame. Sans progression, c'est la premiere etape du tronc — le
 * point de depart, ce qui est exactement ce qu'un nouveau visiteur doit voir.
 */
function pointActuel(
  segments: readonly Segment[],
  avancements: ReadonlyMap<string, AvancementParcours>,
): Point | null {
  for (const segment of segments) {
    const avancement = avancements.get(segment.slug);
    if (avancement === undefined) continue;
    if (avancement.prochaine === null) continue;
    return segment.points[avancement.prochaine - 1] ?? null;
  }
  return avancements.size === 0 ? (segments[0]?.points[0] ?? null) : null;
}

export function GrapheParcours({
  tracks,
  avancements,
}: {
  tracks: readonly TrackSummary[];
  avancements: ReadonlyMap<string, AvancementParcours>;
}): ReactNode {
  const colonne = useColonne();
  const idTitre = useId();
  const idDescription = useId();
  const [tronc, haute, basse] = tracks;
  if (tronc === undefined || haute === undefined || basse === undefined) return null;

  const geometrie = colonne
    ? geometrieHaute(tronc, haute, basse, avancements)
    : geometrieLarge(tronc, haute, basse, avancements);
  const actuel = pointActuel(geometrie.segments, avancements);

  // La description dit CE QUE LE DESSIN MONTRE, avec les vrais chiffres : un
  // tronc commun, deux branches, et le nombre d'etapes de chacune.
  const description =
    `${tronc.title} ouvre le chemin en ${tronc.stepCount} étapes, ` +
    `puis il se sépare en deux : ${haute.title} en ${haute.stepCount} étapes, ` +
    `et ${basse.title} en ${basse.stepCount} étapes.`;

  return (
    <div
      className={`graphe${colonne ? " graphe--colonne" : ""}`}
      style={
        {
          "--largeur-graphe": geometrie.largeur,
          "--hauteur-graphe": geometrie.hauteur,
        } as CSSProperties
      }
    >
      {/* LE DESSIN EST DECRIT, PAS MASQUE. Il portait `aria-hidden` : correct
          tant qu'il ne disait rien de plus que les liens poses dessus, faux des
          qu'il montre une structure — un tronc commun et deux branches. Il
          devient une image titree et decrite ; `role="img"` rend son contenu
          interne presentationnel, donc les cercles ne sont pas enumeres. */}
      <svg
        className="graphe__dessin"
        viewBox={`0 0 ${geometrie.largeur} ${geometrie.hauteur}`}
        role="img"
        aria-labelledby={`${idTitre} ${idDescription}`}
        focusable="false"
      >
        <title id={idTitre}>Les trois parcours et leurs étapes</title>
        <desc id={idDescription}>{description}</desc>
        {geometrie.segments.map((segment) => (
          <g key={segment.slug}>
            {/* `pathLength="1"` : la longueur du trace devient 1 quelle que soit
                sa forme, donc l'animation de dessin s'ecrit en CSS sans mesurer
                le chemin en JavaScript. */}
            <path
              className="graphe__trace"
              d={segment.chemin}
              pathLength={1}
              style={{ "--rang": segment.rang } as CSSProperties}
            />
            {segment.points.map((point, index) => (
              <circle
                key={`${segment.slug}-${point.x}-${point.y}`}
                className={`graphe__etape${segment.faites[index] === true ? " graphe__etape--faite" : ""}`}
                cx={point.x}
                cy={point.y}
                r={5}
                style={{ "--rang": segment.rang, "--index": index } as CSSProperties}
              />
            ))}
          </g>
        ))}

        {actuel !== null && (
          <g className="graphe__ici">
            <circle className="graphe__ici-onde" cx={actuel.x} cy={actuel.y} r={9} />
            <circle className="graphe__ici-coeur" cx={actuel.x} cy={actuel.y} r={5} />
          </g>
        )}
      </svg>

      {/* Les liens sont poses SUR le dessin, en HTML : vrai focus, vraie cible
          tactile, ordre de lecture celui du chemin. */}
      <ul className="graphe__noeuds">
        {geometrie.segments.map((segment) => {
          const avancement = avancements.get(segment.slug);
          return (
            <li
              key={segment.slug}
              className="graphe__noeud"
              style={
                {
                  "--x": `${(segment.ancre.x / geometrie.largeur) * 100}%`,
                  "--y": `${(segment.ancre.y / geometrie.hauteur) * 100}%`,
                  "--rang": segment.rang,
                } as CSSProperties
              }
            >
              <Link to="/roadmap/$slug" params={{ slug: segment.slug }}>
                <span className="graphe__titre">{segment.titre}</span>
                <span className="graphe__meta">
                  {segment.points.length} étapes, {formatDuration(segment.minutes)}
                  {avancement !== undefined && avancement.pourcentage > 0
                    ? `, ${avancement.pourcentage} % fait`
                    : ""}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
