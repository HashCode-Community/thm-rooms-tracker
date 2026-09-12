import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../../src/db/client.js";
import { tracks } from "../../src/db/schema.js";
import type { TrackFile } from "../../src/scripts/roadmap-source.js";
import {
  checkTrackCoherence,
  citedRoomCodes,
  loadTrackFiles,
  RoadmapSourceError,
} from "../../src/scripts/roadmap-source.js";
import { applyTracks, resolveCitedRooms } from "../../src/scripts/roadmap-write.js";
import { assertDatabaseReady, buildTestApp, closeDatabase } from "./harness.js";

/**
 * Parcours : chargement, refus, ecriture, exposition.
 *
 * Ces tests SEMENT des parcours de fixture puis nettoient. Ils ne touchent ni aux
 * rooms, ni aux tags : `tracks` est vide en dehors d'eux, et le contenu editorial
 * reel vit dans `data/roadmap/tracks/`, jamais ici.
 *
 * Les fixtures sont explicitement nommees « fixture » pour que personne ne les
 * confonde un jour avec un parcours du produit.
 */

const FIXTURES = resolve(import.meta.dirname, "../fixtures/roadmap-ok");

let app: FastifyInstance;

beforeAll(async () => {
  await assertDatabaseReady();

  const loaded = loadTrackFiles(FIXTURES);
  const { idByCode, missing, inactive } = await resolveCitedRooms([...citedRoomCodes(loaded)]);
  expect(missing, "les fixtures citent des rooms absentes de la base").toEqual([]);
  expect(inactive, "les fixtures citent des rooms inactives").toEqual([]);
  await applyTracks(loaded, idByCode);

  app = await buildTestApp();
});

afterAll(async () => {
  // La base ne garde aucune trace des fixtures.
  await db.delete(tracks);
  await app.close();
  await closeDatabase();
});

describe("chargement du contenu editorial", () => {
  it("lit les fichiers et les trie par position", () => {
    const loaded = loadTrackFiles(FIXTURES);
    expect(loaded.map((entry) => entry.track.slug)).toEqual(["fixture-alpha", "fixture-beta"]);
  });

  it("un repertoire inexistant echoue, il ne rend pas une liste vide", () => {
    // Silencieusement vide, ce serait un parcours disparu que personne ne voit.
    expect(() => loadTrackFiles(resolve(FIXTURES, "../nexiste-pas"))).toThrow(RoadmapSourceError);
  });

  it("`validated_by_completion` est lu tel quel, jamais suppose", () => {
    const [alpha] = loadTrackFiles(FIXTURES);
    expect(alpha?.track.provenance.validated_by_completion).toBe(false);
  });
});

describe("garde de coherence", () => {
  const base: Omit<TrackFile, "steps"> = {
    slug: "x",
    title: "X",
    level: "beginner",
    position: 1,
    provenance: { method: "test", sources: [], validated_by_completion: false },
  };

  const room = (code: string, requirement: "core" | "optional" = "core") => ({
    code,
    requirement,
  });

  it("refuse deux parcours au meme slug", () => {
    const issues = checkTrackCoherence([
      { file: "a.yaml", track: { ...base, steps: [{ title: "s", rooms: [room("a")] }] } },
      {
        file: "b.yaml",
        track: { ...base, position: 2, steps: [{ title: "s", rooms: [room("b")] }] },
      },
    ]);
    expect(issues.map((issue) => issue.kind)).toContain("slug-duplique");
  });

  it("refuse deux parcours a la meme position", () => {
    const issues = checkTrackCoherence([
      { file: "a.yaml", track: { ...base, steps: [{ title: "s", rooms: [room("a")] }] } },
      {
        file: "b.yaml",
        track: { ...base, slug: "y", steps: [{ title: "s", rooms: [room("b")] }] },
      },
    ]);
    expect(issues.map((issue) => issue.kind)).toContain("position-dupliquee");
  });

  it("refuse une room citee deux fois dans le MEME parcours", () => {
    // Elle compterait deux fois au denominateur et une seule au numerateur.
    const issues = checkTrackCoherence([
      {
        file: "a.yaml",
        track: {
          ...base,
          steps: [
            { title: "s1", rooms: [room("a")] },
            { title: "s2", rooms: [room("a")] },
          ],
        },
      },
    ]);
    expect(issues.map((issue) => issue.kind)).toContain("room-dupliquee-dans-parcours");
  });

  it("accepte la MEME room dans DEUX parcours differents", () => {
    // C'est le cas de `cyberkillchainzmt`, present dans Fondamentaux et Blue Team.
    // Interdire ca casserait le contenu editorial.
    const issues = checkTrackCoherence([
      { file: "a.yaml", track: { ...base, steps: [{ title: "s", rooms: [room("partagee")] }] } },
      {
        file: "b.yaml",
        track: {
          ...base,
          slug: "y",
          position: 2,
          steps: [{ title: "s", rooms: [room("partagee")] }],
        },
      },
    ]);
    expect(issues).toEqual([]);
  });

  it("refuse une etape sans aucune room `core`", () => {
    const issues = checkTrackCoherence([
      {
        file: "a.yaml",
        track: { ...base, steps: [{ title: "decorative", rooms: [room("a", "optional")] }] },
      },
    ]);
    expect(issues.map((issue) => issue.kind)).toContain("etape-sans-room-core");
  });
});

describe("GET /api/tracks", () => {
  it("rend les parcours publies avec leur provenance", async () => {
    const response = await app.inject({ method: "GET", url: "/api/tracks" });
    expect(response.statusCode).toBe(200);

    const body = response.json<{
      data: Array<{ slug: string; provenance: { validated_by_completion: boolean } }>;
      disclaimer: string;
    }>();

    expect(body.data.map((track) => track.slug)).toEqual(["fixture-alpha", "fixture-beta"]);
    for (const track of body.data) {
      expect(track.provenance.validated_by_completion).toBe(false);
    }
  });

  it("porte la mention obligatoire dans CHAQUE reponse", async () => {
    // Un client qui consomme l'API sans passer par notre front la recoit aussi.
    for (const url of ["/api/tracks", "/api/tracks/fixture-alpha"]) {
      const response = await app.inject({ method: "GET", url });
      const body = response.json<{ disclaimer: string }>();
      expect(body.disclaimer, url).toContain("n'ont pas ete integralement suivis");
    }
  });

  it("`coreRoomCount` ignore les rooms optionnelles", async () => {
    const response = await app.inject({ method: "GET", url: "/api/tracks" });
    const [alpha] = response.json<{
      data: Array<{ coreRoomCount: number; totalRoomCount: number }>;
    }>().data;

    // La fixture alpha a 3 rooms dont 1 optionnelle.
    expect(alpha).toMatchObject({ coreRoomCount: 2, totalRoomCount: 3 });
  });
});

describe("GET /api/tracks/:slug", () => {
  it("rend les etapes ordonnees et leurs rooms", async () => {
    const response = await app.inject({ method: "GET", url: "/api/tracks/fixture-alpha" });
    expect(response.statusCode).toBe(200);

    const { data } = response.json<{
      data: {
        steps: Array<{
          position: number;
          estimatedMinutes: number | null;
          rooms: Array<{ code: string; requirement: string; note: string | null }>;
        }>;
      };
    }>();

    expect(data.steps.map((step) => step.position)).toEqual([1, 2]);
    expect(data.steps[0]?.rooms.map((room) => room.code)).toEqual(["picklerick", "furthernmap"]);
  });

  it("la duree estimee ne compte que les rooms `core`", async () => {
    const response = await app.inject({ method: "GET", url: "/api/tracks/fixture-alpha" });
    const { data } = response.json<{ data: { steps: Array<{ estimatedMinutes: number }> } }>();

    // Etape 1 : picklerick (30 min, core) + furthernmap (50 min, optional).
    expect(data.steps[0]?.estimatedMinutes).toBe(30);
  });

  it("la `note` est exposee telle quelle", async () => {
    // Plusieurs notes du contenu reel signalent qu'une suite de serie est payante :
    // c'est l'information la plus utile de l'etape, elle ne doit pas se perdre.
    const response = await app.inject({ method: "GET", url: "/api/tracks/fixture-alpha" });
    const { data } = response.json<{
      data: { steps: Array<{ rooms: Array<{ code: string; note: string | null }> }> };
    }>();

    const nmap = data.steps[0]?.rooms.find((room) => room.code === "furthernmap");
    expect(nmap?.note).toBe("La suite de cette serie est payante.");
  });

  it("une room partagee apparait dans les DEUX parcours", async () => {
    const alpha = await app.inject({ method: "GET", url: "/api/tracks/fixture-alpha" });
    const beta = await app.inject({ method: "GET", url: "/api/tracks/fixture-beta" });

    const codes = (raw: string): string[] =>
      JSON.parse(raw).data.steps.flatMap((step: { rooms: Array<{ code: string }> }) =>
        step.rooms.map((room) => room.code),
      );

    expect(codes(alpha.body)).toContain("cyberkillchainzmt");
    expect(codes(beta.body)).toContain("cyberkillchainzmt");
  });

  it("la casse des codes de room survit jusqu'a l'API", async () => {
    const response = await app.inject({ method: "GET", url: "/api/tracks/fixture-beta" });
    const { data } = response.json<{
      data: { steps: Array<{ rooms: Array<{ code: string }> }> };
    }>();
    const codes = data.steps.flatMap((step) => step.rooms.map((room) => room.code));
    expect(codes).toContain("AIforcyber-aoc2025-y9wWQ1zRgB");
  });

  it("un slug inconnu rend 404 en problem+json", async () => {
    const response = await app.inject({ method: "GET", url: "/api/tracks/nexiste-pas" });
    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
  });

  it("un slug de forme impossible rend 400", async () => {
    const response = await app.inject({ method: "GET", url: "/api/tracks/MAJUSCULES" });
    expect(response.statusCode).toBe(400);
  });
});
