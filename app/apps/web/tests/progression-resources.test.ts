import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { MAX_BATCH_CODES } from "@thm/shared";
import { chunkCodes, loadProgressionResources } from "../src/api.js";

/**
 * Le decoupage du lot, verifie par le comportement : ce qui part sur le reseau
 * et ce qui revient a l'appelant.
 *
 * Le defaut corrige ici n'etait pas theorique. Le point d'entree accepte 200
 * codes ; le front envoyait la totalite. Mesure avant correction : 400 codes
 * rendaient HTTP 400, donc toute progression depassant 200 rooms terminees
 * affichait une page en erreur. Le catalogue en compte 714.
 *
 * Les tests portent donc sur le CATALOGUE ENTIER, pas sur un seuil intermediaire :
 * 714 est la seule borne qui garantisse qu'aucun utilisateur ne peut la depasser.
 */

const TOTAL_CATALOGUE = 714;

/** Tranches attendues pour 714 codes : 200 + 200 + 200 + 114. */
const TRANCHES_ATTENDUES = 4;

type Appel = Readonly<{ url: string; codes: readonly string[] }>;

function codesFactices(total: number): readonly string[] {
  return Array.from({ length: total }, (_, index) => `ROOM-${String(index).padStart(4, "0")}`);
}

function roomBrief(code: string): unknown {
  return {
    code,
    title: `Titre ${code}`,
    difficulty: { key: "easy", label: "Facile", level: 1 },
    type: { key: "walkthrough", label: "Walkthrough" },
    durationMinutes: 30,
    thmUrl: `https://tryhackme.com/room/${code}`,
    isActive: true,
  };
}

function reponse(corps: unknown): Response {
  return new Response(JSON.stringify(corps), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const fetchOriginal = globalThis.fetch;

/**
 * Serveur simule.
 *
 * Il rend chaque tranche dans l'ORDRE INVERSE de la demande. Le vrai point
 * d'entree trie par `lower(title), code`, donc dans un ordre qui n'est pas celui
 * de la demande : une recomposition qui se contenterait de concatener les
 * tranches rendrait cet ordre-la, et le test doit le faire tomber.
 */
function installerServeur(codesInconnus: ReadonlySet<string> = new Set()): readonly Appel[] {
  const appels: Appel[] = [];

  globalThis.fetch = (entree: string | URL | Request): Promise<Response> => {
    const url = typeof entree === "string" ? entree : entree.toString();

    if (url.startsWith("/api/rooms/batch")) {
      const codes = new URL(url, "http://local").searchParams.getAll("code");
      appels.push({ url, codes });
      const connus = codes.filter((code) => !codesInconnus.has(code));
      return Promise.resolve(
        reponse({
          rooms: connus.toReversed().map(roomBrief),
          missing: codes.filter((code) => codesInconnus.has(code)),
        }),
      );
    }

    if (url === "/api/tracks") {
      appels.push({ url, codes: [] });
      return Promise.resolve(reponse({ data: [], disclaimer: "" }));
    }

    throw new Error(`URL non prevue par le serveur simule : ${url}`);
  };

  return appels;
}

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

describe("decoupage du lot", () => {
  it("decoupe le catalogue entier en tranches que l'API accepte", async () => {
    const codes = codesFactices(TOTAL_CATALOGUE);
    const appels = installerServeur();

    await loadProgressionResources(codes, new AbortController().signal);

    const lots = appels.filter((appel) => appel.url.startsWith("/api/rooms/batch"));
    // Le compte est ECRIT, pas derive de MAX_BATCH_CODES : une borne portee a
    // 100000 rendrait une seule requete, le serveur repondrait 400, et un test
    // qui calcule ses attentes a partir de la borne resterait vert.
    assert.equal(lots.length, TRANCHES_ATTENDUES);
    for (const lot of lots) {
      assert.ok(
        lot.codes.length <= MAX_BATCH_CODES,
        `tranche de ${lot.codes.length} codes, au-dela de ${MAX_BATCH_CODES}`,
      );
    }
    assert.deepEqual(
      lots.map((lot) => lot.codes.length),
      [200, 200, 200, 114],
    );
  });

  it("ne perd aucun code : rooms et missing recomposent exactement la demande", async () => {
    const codes = codesFactices(TOTAL_CATALOGUE);
    // Un inconnu dans chaque tranche, dont la derniere, qui est partielle.
    const inconnus = new Set([codes[3], codes[250], codes[401], codes[713]] as string[]);
    installerServeur(inconnus);

    const ressources = await loadProgressionResources(codes, new AbortController().signal);

    assert.equal(ressources.rooms.length + ressources.missing.length, TOTAL_CATALOGUE);
    assert.deepEqual([...ressources.missing], [codes[3], codes[250], codes[401], codes[713]]);
  });

  it("rend les rooms dans l'ordre demande, quel que soit l'ordre des tranches", async () => {
    const codes = codesFactices(TOTAL_CATALOGUE);
    installerServeur();

    const ressources = await loadProgressionResources(codes, new AbortController().signal);

    assert.deepEqual(
      ressources.rooms.map((room) => room.code),
      [...codes],
    );
  });

  it("place les codes manquants dans l'ordre demande, pas dans l'ordre des tranches", async () => {
    const codes = codesFactices(TOTAL_CATALOGUE);
    const demande = [codes[500], codes[10], codes[300], codes[1]] as string[];
    installerServeur(new Set([codes[500], codes[10]] as string[]));

    const ressources = await loadProgressionResources(demande, new AbortController().signal);

    assert.deepEqual([...ressources.missing], [codes[500], codes[10]]);
    assert.deepEqual(
      ressources.rooms.map((room) => room.code),
      [codes[300], codes[1]],
    );
  });

  it("n'envoie qu'une requete quand la progression tient dans une tranche", async () => {
    const appels = installerServeur();

    await loadProgressionResources(codesFactices(MAX_BATCH_CODES), new AbortController().signal);

    assert.equal(appels.filter((appel) => appel.url.startsWith("/api/rooms/batch")).length, 1);
  });

  it("n'appelle pas le lot quand la progression est vide", async () => {
    const appels = installerServeur();

    const ressources = await loadProgressionResources([], new AbortController().signal);

    assert.equal(appels.filter((appel) => appel.url.startsWith("/api/rooms/batch")).length, 0);
    assert.deepEqual([...ressources.rooms], []);
    assert.deepEqual([...ressources.missing], []);
  });

  it("ne demande pas deux fois le meme code, meme a cheval sur deux tranches", async () => {
    const codes = codesFactices(TOTAL_CATALOGUE);
    const demande = [...codes, codes[0], codes[250]] as string[];
    installerServeur();

    const ressources = await loadProgressionResources(demande, new AbortController().signal);

    assert.equal(ressources.rooms.length, TOTAL_CATALOGUE);
    const uniques = new Set(ressources.rooms.map((room) => room.code));
    assert.equal(uniques.size, TOTAL_CATALOGUE);
  });
});

describe("chunkCodes", () => {
  it("ne produit aucune tranche vide", () => {
    for (const total of [0, 1, MAX_BATCH_CODES, MAX_BATCH_CODES + 1, TOTAL_CATALOGUE]) {
      for (const tranche of chunkCodes(codesFactices(total))) {
        assert.ok(tranche.length > 0);
      }
    }
  });

  it("conserve tous les codes, dans l'ordre, une seule fois", () => {
    const codes = codesFactices(TOTAL_CATALOGUE);
    assert.deepEqual(chunkCodes(codes).flat(), [...codes]);
  });
});
