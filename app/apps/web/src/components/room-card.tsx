import { Link } from "@tanstack/react-router";
import type { RoomSummary } from "@thm/shared";
import type { ReactNode } from "react";
import { useProgression } from "../progression.js";
import { DifficultyBadge, formatDuration, formatUsers, TeamBadge, TypeBadge } from "./badges.js";

/**
 * Carte du catalogue.
 *
 * `params={{ code: room.code }}` : le code part TEL QUEL, sans repli de casse.
 * 14 des 714 codes portent des majuscules et l'API les compare a la casse. Un
 * `.toLowerCase()` ici donnerait un 404 sur une room qui existe.
 */
export function RoomCard({ room }: { room: RoomSummary }): ReactNode {
  const progression = useProgression();
  const terminee = progression.isCompleted(room.code);

  return (
    <li className={`carte${terminee ? " carte--faite" : ""}`}>
      <h3 className="carte__titre">
        <Link to="/rooms/$code" params={{ code: room.code }}>
          {room.title}
        </Link>
      </h3>

      {/*
        L'ETAT DE PROGRESSION AVANT LA DIFFICULTE. C'est la variable principale
        du produit, et le catalogue etait le dernier endroit a ne pas la montrer :
        on pouvait parcourir 714 rooms sans voir lesquelles etaient deja faites.
        Un LIBELLE, pas seulement une bordure coloree — la couleur ne porte jamais
        seule une information.
      */}
      {terminee && <p className="carte__etat">Terminee</p>}

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
