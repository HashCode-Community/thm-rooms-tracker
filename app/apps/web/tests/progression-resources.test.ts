import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { MAX_BATCH_CODES } from "@thm/shared";
import {
  BATCH_CHUNK_BYTES,
  BATCH_CHUNK_CODES,
  BATCH_URL_BASE,
  chunkCodes,
  loadProgressionResources,
} from "../src/api.js";
import { urls } from "../src/urls.js";

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

/** Tranches attendues pour 714 codes de 9 caracteres : 7 x 100 + 14. */
const TRANCHES_ATTENDUES = 8;

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
        lot.codes.length <= BATCH_CHUNK_CODES,
        `tranche de ${lot.codes.length} codes, au-dela de ${BATCH_CHUNK_CODES}`,
      );
    }
    assert.deepEqual(
      lots.map((lot) => lot.codes.length),
      [100, 100, 100, 100, 100, 100, 100, 14],
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

    await loadProgressionResources(codesFactices(BATCH_CHUNK_CODES), new AbortController().signal);

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

describe("les deux bornes de la tranche", () => {
  /**
   * Le compte SEUL ne borne pas l'URL.
   *
   * Mesure sur le dataset 1.0.0 : une tranche des 100 codes les plus longs fait
   * 3325 octets, et seuls 56 d'entre eux tiennent dans 2048. Un decoupage qui ne
   * compterait que les codes produirait donc des URL qui depassent le budget des
   * qu'un code long apparait — et ca ne casse qu'en production, derriere un proxy,
   * jamais dans ces tests.
   */
  it("aucune URL de tranche ne depasse le budget, quelle que soit la longueur des codes", () => {
    for (const longueur of [4, 13, 44, 120, 300]) {
      const codes = Array.from(
        { length: TOTAL_CATALOGUE },
        (_, index) => `${String(index).padStart(4, "0")}${"X".repeat(Math.max(0, longueur - 4))}`,
      );
      const tranches = chunkCodes(codes);
      for (const tranche of tranches) {
        const url = urls.roomBatch(tranche);
        // Une tranche d'UN SEUL code peut depasser : rien ne peut la reduire.
        if (tranche.length === 1) continue;
        assert.ok(
          url.length <= BATCH_CHUNK_BYTES,
          `URL de ${url.length} octets pour ${tranche.length} codes de ${longueur} ` +
            `caracteres, au-dela du budget de ${BATCH_CHUNK_BYTES}`,
        );
      }
    }
  });

  /**
   * La deuxieme facon de depasser le budget : un prefixe long.
   *
   * Le decoupage ne voit pas l'URL finale, il voit ce que `roomBatch` produit.
   * Un prefixe de deploiement, ou une base d'API, s'ajoute devant sans que le
   * front en sache rien. Le budget doit donc compter le prefixe, et le garde
   * doit couvrir ce cas comme il couvre celui des codes longs.
   */
  it("un prefixe long reduit les tranches au lieu de faire deborder l'URL", () => {
    const codes = codesFactices(TOTAL_CATALOGUE);
    const PREFIXE = 1500;
    const tranches = chunkCodes(codes, PREFIXE);

    for (const tranche of tranches) {
      if (tranche.length === 1) continue;
      const octets = PREFIXE + (urls.roomBatch(tranche).length - BATCH_URL_BASE);
      assert.ok(
        octets <= BATCH_CHUNK_BYTES,
        `URL resolue de ${octets} octets avec un prefixe de ${PREFIXE}`,
      );
    }
    // Et le prefixe COUTE : il y a plus de tranches qu'avec la base par defaut.
    assert.ok(tranches.length > chunkCodes(codes).length);
  });

  it("la base est derivee du constructeur d'URL, jamais recopiee", () => {
    assert.equal(BATCH_URL_BASE, urls.roomBatch([]).length);
  });

  it("la borne CLIENT reste sous la borne SERVEUR", () => {
    // Deux plafonds distincts, et le client ne doit jamais viser celui de l'autre.
    assert.ok(BATCH_CHUNK_CODES < MAX_BATCH_CODES);
    assert.equal(BATCH_CHUNK_CODES, 100);
    assert.equal(MAX_BATCH_CODES, 200);
    assert.equal(BATCH_CHUNK_BYTES, 1900);
  });

  it("un code plus long que le budget forme sa propre tranche, sans boucler", () => {
    const enorme = "Z".repeat(BATCH_CHUNK_BYTES * 2);
    const tranches = chunkCodes([enorme, "court-a", "court-b"]);

    assert.deepEqual(
      tranches.map((tranche) => [...tranche]),
      [[enorme], ["court-a", "court-b"]],
    );
  });

  it("le budget d'octets mord AVANT le compte quand les codes sont longs", () => {
    const longs = Array.from({ length: BATCH_CHUNK_CODES }, (_, i) => `${i}-${"Y".repeat(60)}`);
    const tranches = chunkCodes(longs);

    assert.ok(
      tranches.length > 1,
      `${BATCH_CHUNK_CODES} codes de 60+ caracteres devraient tenir en plusieurs tranches`,
    );
    assert.ok((tranches[0]?.length ?? 0) < BATCH_CHUNK_CODES);
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
