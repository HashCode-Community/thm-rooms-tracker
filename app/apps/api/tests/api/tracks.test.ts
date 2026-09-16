import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../../src/db/client.js";
import { rooms, tracks } from "../../src/db/schema.js";
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
 * Ces tests SEMENT des parcours de fixture, puis rendent la base telle qu'ils
 * l'ont trouvee. `applyTracks` etant un remplacement complet, semer une fixture
 * efface les trois parcours du produit : le `afterAll` n'est pas une politesse,
 * c'est ce qui empeche `pnpm test` de laisser le site sans roadmap.
 *
 * Le contenu editorial reel vit dans `data/roadmap/tracks/` et n'est jamais ecrit
 * ici. Les fixtures sont explicitement nommees « fixture » pour que personne ne
 * les confonde un jour avec un parcours du produit.
 */

const FIXTURES = resolve(import.meta.dirname, "../fixtures/roadmap-ok");

/** Racine du depot : `--dir` du seeder s'y resout, pas au repertoire courant. */
const API_DIR = resolve(import.meta.dirname, "../..");
const FIXTURE_CLE_INCONNUE = resolve(import.meta.dirname, "../fixtures/roadmap-cle-inconnue");

/** Le contenu editorial REEL du produit. Pas une fixture. */
const TRACKS_REELS = resolve(API_DIR, "../../data/roadmap/tracks");

/** Room inseree INACTIVE le temps d'un test, puis supprimee. */
const CODE_INACTIF = "fixture-room-inactive";

const execFileAsync = promisify(execFile);

/**
 * Lance le VRAI script de seed sur un repertoire de fixtures.
 *
 * Un refus teste par appel de fonction prouve que la fonction sait dire non ; il
 * ne prouve pas que le script s'arrete. Ici on verifie le code de sortie ET le
 * texte que l'operateur lira, parce que c'est le texte qui porte la difference
 * entre « faute de frappe » et « room retiree par TryHackMe ».
 */
async function runSeed(fixtureDir: string): Promise<{ code: number; stderr: string }> {
  try {
    await execFileAsync(
      process.execPath,
      [
        // MEME condition que le script `roadmap:seed` du package.json.
        // `@thm/shared` expose son source sous `development` et son artefact
        // construit par defaut : sans ce drapeau, le sous-processus cherche un
        // `dist` qui n'existe pas avant un build, et le test echoue sur
        // ERR_MODULE_NOT_FOUND au lieu du refus qu'il verifie.
        "--conditions=development",
        "--import",
        "tsx",
        "src/scripts/seed-roadmap.ts",
        "--dir",
        fixtureDir,
      ],
      { cwd: API_DIR, env: process.env },
    );
    return { code: 0, stderr: "" };
  } catch (error) {
    const failure = error as { code?: number; stderr?: string };
    return { code: failure.code ?? -1, stderr: failure.stderr ?? "" };
  }
}

let app: FastifyInstance;

/**
 * Les parcours presents AVANT ce fichier de test.
 *
 * `applyTracks` est un remplacement complet : semer une fixture efface les trois
 * parcours du produit. La regle est donc « rendre la base telle qu'on l'a
 * trouvee », pas « imposer un etat » :
 *   - elle avait des parcours  -> on les restaure depuis les YAML, qui font foi ;
 *   - elle n'en avait pas      -> on la laisse vide.
 *
 * Sans ca, `pnpm test` laisserait le site sans roadmap : exactement la
 * disparition silencieuse que le seed bruyant existe pour empecher.
 */
let slugsAvant: string[] = [];

async function slugsEnBase(): Promise<string[]> {
  const lignes = await db.select({ slug: tracks.slug }).from(tracks);
  return lignes.map((ligne) => ligne.slug).sort();
}

beforeAll(async () => {
  await assertDatabaseReady();

  slugsAvant = await slugsEnBase();

  const loaded = loadTrackFiles(FIXTURES);
  const { idByCode, missing, inactive } = await resolveCitedRooms([...citedRoomCodes(loaded)]);
  expect(missing, "les fixtures citent des rooms absentes de la base").toEqual([]);
  expect(inactive, "les fixtures citent des rooms inactives").toEqual([]);
  await applyTracks(loaded, idByCode);

  app = await buildTestApp();
});

afterAll(async () => {
  if (slugsAvant.length > 0) {
    const reel = loadTrackFiles(TRACKS_REELS);
    const { idByCode, missing, inactive } = await resolveCitedRooms([...citedRoomCodes(reel)]);
    if (missing.length > 0 || inactive.length > 0) {
      throw new Error(
        "Restauration des parcours reels impossible : " +
          `${missing.length} code(s) absent(s), ${inactive.length} inactif(s). ` +
          "Relancer `pnpm roadmap:seed` pour le detail.",
      );
    }
    await applyTracks(reel, idByCode);
  } else {
    // La base etait vide de parcours : elle le redevient. Les fixtures ne
    // laissent rien.
    await db.delete(tracks);
  }

  /**
   * La restauration se VERIFIE, elle ne se suppose pas.
   *
   * Sans ce controle, supprimer le bloc ci-dessus laisserait les 22 tests au
   * vert et le site sans roadmap — mesure faite : 3 parcours avant, 0 apres,
   * suite verte. Une remise en etat que rien ne surveille n'est pas une remise
   * en etat, c'est une intention.
   */
  const slugsApres = await slugsEnBase();
  const attendu = slugsAvant.join(", ") || "(aucun)";
  const obtenu = slugsApres.join(", ") || "(aucun)";
  if (attendu !== obtenu) {
    throw new Error(
      "Ce fichier de test n'a pas rendu la base dans l'etat ou il l'a trouvee.\n" +
        `  avant : ${attendu}\n` +
        `  apres : ${obtenu}\n` +
        "Relancer `pnpm roadmap:seed --apply` pour remettre les parcours en base.",
    );
  }

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

  /**
   * Regression du defaut reel : `provenance` etait un `z.object`, qui SUPPRIME
   * une cle inconnue au lieu de la refuser. Les trois parcours du produit ont
   * ete ecrits avec `source:` au singulier et un `review_after:` hors contrat,
   * tous deux manges en silence — `sources` restait vide et le bloc « Sur la
   * base de : » ne s'affichait jamais, pendant que le seed sortait en code 0.
   *
   * Si ce test passe au vert apres un retour a `z.object`, c'est qu'il ne teste
   * plus rien : verifier que le message nomme bien la cle, pas seulement que ca
   * echoue.
   */
  it("refuse une cle inconnue DANS `provenance`, au lieu de l'avaler", () => {
    expect(() => loadTrackFiles(FIXTURE_CLE_INCONNUE)).toThrow(RoadmapSourceError);

    let message = "";
    try {
      loadTrackFiles(FIXTURE_CLE_INCONNUE);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    // Le fichier, le chemin dans le document, et la cle fautive.
    expect(message).toContain("01-fixture.yaml");
    expect(message).toContain("provenance");
    expect(message).toContain("review_after");
  });

  it("les trois parcours du produit chargent, et leur `sources` n'est pas vide", () => {
    // Le contenu editorial reel, pas une fixture. Si quelqu'un reintroduit
    // `source:` au singulier, `sources` retombe a zero et ce test tombe.
    const loaded = loadTrackFiles(TRACKS_REELS);
    expect(loaded.map((entry) => entry.track.slug)).toEqual([
      "fondamentaux",
      "red-team-debutant",
      "blue-team-debutant",
    ]);
    for (const { file, track } of loaded) {
      expect(track.provenance.sources, `${file} : provenance.sources vide`).toHaveLength(3);
    }
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

/**
 * Les deux refus les plus importants du seed, prouves par le VRAI script.
 *
 * Ils n'etaient jusqu'ici verifies que dans le sens passant : le `beforeAll`
 * assert que `missing` et `inactive` sont VIDES. Un garde qu'on n'a jamais vu
 * refuser n'est pas un garde.
 *
 * La distinction entre les deux messages est la valeur testee, pas le fait
 * qu'ils echouent : une faute de frappe se corrige dans le YAML, une room
 * retiree par TryHackMe se remplace par une autre room. Chaque test verifie
 * donc aussi l'ABSENCE du message de l'autre cas.
 */
describe("refus du seed, prouves par le vrai script", () => {
  beforeAll(async () => {
    // Room INACTIVE : invisible du catalogue actif, donc sans effet sur les
    // assertions a 714 des autres fichiers de test, qui tournent en parallele.
    const [modele] = await db
      .select({ difficultyId: rooms.difficultyId, roomTypeId: rooms.roomTypeId })
      .from(rooms)
      .limit(1);
    if (modele === undefined) throw new Error("base vide : lancer `pnpm data:import --apply`");

    await db.insert(rooms).values({
      code: CODE_INACTIF,
      title: "Fixture room inactive",
      difficultyId: modele.difficultyId,
      roomTypeId: modele.roomTypeId,
      thmUrl: `https://tryhackme.com/room/${CODE_INACTIF}`,
      isActive: false,
      raw: {},
    });
  });

  afterAll(async () => {
    await db.delete(rooms).where(eq(rooms.code, CODE_INACTIF));
  });

  it("refuse un `code` ABSENT, et rappelle que la comparaison est sensible a la casse", async () => {
    // La fixture cite `PickleRick` ; la room s'appelle `picklerick`.
    const { code, stderr } = await runSeed("apps/api/tests/fixtures/roadmap-code-absent");

    expect(code, "le seed a accepte un code inexistant").toBe(1);
    expect(stderr).toContain("SEED REFUSE");
    expect(stderr).toContain('absente : "PickleRick"');
    expect(stderr).toContain("SENSIBLE A LA CASSE");
    // Surtout pas le message de l'autre cas : la room n'a pas disparu, elle
    // n'a jamais existe sous cette orthographe.
    expect(stderr).not.toContain("INACTIVES");
  }, 60_000);

  it("refuse un `code` INACTIF, avec un message DISTINCT du code absent", async () => {
    const { code, stderr } = await runSeed("apps/api/tests/fixtures/roadmap-code-inactif");

    expect(code, "le seed a accepte une room inactive").toBe(1);
    expect(stderr).toContain("SEED REFUSE");
    expect(stderr).toContain(`inactive : "${CODE_INACTIF}"`);
    expect(stderr).toContain("disparu du dernier scrape");
    // Ce n'est PAS une faute de frappe : proposer de verifier l'orthographe
    // enverrait l'operateur chercher au mauvais endroit.
    expect(stderr).not.toContain("SENSIBLE A LA CASSE");
  }, 60_000);
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
