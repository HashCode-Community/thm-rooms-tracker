import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RoomBrief, TrackDetail } from "@thm/shared";
import { grouperParParcours, horodatageUtilisable } from "../src/progression-groupes.js";

const MAINTENANT = new Date("2026-09-16T12:00:00.000Z");

function room(code: string): RoomBrief {
  return {
    code,
    title: `Titre ${code}`,
    difficulty: { key: "easy", label: "Facile", level: 1 },
    type: { key: "walkthrough", label: "Guide" },
    durationMinutes: 30,
    thmUrl: `https://tryhackme.com/room/${code}`,
    isActive: true,
  };
}

function parcours(slug: string, etapes: ReadonlyArray<readonly string[]>): TrackDetail {
  return {
    slug,
    title: `Parcours ${slug}`,
    summary: null,
    level: "beginner",
    position: 1,
    stepCount: etapes.length,
    coreRoomCount: etapes.flat().length,
    totalRoomCount: etapes.flat().length,
    estimatedMinutes: 0,
    provenance: { method: "", sources: [], validated_by_completion: false },
    steps: etapes.map((codes, index) => ({
      position: index + 1,
      title: `Etape ${index + 1}`,
      objective: null,
      estimatedMinutes: null,
      rooms: codes.map((code) => ({
        code,
        title: `Titre ${code}`,
        requirement: "core" as const,
        difficulty: { key: "easy", label: "Facile", level: 1 },
        type: { key: "walkthrough", label: "Guide" },
        durationMinutes: 30,
        note: null,
      })),
    })),
  } as TrackDetail;
}

const dates = (codes: ReadonlyArray<readonly [string, string]>): ReadonlyMap<string, string> =>
  new Map(codes);

describe("regroupement de la progression", () => {
  it("groupe par parcours, chaque groupe dans l'ordre du parcours", () => {
    // Les rooms arrivent dans le desordre : c'est l'ordre du PARCOURS qui decide,
    // pas celui de la reponse du serveur ni celui du cochage.
    const rooms = [room("c"), room("a"), room("b")];
    const groupes = grouperParParcours(
      rooms,
      dates([
        ["a", "2026-09-01T10:00:00.000Z"],
        ["b", "2026-09-10T10:00:00.000Z"],
        ["c", "2026-09-05T10:00:00.000Z"],
      ]),
      [parcours("socle", [["a", "b"], ["c"]])],
      MAINTENANT,
    );

    assert.equal(groupes.parcours.length, 1);
    assert.deepEqual(
      groupes.parcours[0]?.rooms.map((r) => r.room.code),
      ["a", "b", "c"],
    );
    assert.deepEqual([...groupes.horsParcours], []);
  });

  it("une room dans DEUX parcours apparait dans les deux groupes", () => {
    const groupes = grouperParParcours(
      [room("commune")],
      dates([["commune", "2026-09-01T10:00:00.000Z"]]),
      [parcours("rouge", [["commune"]]), parcours("bleu", [["commune"]])],
      MAINTENANT,
    );

    assert.deepEqual(
      groupes.parcours.map((g) => g.slug),
      ["rouge", "bleu"],
    );
    for (const groupe of groupes.parcours) {
      assert.deepEqual(
        groupe.rooms.map((r) => r.room.code),
        ["commune"],
      );
    }
    // Duplication d'AFFICHAGE seulement : elle n'est pas comptee deux fois
    // ailleurs, et elle ne tombe pas en « hors parcours ».
    assert.deepEqual([...groupes.horsParcours], []);
  });

  it("une room a deux etapes du MEME parcours n'apparait qu'une fois", () => {
    const groupes = grouperParParcours(
      [room("revue")],
      dates([["revue", "2026-09-01T10:00:00.000Z"]]),
      [parcours("socle", [["revue"], ["revue"]])],
      MAINTENANT,
    );

    assert.deepEqual(
      groupes.parcours[0]?.rooms.map((r) => r.room.code),
      ["revue"],
    );
  });

  it("ce qui n'appartient a aucun parcours est trie par date decroissante", () => {
    const groupes = grouperParParcours(
      [room("vieille"), room("recente"), room("moyenne")],
      dates([
        ["vieille", "2026-09-01T10:00:00.000Z"],
        ["moyenne", "2026-09-05T10:00:00.000Z"],
        ["recente", "2026-09-10T10:00:00.000Z"],
      ]),
      [],
      MAINTENANT,
    );

    assert.deepEqual(
      groupes.horsParcours.map((r) => r.room.code),
      ["recente", "moyenne", "vieille"],
    );
  });

  it("un parcours dont aucune room n'est terminee ne produit pas de groupe vide", () => {
    const groupes = grouperParParcours(
      [room("a")],
      dates([["a", "2026-09-01T10:00:00.000Z"]]),
      [parcours("fait", [["a"]]), parcours("intouche", [["z"]])],
      MAINTENANT,
    );

    assert.deepEqual(
      groupes.parcours.map((g) => g.slug),
      ["fait"],
    );
  });
});

describe("horloge decalee", () => {
  it("accepte une petite avance : un decalage de quelques minutes est banal", () => {
    assert.equal(horodatageUtilisable("2026-09-16T13:00:00.000Z", MAINTENANT), true);
    assert.equal(horodatageUtilisable("2026-09-17T11:59:00.000Z", MAINTENANT), true);
  });

  it("refuse une avance de plus de 24 heures", () => {
    assert.equal(horodatageUtilisable("2026-09-17T12:01:00.000Z", MAINTENANT), false);
    // Le cas reel : une machine reglee sur la mauvaise annee.
    assert.equal(horodatageUtilisable("2027-01-01T00:00:00.000Z", MAINTENANT), false);
  });

  it("accepte tout le passe, meme lointain", () => {
    assert.equal(horodatageUtilisable("2019-01-01T00:00:00.000Z", MAINTENANT), true);
  });

  it("un horodatage futur ne remonte PAS en tete du tri", () => {
    const groupes = grouperParParcours(
      [room("futur"), room("recente"), room("vieille")],
      dates([
        ["futur", "2027-01-01T00:00:00.000Z"],
        ["recente", "2026-09-10T10:00:00.000Z"],
        ["vieille", "2026-09-01T10:00:00.000Z"],
      ]),
      [],
      MAINTENANT,
    );

    assert.deepEqual(
      groupes.horsParcours.map((r) => r.room.code),
      ["recente", "vieille", "futur"],
    );
  });

  it("sa date n'est pas affichable, et elle n'est pas effacee du stockage", () => {
    const completions = dates([["futur", "2027-01-01T00:00:00.000Z"]]);
    const groupes = grouperParParcours([room("futur")], completions, [], MAINTENANT);

    assert.equal(groupes.horsParcours[0]?.completedAt, null);
    // La source n'a pas ete touchee : on n'affiche pas, on ne corrige pas.
    assert.equal(completions.get("futur"), "2027-01-01T00:00:00.000Z");
  });

  it("plusieurs horodatages inutilisables gardent un ordre stable", () => {
    const groupes = grouperParParcours(
      [room("zz"), room("aa")],
      dates([
        ["zz", "2027-01-01T00:00:00.000Z"],
        ["aa", "2028-01-01T00:00:00.000Z"],
      ]),
      [],
      MAINTENANT,
    );

    assert.deepEqual(
      groupes.horsParcours.map((r) => r.room.code),
      ["aa", "zz"],
    );
  });
});
