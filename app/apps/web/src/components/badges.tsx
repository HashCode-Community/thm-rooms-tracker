import type { RoomSummary } from "@thm/shared";
import type { CSSProperties, ReactNode } from "react";
import { nombre } from "../nombres.js";

/**
 * Badges de difficulte, de type et d'equipe.
 *
 * REGLE : la couleur n'est jamais le seul porteur d'information. Chaque badge
 * affiche son LIBELLE en toutes lettres. La couleur accelere la lecture pour ceux
 * qui la percoivent ; elle ne conditionne jamais la comprehension, ni pour un
 * daltonien, ni en impression noir et blanc, ni pour un lecteur d'ecran.
 *
 * Les contrastes ne sont PAS affirmes ici. `pnpm contrast` les mesure et fait
 * echouer la construction sous le seuil : recopier des chiffres dans un
 * commentaire, c'est produire une affirmation qui vieillit sans prevenir, et
 * celle qui occupait ces deux lignes decrivait encore le theme clair.
 *
 * `info` n'est pas un cran de difficulte, c'est une autre nature : contour
 * tirete, hors de la rampe de clarte. Voir ADR-0005.
 */

export function DifficultyBadge({
  difficulty,
}: {
  difficulty: RoomSummary["difficulty"];
}): ReactNode {
  return <span className={`badge badge--${difficulty.key}`}>{difficulty.label}</span>;
}

export function TypeBadge({ type }: { type: RoomSummary["type"] }): ReactNode {
  return <span className="badge badge--neutre">{type.label}</span>;
}

export function TeamBadge({ team }: { team: RoomSummary["teams"][number] }): ReactNode {
  // La couleur vient de la base et n'est PAS peinte en aplat : elle est posee
  // comme variable, et la feuille en tire un fond a 12 % et une bordure a 25 %,
  // comme pour les difficultes. Trois aplats satures au milieu de badges a 12 %
  // criaient plus fort que la difficulte, qui est l'information.
  // MIXTE N'A PAS DE TEINTE. Le violet servi par la base est celui que la
  // charte a retire des liens visites, et c'est la seule couleur d'equipe sans
  // equivalent dans la palette : un badge violet au milieu de badges cyan,
  // ambre et orange se lit comme un cran de difficulte de plus. Le libelle
  // porte l'information, comme pour le type.
  if (team.color === null || team.key === "Purple") {
    return <span className="badge badge--neutre">{team.label}</span>;
  }

  return (
    <span
      className="badge badge--equipe"
      style={{ "--couleur-equipe": team.color } as CSSProperties}
    >
      {team.label}
    </span>
  );
}

/**
 * Duree lisible. `null` n'est pas « 0 min », c'est une absence.
 *
 * BASCULE A 120 MINUTES, pas a 60. « 90 min » se compare sans effort a « 45 min »
 * et a « 2 h » ; « 1 h 30 » oblige a reconvertir pour faire la meme comparaison.
 * Au-dela de deux heures l'inverse devient vrai : personne ne se represente
 * « 53 426 minutes », alors que « 890 heures » se saisit d'un coup.
 */
const BASCULE_EN_HEURES = 120;

export function formatDuration(minutes: number | null): string {
  if (minutes === null) return "durée inconnue";
  if (minutes <= BASCULE_EN_HEURES) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest.toString().padStart(2, "0")}`;
}

export function formatUsers(count: number | null): string {
  if (count === null) return "fréquentation inconnue";
  return `${nombre(count)} participants`;
}

export function formatDate(value: string | null): string {
  if (value === null) return "date inconnue";
  const [year, month, day] = value.split("-");
  if (year === undefined || month === undefined || day === undefined) return value;
  return `${day}/${month}/${year}`;
}
