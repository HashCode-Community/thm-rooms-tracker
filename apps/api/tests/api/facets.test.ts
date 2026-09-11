import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EXPECTED } from "../../src/scripts/dataset-analysis.js";
import { assertDatabaseReady, buildTestApp, closeDatabase, EXPECTED_ROOMS } from "./harness.js";

let app: FastifyInstance;

type Counted = { key: string; count: number };
type CountedTag = { slug: string; name: string; count: number };
type Facets = {
  difficulty: Array<Counted & { level: number }>;
  type: Counted[];
  team: Array<Counted & { color: string }>;
  tech: CountedTag[];
  tool: CountedTag[];
  skill: CountedTag[];
};

async function facets(url: string): Promise<Facets> {
  const response = await app.inject({ method: "GET", url });
  expect(response.statusCode).toBe(200);
  return response.json<Facets>();
}

async function totalFor(url: string): Promise<number> {
  const response = await app.inject({ method: "GET", url });
  expect(response.statusCode).toBe(200);
  return response.json<{ pagination: { total: number } }>().pagination.total;
}

const countOf = (list: CountedTag[], slug: string): number =>
  list.find((entry) => entry.slug === slug)?.count ?? -1;

beforeAll(async () => {
  await assertDatabaseReady();
  app = await buildTestApp();
});

afterAll(async () => {
  await app.close();
  await closeDatabase();
});

describe("/api/facets — comptage croise", () => {
  it("sans filtre, les compteurs de difficulte totalisent les 714 rooms", async () => {
    const body = await facets("/api/facets");
    const sum = body.difficulty.reduce((total, entry) => total + entry.count, 0);
    expect(sum).toBe(EXPECTED_ROOMS);
    expect(body.type.reduce((total, entry) => total + entry.count, 0)).toBe(EXPECTED_ROOMS);
  });

  /**
   * LE TEST QUI ATTRAPE LE VERROUILLAGE D'INTERFACE.
   *
   * Le compteur d'une facette se calcule sur l'ensemble filtre par TOUS LES
   * FILTRES SAUF ELLE-MEME. Compte sur l'ensemble entierement filtre, `windows`
   * tomberait a zero des que `linux` est coche, et l'utilisateur ne pourrait plus
   * jamais ajouter une deuxieme technologie : l'interface se verrouille toute
   * seule.
   */
  it("filtrer sur tech=linux laisse un compteur non nul sur windows", async () => {
    const body = await facets("/api/facets?tech=linux");
    expect(countOf(body.tech, "linux")).toBeGreaterThan(0);
    expect(countOf(body.tech, "windows")).toBeGreaterThan(0);
  });

  /**
   * La propriete EXACTE du comptage, enoncee sans approximation.
   *
   * Le compteur affiche a cote d'une valeur non cochee vaut « combien de rooms
   * portent cette valeur, compte tenu des autres facettes » — et non « combien
   * de rooms j'aurais si je la cochais en plus », qui serait l'union et donc un
   * nombre plus grand.
   *
   * Quand `tech` est la seule facette filtree, son propre filtre etant omis, le
   * compteur de `windows` doit donc valoir exactement le total de `?tech=windows`
   * seul. C'est verifiable au nombre pres, contrairement a une inegalite.
   */
  it("le compteur d'une valeur non cochee vaut son total propre", async () => {
    const body = await facets("/api/facets?tech=linux");
    const counted = countOf(body.tech, "windows");
    const alone = await totalFor("/api/rooms?tech=windows&limit=1");
    expect(counted).toBe(alone);
    expect(counted).toBeGreaterThan(0);
  });

  it("cocher la valeur en plus elargit bien, sans depasser la somme", async () => {
    const body = await facets("/api/facets?tech=linux");
    const linuxCount = countOf(body.tech, "linux");
    const windowsCount = countOf(body.tech, "windows");
    const union = await totalFor("/api/rooms?tech=linux&tech=windows&limit=1");

    expect(union).toBeGreaterThanOrEqual(Math.max(linuxCount, windowsCount));
    expect(union).toBeLessThanOrEqual(linuxCount + windowsCount);
  });

  it("la meme regle vaut pour la difficulte", async () => {
    const body = await facets("/api/facets?difficulty=easy");
    const counted = body.difficulty.find((entry) => entry.key === "medium")?.count ?? -1;
    const alone = await totalFor("/api/rooms?difficulty=medium&limit=1");
    expect(counted).toBe(alone);
    expect(counted).toBeGreaterThan(0);
  });

  it("et pour l'equipe", async () => {
    const body = await facets("/api/facets?team=Red");
    const counted = body.team.find((entry) => entry.key === "Blue")?.count ?? -1;
    const alone = await totalFor("/api/rooms?team=Blue&limit=1");
    expect(counted).toBe(alone);
    expect(counted).toBeGreaterThan(0);
  });

  it("un filtre d'UNE AUTRE facette restreint bien le compteur", async () => {
    // Le compteur de `tech` omet `tech`, mais pas `difficulty`.
    const all = await facets("/api/facets");
    const easyOnly = await facets("/api/facets?difficulty=easy");
    expect(countOf(easyOnly.tech, "linux")).toBeLessThanOrEqual(countOf(all.tech, "linux"));
    expect(countOf(easyOnly.tech, "linux")).toBe(
      await totalFor("/api/rooms?difficulty=easy&tech=linux&limit=1"),
    );
  });

  it("la recherche textuelle est prise en compte par tous les compteurs", async () => {
    // `q` n'est pas une facette : il n'est jamais omis.
    const body = await facets("/api/facets?q=nmap");
    const sum = body.difficulty.reduce((total, entry) => total + entry.count, 0);
    const actual = await totalFor("/api/rooms?q=nmap&limit=1");
    expect(sum).toBe(actual);
    expect(sum).toBeLessThan(EXPECTED_ROOMS);
  });

  it("les facettes refusent les memes valeurs invalides que la liste", async () => {
    const response = await app.inject({ method: "GET", url: "/api/facets?difficulty=trivial" });
    expect(response.statusCode).toBe(400);
  });
});

describe("/api/tags", () => {
  it("rend les 296 tags avec leur nombre de rooms", async () => {
    const response = await app.inject({ method: "GET", url: "/api/tags" });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: Array<{ kind: string; slug: string; count: number }> }>();
    expect(body.data).toHaveLength(296);
  });

  it("filtre par `kind` : 14 technologies, 179 outils, 103 competences", async () => {
    for (const [kind, expected] of [
      ["technology", 14],
      ["tool", 179],
      ["skill", 103],
    ] as const) {
      const response = await app.inject({ method: "GET", url: `/api/tags?kind=${kind}` });
      const body = response.json<{ data: unknown[] }>();
      expect(body.data, `kind=${kind}`).toHaveLength(expected);
    }
  });

  it("aucun tag ne porte le suffixe ` NEW` ni `N/A`", async () => {
    const response = await app.inject({ method: "GET", url: "/api/tags" });
    const body = response.json<{ data: Array<{ name: string }> }>();
    const names = body.data.map((tag) => tag.name);
    expect(names.filter((name) => / NEW$/i.test(name))).toEqual([]);
    expect(names).not.toContain("N/A");
  });

  it("le nom d'affichage retenu pour enum4linux est celui du script Perl", async () => {
    const response = await app.inject({ method: "GET", url: "/api/tags?kind=tool" });
    const body = response.json<{ data: Array<{ slug: string; name: string }> }>();
    const entry = body.data.find((tag) => tag.slug === "enum4linux");
    expect(entry?.name).toBe("enum4linux");
    // Les deux variantes source ont bien fusionne : 2 + 1 occurrences.
    expect(entry?.name).not.toBe("Enum4Linux");
  });

  it("les 12 outils de la liste `NE PAS FUSIONNER` sont restes distincts", async () => {
    const response = await app.inject({ method: "GET", url: "/api/tags?kind=tool" });
    const slugs = response.json<{ data: Array<{ slug: string }> }>().data.map((tag) => tag.slug);
    for (const slug of [
      "linpeas",
      "winpeas",
      "lecmd-exe",
      "pecmd-exe",
      "mftcmd-exe",
      "netcat",
      "ncat",
      "dnspy",
      "ilspy",
      "procdot",
      "procmon",
      "ghidra",
      "hydra",
    ]) {
      expect(slugs, slug).toContain(slug);
    }
  });

  it("un `kind` inconnu rend 400", async () => {
    const response = await app.inject({ method: "GET", url: "/api/tags?kind=machins" });
    expect(response.statusCode).toBe(400);
  });
});

describe("/api/categories", () => {
  it("rend une liste vide : rien n'est invente", async () => {
    const response = await app.inject({ method: "GET", url: "/api/categories" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: [] });
  });
});

describe("/api/stats", () => {
  it("reproduit les chiffres de controle du rapport d'audit", async () => {
    const response = await app.inject({ method: "GET", url: "/api/stats" });
    expect(response.statusCode).toBe(200);
    const stats = response.json<{
      rooms: { total: number; withoutTeam: number };
      durationMinutes: { total: number };
      byDifficulty: Array<{ key: string; count: number }>;
      byType: Array<{ key: string; count: number }>;
      byTeam: Array<{ key: string; count: number }>;
      tags: { technology: number; tool: number; skill: number };
    }>();

    // Les attendus viennent d'`EXPECTED`, la meme source que les tests du dataset.
    // Ecrire les chiffres a la main ici ouvrirait une deuxieme verite, qui se
    // mettrait a diverger au premier nouveau scrape.
    expect(stats.rooms.total).toBe(EXPECTED.roomCount);
    expect(stats.rooms.withoutTeam).toBe(EXPECTED.roomsWithoutTeam);
    expect(stats.durationMinutes.total).toBe(EXPECTED.totalDurationMinutes);

    const difficulty = Object.fromEntries(stats.byDifficulty.map((e) => [e.key, e.count]));
    expect(difficulty).toEqual(EXPECTED.difficulty);

    const type = Object.fromEntries(stats.byType.map((e) => [e.key, e.count]));
    expect(type).toEqual(EXPECTED.type);

    const team = Object.fromEntries(stats.byTeam.map((e) => [e.key, e.count]));
    expect(team).toEqual(EXPECTED.team);

    // Les tags, eux, sont POST-mapping : 186 outils bruts moins 7 fusions.
    expect(stats.tags).toEqual({ technology: 14, tool: 179, skill: 103 });
  });
});
