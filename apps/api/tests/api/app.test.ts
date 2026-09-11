import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertDatabaseReady, buildTestApp, closeDatabase } from "./harness.js";

/**
 * Tests de l'ossature : garde de `/docs`, format d'erreur, sonde de vie.
 */

let exposed: FastifyInstance;
let hidden: FastifyInstance;

beforeAll(async () => {
  await assertDatabaseReady();
  exposed = await buildTestApp({ exposeDocs: true });
  hidden = await buildTestApp({ exposeDocs: false });
});

afterAll(async () => {
  await exposed.close();
  await hidden.close();
  await closeDatabase();
});

describe("garde de /docs", () => {
  /**
   * Ce test a un mode de defaillance vicieux qu'il faut nommer.
   *
   * Si l'enregistrement du greffon etait garde par un `process.env.NODE_ENV` lu A
   * LA PORTEE MODULE, un test qui pose la variable d'environnement puis importe
   * l'application passerait A VIDE : le module etant deja en cache, la garde
   * aurait ete evaluee avec l'ancienne valeur. Le test serait vert et ne
   * prouverait rien.
   *
   * D'ou la fabrique `buildApp(config)` : la configuration est un PARAMETRE. Les
   * deux instances ci-dessous coexistent dans le meme processus, avec des
   * configurations opposees. Aucun cache de modules ne peut les confondre.
   */
  it("exposeDocs: true -> /docs repond 200", async () => {
    const response = await exposed.inject({ method: "GET", url: "/docs" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
  });

  it("exposeDocs: true -> /docs/json sert bien l'OpenAPI", async () => {
    const response = await exposed.inject({ method: "GET", url: "/docs/json" });
    expect(response.statusCode).toBe(200);
    const document = response.json<{ openapi: string; paths: Record<string, unknown> }>();
    expect(document.openapi).toMatch(/^3\./);
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        "/health",
        "/api/rooms",
        "/api/rooms/{code}",
        "/api/facets",
        "/api/tags",
        "/api/categories",
        "/api/stats",
      ]),
    );
  });

  it("exposeDocs: false -> /docs repond 404", async () => {
    const response = await hidden.inject({ method: "GET", url: "/docs" });
    expect(response.statusCode).toBe(404);
  });

  it("exposeDocs: false -> /docs/json repond 404 aussi", async () => {
    // Fermer l'interface sans fermer le document JSON ne fermerait rien du tout.
    const response = await hidden.inject({ method: "GET", url: "/docs/json" });
    expect(response.statusCode).toBe(404);
  });
});

describe("sonde de vie", () => {
  it("/health repond 200 et confirme l'aller-retour SQL", async () => {
    const response = await hidden.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", db: "ok" });
  });

  it("/health ne divulgue aucun compteur metier", async () => {
    // Un endpoint de sante repond « suis-je vivant », pas « que contient ma base ».
    const response = await hidden.inject({ method: "GET", url: "/health" });
    expect(Object.keys(response.json<Record<string, unknown>>()).sort()).toEqual(["db", "status"]);
  });
});

describe("format des erreurs (RFC 9457)", () => {
  it("une route inconnue rend un problem+json", async () => {
    const response = await hidden.inject({ method: "GET", url: "/api/nexistepas" });
    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.json()).toMatchObject({
      type: "/problems/not-found",
      status: 404,
      instance: "/api/nexistepas",
    });
  });

  it("une erreur de validation rend un problem+json detaille", async () => {
    const response = await hidden.inject({ method: "GET", url: "/api/rooms?sort=banana" });
    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    const problem = response.json<{ type: string; errors: Array<{ path: string }> }>();
    expect(problem.type).toBe("/problems/validation-error");
    expect(problem.errors.map((issue) => issue.path)).toContain("/sort");
  });

  it("aucune reponse d'erreur ne contient de pile d'appels", async () => {
    for (const url of ["/api/nexistepas", "/api/rooms?page=0", "/api/rooms/inconnue"]) {
      const response = await hidden.inject({ method: "GET", url });
      expect(response.body).not.toMatch(/\bat .*\.ts:\d+/);
      expect(response.body).not.toContain("stack");
    }
  });
});
