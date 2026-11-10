import { describe, expect, it } from "vitest";
import {
  assessImportCorruption,
  DIFFICULTY_SHIFT_THRESHOLD_POINTS,
  MODIFIED_ROOMS_THRESHOLD_PERCENT,
  type ExistingRoomSnapshot,
  type IncomingRoomSnapshot,
} from "../src/scripts/import-guards.js";

function raw(
  code: string,
  difficulty = "easy",
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    code,
    title: `Room ${code}`,
    description: "",
    difficulty,
    type: "walkthrough",
    durationMinutes: 30,
    usersCount: 1,
    publishedAt: "2026-01-01",
    url: `https://tryhackme.com/room/${code}`,
    teams: [],
    skills: [],
    technologies: [],
    tools: [],
    ...overrides,
  };
}

function existing(count: number): ExistingRoomSnapshot[] {
  return Array.from({ length: count }, (_, index) => ({
    code: `room-${index}`,
    isActive: true,
    raw: raw(`room-${index}`),
  }));
}

function incomingFrom(
  rooms: readonly ExistingRoomSnapshot[],
  mutate: (value: Record<string, unknown>, index: number) => Record<string, unknown> = (value) =>
    value,
): IncomingRoomSnapshot[] {
  return rooms.map((room, index) => ({
    code: room.code,
    raw: mutate({ ...(room.raw as Record<string, unknown>) }, index),
  }));
}

describe("garde de corruption des imports", () => {
  it("accepte le seuil de 25 %, puis refuse au-dessus", () => {
    const current = existing(100);
    const incoming = incomingFrom(current);

    const atThreshold = assessImportCorruption(
      current,
      incoming,
      Array.from({ length: 25 }, (_, index) => ({ code: `room-${index}` })),
    );
    const overThreshold = assessImportCorruption(
      current,
      incoming,
      Array.from({ length: 26 }, (_, index) => ({ code: `room-${index}` })),
    );

    expect(MODIFIED_ROOMS_THRESHOLD_PERCENT).toBe(25);
    expect(atThreshold).toMatchObject({ modifiedPercent: 25, suspicious: false });
    expect(overThreshold).toMatchObject({ modifiedPercent: 26, suspicious: true });
  });

  it("detecte une corruption de tags absente des colonnes SQL", () => {
    const current = existing(4);
    const incoming = incomingFrom(current, (value, index) =>
      index === 0 ? { ...value, tools: ["Valeur corrompue"] } : value,
    );

    const assessment = assessImportCorruption(current, incoming, []);

    expect(assessment.modifiedKnownCodes).toEqual(["room-0"]);
    expect(assessment.modifiedPercent).toBe(25);
  });

  it("ignore un simple changement d'ordre des tags", () => {
    const current: ExistingRoomSnapshot[] = [
      {
        code: "a",
        isActive: true,
        raw: raw("a", "easy", { tools: ["Nmap", "Burp Suite"] }),
      },
    ];
    const incoming: IncomingRoomSnapshot[] = [
      {
        code: "a",
        raw: raw("a", "easy", { tools: ["Burp Suite", "Nmap"] }),
      },
    ];

    expect(assessImportCorruption(current, incoming, []).modifiedKnownCodes).toEqual([]);
  });

  it("refuse un deplacement de plus de 10 points dans les difficultes", () => {
    const current: ExistingRoomSnapshot[] = Array.from({ length: 100 }, (_, index) => ({
      code: `room-${index}`,
      isActive: true,
      raw: raw(`room-${index}`, index < 50 ? "easy" : "hard"),
    }));
    const incoming: IncomingRoomSnapshot[] = current.map((room, index) => ({
      code: room.code,
      raw: raw(room.code, index < 35 ? "easy" : "hard"),
    }));

    const assessment = assessImportCorruption(current, incoming, []);

    expect(DIFFICULTY_SHIFT_THRESHOLD_POINTS).toBe(10);
    expect(assessment.suspiciousDifficultyShifts).toEqual([
      { difficulty: "easy", beforePercent: 50, afterPercent: 35, deltaPoints: 15 },
      { difficulty: "hard", beforePercent: 50, afterPercent: 65, deltaPoints: 15 },
    ]);
    expect(assessment.suspicious).toBe(true);
  });

  it("ne bloque pas le premier import dans une base vide", () => {
    const incoming: IncomingRoomSnapshot[] = [
      { code: "a", raw: raw("a", "easy") },
      { code: "b", raw: raw("b", "hard") },
    ];

    expect(assessImportCorruption([], incoming, [])).toMatchObject({
      activeKnownRooms: 0,
      modifiedPercent: 0,
      suspiciousDifficultyShifts: [],
      suspicious: false,
    });
  });
});
