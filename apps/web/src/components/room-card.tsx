import { Link } from "@tanstack/react-router";
import type { RoomSummary } from "@thm/shared";
import type { ReactNode } from "react";
import { DifficultyBadge, formatDuration, formatUsers, TeamBadge, TypeBadge } from "./badges.js";

/**
 * Carte du catalogue.
 *
 * `params={{ code: room.code }}` : le code part TEL QUEL, sans repli de casse.
 * 14 des 714 codes portent des majuscules et l'API les compare a la casse. Un
 * `.toLowerCase()` ici donnerait un 404 sur une room qui existe.
 */
export function RoomCard({ room }: { room: RoomSummary }): ReactNode {
  return (
    <li className="carte">
      <h3 className="carte__titre">
        <Link to="/rooms/$code" params={{ code: room.code }}>
          {room.title}
        </Link>
      </h3>

      <div className="rang">
        <DifficultyBadge difficulty={room.difficulty} />
        <TypeBadge type={room.type} />
        {room.teams.map((team) => (
          <TeamBadge key={team.key} team={team} />
        ))}
      </div>

      {room.description !== null && <p className="carte__resume">{room.description}</p>}

      <div className="carte__pied">
        <span>{formatDuration(room.durationMinutes)}</span>
        <span aria-hidden="true">·</span>
        <span>{formatUsers(room.usersCount)}</span>
      </div>
    </li>
  );
}
