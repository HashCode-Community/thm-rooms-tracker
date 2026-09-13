import type { RoomSummary } from "@thm/shared";
import type { ReactNode } from "react";

/**
 * Badges de difficulte, de type et d'equipe.
 *
 * REGLE : la couleur n'est jamais le seul porteur d'information. Chaque badge
 * affiche son LIBELLE en toutes lettres. La couleur accelere la lecture pour ceux
 * qui la percoivent ; elle ne conditionne jamais la comprehension, ni pour un
 * daltonien, ni en impression noir et blanc, ni pour un lecteur d'ecran.
 *
 * Contrastes verifies : blanc sur les trois couleurs d'equipe donne 6,54 / 6,68 /
 * 7,38 (AA exige 4,5). Texte #111827 sur les fonds de difficulte : 14,8 a 16,2.
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
  return (
    <span className="badge badge--equipe" style={{ background: team.color }}>
      {team.label}
    </span>
  );
}

/** Duree lisible. `null` n'est pas « 0 min », c'est une absence. */
export function formatDuration(minutes: number | null): string {
  if (minutes === null) return "duree inconnue";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest.toString().padStart(2, "0")}`;
}

export function formatUsers(count: number | null): string {
  if (count === null) return "frequentation inconnue";
  return `${count.toLocaleString("fr-FR")} participants`;
}

export function formatDate(value: string | null): string {
  if (value === null) return "date inconnue";
  const [year, month, day] = value.split("-");
  if (year === undefined || month === undefined || day === undefined) return value;
  return `${day}/${month}/${year}`;
}
