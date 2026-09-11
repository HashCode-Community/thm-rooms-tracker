import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SORT_KEYS } from "../../src/schemas/catalog.js";
import { assertDatabaseReady, buildTestApp, closeDatabase, EXPECTED_ROOMS } from "./harness.js";

let app: FastifyInstance;

type RoomSummary = {
  code: string;
  title: string;
  durationMinutes: number | null;
  difficulty: { key: string; level: number };
  type: { key: string };
  teams: Array<{ key: string }>;
  tags: { technology: Array<{ slug: string }>; tool: Array<{ slug: string }> };
};

type RoomList = {
  data: RoomSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  search: { term: string; strategy: string } | null;
};

async function list(url: string): Promise<RoomList> {
  const response = await app.inject({ method: "GET", url });
  expect(response.statusCode).toBe(200);
  return response.json<RoomList>();
}

beforeAll(async () => {
  await assertDatabaseReady();
  app = await buildTestApp();
});

afterAll(async () => {
  await app.close();
  await closeDatabase();
});

describe("/api/rooms — liste et pagination", () => {
  it("sans filtre, rend les 714 rooms actives paginees", async () => {
    const body = await list("/api/rooms");
    expect(body.pagination.total).toBe(EXPECTED_ROOMS);
    expect(body.pagination.limit).toBe(24);
    expect(body.pagination.totalPages).toBe(Math.ceil(EXPECTED_ROOMS / 24));
    expect(body.data).toHaveLength(24);
    expect(body.search).toBeNull();
  });

  it("n'expose ni `id`, ni `raw`, ni `search_vector`", async () => {
    // Regles 1 et 2 de D5, verifiees sur la reponse reelle et non sur l'intention.
    const response = await app.inject({ method: "GET", url: "/api/rooms?limit=100" });
    expect(response.body).not.toMatch(/"raw"/);
    expect(response.body).not.toMatch(/"searchVector"|"search_vector"/);
    for (const room of response.json<RoomList>().data) {
      expect(room).not.toHaveProperty("id");
    }
  });
});

/**
 * LE TEST QUI ATTRAPE LE BUG DE PAGINATION.
 *
 * Un `ORDER BY` sans departage laisse PostgreSQL libre de rendre les ex aequo dans
 * n'importe quel ordre, et cet ordre peut differer d'une requete a l'autre. Avec
 * `LIMIT/OFFSET`, des rooms apparaissent alors deux fois sur deux pages
 * consecutives et d'autres jamais. Cela ne se voit pas sur une page.
 *
 * MESURE sur ce dataset, tri par duree, sept pages de 50 :
 *   sans `, code ASC` : 350 lignes rendues, 276 codes distincts (74 doublons)
 *   avec `, code ASC` : 350 lignes rendues, 350 codes distincts
 *
 * Le defaut n'a donc rien de theorique : c'est le cas majoritaire, parce que 710
 * des 714 rooms sont ex aequo sur la duree.
 */
describe("stabilite de la pagination sur tous les tris", () => {
  it.each(SORT_KEYS)(
    "sort=%s : parcourir toutes les pages rend 714 codes distincts",
    async (sort) => {
      const limit = 100;
      const collected: string[] = [];

      const first = await list(`/api/rooms?sort=${sort}&limit=${limit}&page=1`);
      expect(first.pagination.total).toBe(EXPECTED_ROOMS);
      collected.push(...first.data.map((room) => room.code));

      for (let page = 2; page <= first.pagination.totalPages; page += 1) {
        const body = await list(`/api/rooms?sort=${sort}&limit=${limit}&page=${page}`);
        collected.push(...body.data.map((room) => room.code));
      }

      expect(collected).toHaveLength(EXPECTED_ROOMS);
      expect(new Set(collected).size).toBe(EXPECTED_ROOMS);
    },
    30_000,
  );

  it("la meme page redemandee rend exactement la meme sequence", async () => {
    const url = "/api/rooms?sort=shortest&limit=50&page=4";
    const [first, second, third] = await Promise.all([list(url), list(url), list(url)]);
    const codes = (body: RoomList) => body.data.map((room) => room.code);
    expect(codes(second)).toEqual(codes(first));
    expect(codes(third)).toEqual(codes(first));
  });

  it("les tris ordonnent bien sur leur cle", async () => {
    const shortest = await list("/api/rooms?sort=shortest&limit=100");
    const durations = shortest.data.map((room) => room.durationMinutes ?? Number.MAX_SAFE_INTEGER);
    expect(durations).toEqual([...durations].sort((a, b) => a - b));

    const byDifficulty = await list("/api/rooms?sort=difficulty&limit=100");
    const levels = byDifficulty.data.map((room) => room.difficulty.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));

    // Le comparateur reproduit exactement `ORDER BY lower(title)` : repli en
    // minuscules puis ordre des points de code. Surtout PAS `localeCompare`, qui
    // reintroduirait une collation et ferait passer le test pour de mauvaises
    // raisons — ou echouer pour de mauvaises raisons.
    const alphabetical = await list("/api/rooms?sort=az&limit=100");
    const titles = alphabetical.data.map((room) => room.title);
    const byLowerCase = [...titles].sort((a, b) => {
      const left = a.toLowerCase();
      const right = b.toLowerCase();
      if (left === right) return 0;
      return left < right ? -1 : 1;
    });
    expect(titles).toEqual(byLowerCase);
  });
});

describe("filtres : OU dans une facette, ET entre facettes", () => {
  it("deux valeurs dans la meme facette ELARGISSENT le resultat", async () => {
    const linux = await list("/api/rooms?tech=linux&limit=1");
    const windows = await list("/api/rooms?tech=windows&limit=1");
    const both = await list("/api/rooms?tech=linux&tech=windows&limit=1");

    expect(both.pagination.total).toBeGreaterThanOrEqual(linux.pagination.total);
    expect(both.pagination.total).toBeGreaterThanOrEqual(windows.pagination.total);
    // Un OU, donc au plus la somme (les rooms portant les deux ne comptent qu'une fois).
    expect(both.pagination.total).toBeLessThanOrEqual(
      linux.pagination.total + windows.pagination.total,
    );
  });

  it("deux facettes differentes RESTREIGNENT le resultat", async () => {
    const linux = await list("/api/rooms?tech=linux&limit=1");
    const crossed = await list("/api/rooms?tech=linux&difficulty=easy&limit=1");
    expect(crossed.pagination.total).toBeLessThanOrEqual(linux.pagination.total);
  });

  it("chaque room rendue porte bien le tag filtre", async () => {
    const body = await list("/api/rooms?tech=linux&limit=100");
    for (const room of body.data) {
      expect(room.tags.technology.map((tag) => tag.slug)).toContain("linux");
    }
  });

  it("`?tech[]=` et `?tech=` sont equivalents", async () => {
    const bracket = await list("/api/rooms?tech[]=linux&tech[]=windows&limit=5&sort=az");
    const plain = await list("/api/rooms?tech=linux&tech=windows&limit=5&sort=az");
    expect(bracket.pagination.total).toBe(plain.pagination.total);
    expect(bracket.data.map((room) => room.code)).toEqual(plain.data.map((room) => room.code));
  });

  it("la cle d'equipe est acceptee quelle que soit sa casse", async () => {
    // `Red` en base parce que c'est la valeur du dataset. Replier `red` en entree
    // ne casse rien — contrairement a `rooms.code`, dont la casse part dans une URL.
    const lower = await list("/api/rooms?team=red&limit=1");
    const canonical = await list("/api/rooms?team=Red&limit=1");
    expect(lower.pagination.total).toBe(canonical.pagination.total);
    expect(lower.pagination.total).toBeGreaterThan(0);
  });

  it("le filtre de duree borne des deux cotes", async () => {
    const body = await list("/api/rooms?durationMin=30&durationMax=60&limit=100");
    for (const room of body.data) {
      expect(room.durationMinutes).not.toBeNull();
      expect(room.durationMinutes as number).toBeGreaterThanOrEqual(30);
      expect(room.durationMinutes as number).toBeLessThanOrEqual(60);
    }
  });

  it("un slug inconnu rend zero resultat, pas une erreur", async () => {
    const body = await list("/api/rooms?tool=cet-outil-nexiste-pas");
    expect(body.pagination.total).toBe(0);
    expect(body.pagination.totalPages).toBe(0);
    expect(body.data).toEqual([]);
  });
});

describe("recherche plein texte et repli trigramme", () => {
  it("un terme present passe par la recherche plein texte", async () => {
    const body = await list("/api/rooms?q=nmap&limit=5");
    expect(body.search).toEqual({ term: "nmap", strategy: "fulltext" });
    expect(body.pagination.total).toBeGreaterThan(0);
  });

  it("une faute de frappe bascule sur le repli trigramme", async () => {
    const body = await list("/api/rooms?q=nmapp&limit=5");
    expect(body.search).toEqual({ term: "nmapp", strategy: "trigram" });
    expect(body.data.map((room) => room.code)).toContain("furthernmap");
  });

  it("un terme absent des deux strategies rend une liste vide", async () => {
    const body = await list("/api/rooms?q=zzzzqqqqxxxx");
    expect(body.search?.strategy).toBe("trigram");
    expect(body.pagination.total).toBe(0);
  });

  it("la recherche se combine avec les filtres", async () => {
    const alone = await list("/api/rooms?q=linux&limit=1");
    const filtered = await list("/api/rooms?q=linux&difficulty=easy&limit=1");
    expect(filtered.pagination.total).toBeLessThanOrEqual(alone.pagination.total);
  });
});

describe("bornes d'entree", () => {
  it.each([
    ["/api/rooms?page=0", "/page"],
    ["/api/rooms?page=99999", "/page"],
    ["/api/rooms?limit=0", "/limit"],
    ["/api/rooms?limit=101", "/limit"],
    ["/api/rooms?sort=banana", "/sort"],
    ["/api/rooms?difficulty=trivial", "/difficulty"],
    ["/api/rooms?type=mystere", "/type"],
    ["/api/rooms?team=green", "/team"],
    ["/api/rooms?tech=MAJUSCULES", "/tech"],
    ["/api/rooms?durationMin=-1", "/durationMin"],
    ["/api/rooms?durationMin=60&durationMax=30", "/durationMin"],
  ])("%s -> 400 sur %s", async (url, path) => {
    const response = await app.inject({ method: "GET", url });
    expect(response.statusCode).toBe(400);
    const problem = response.json<{ errors: Array<{ path: string }> }>();
    expect(problem.errors.map((issue) => issue.path)).toContain(path);
  });

  it("plus de 25 valeurs dans une facette est refuse", async () => {
    const many = Array.from({ length: 26 }, (_, index) => `tool=outil-${index}`).join("&");
    const response = await app.inject({ method: "GET", url: `/api/rooms?${many}` });
    expect(response.statusCode).toBe(400);
  });

  it("un terme de recherche de plus de 200 caracteres est refuse", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/rooms?q=${"a".repeat(201)}`,
    });
    expect(response.statusCode).toBe(400);
  });

  it("un parametre vide est traite comme absent, pas comme invalide", async () => {
    const body = await list("/api/rooms?q=&durationMin=&tech=");
    expect(body.pagination.total).toBe(EXPECTED_ROOMS);
    expect(body.search).toBeNull();
  });

  it("`__proto__` dans la chaine de requete ne pollue pas le prototype", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/rooms?__proto__[pollue]=oui&limit=1",
    });
    expect(response.statusCode).toBeLessThan(500);
    expect(({} as Record<string, unknown>).pollue).toBeUndefined();
  });
});

describe("/api/rooms/:code", () => {
  it("rend le detail complet d'une room", async () => {
    const response = await app.inject({ method: "GET", url: "/api/rooms/picklerick" });
    expect(response.statusCode).toBe(200);
    const room = response.json<{
      code: string;
      title: string;
      isActive: boolean;
      tags: { tool: unknown[] };
      categories: unknown[];
      trackSteps: unknown[];
    }>();
    expect(room.code).toBe("picklerick");
    expect(room.title).toBe("Pickle Rick");
    expect(room.isActive).toBe(true);
    // Vides aujourd'hui : aucune categorie ni parcours n'est deduit des donnees
    // TryHackMe, et rien ne sera invente. La phase 7 les remplira.
    expect(room.categories).toEqual([]);
    expect(room.trackSteps).toEqual([]);
  });

  it("la casse du code est SIGNIFIANTE", async () => {
    // 14 des 714 codes portent des majuscules et l'URL TryHackMe en depend.
    // Accepter la forme repliee renverrait une room dont le lien sortant tombe
    // en 404 : mieux vaut refuser ici (ADR-0001 Q1).
    const exact = await app.inject({
      method: "GET",
      url: "/api/rooms/AIforcyber-aoc2025-y9wWQ1zRgB",
    });
    expect(exact.statusCode).toBe(200);
    expect(exact.json<{ code: string }>().code).toBe("AIforcyber-aoc2025-y9wWQ1zRgB");

    const folded = await app.inject({
      method: "GET",
      url: "/api/rooms/aiforcyber-aoc2025-y9wwq1zrgb",
    });
    expect(folded.statusCode).toBe(404);
  });

  it("le lien sortant se deduit du code sans alteration", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/rooms/AIforcyber-aoc2025-y9wWQ1zRgB",
    });
    expect(response.json<{ thmUrl: string }>().thmUrl).toBe(
      "https://tryhackme.com/room/AIforcyber-aoc2025-y9wWQ1zRgB",
    );
  });

  it("un code inconnu rend un 404 au format problem+json", async () => {
    const response = await app.inject({ method: "GET", url: "/api/rooms/nexistepas" });
    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
  });

  it("un code de forme impossible rend un 400, pas un 404", async () => {
    const response = await app.inject({ method: "GET", url: "/api/rooms/avec%20espace" });
    expect(response.statusCode).toBe(400);
  });
});
