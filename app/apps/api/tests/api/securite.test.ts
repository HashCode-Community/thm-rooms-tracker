import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";
import { assertDatabaseReady, buildTestApp, closeDatabase } from "./harness.js";

/**
 * En-tetes de securite.
 *
 * Ils sont poses par un crochet `onSend` global. Ces tests verifient qu'ils
 * arrivent REELLEMENT sur la reponse, sur toutes les familles de reponses — une
 * reussite, une erreur de validation, une 404 — parce que le mode de defaillance
 * qui compte n'est pas « le code est absent », c'est « le code est la mais un
 * chemin y echappe ».
 */

let app: FastifyInstance;

beforeAll(async () => {
  await assertDatabaseReady();
  app = await buildTestApp();
});

afterAll(async () => {
  await app.close();
  await closeDatabase();
});

const ATTENDUS = [
  ["x-content-type-options", "nosniff"],
  ["referrer-policy", "no-referrer"],
  ["x-frame-options", "DENY"],
  ["cross-origin-resource-policy", "same-origin"],
] as const;

describe("les en-tetes arrivent sur TOUTES les familles de reponses", () => {
  const chemins = [
    ["une reussite", "/api/stats", 200],
    ["une liste", "/api/rooms?limit=1", 200],
    ["une validation refusee", "/api/rooms?limit=99999", 400],
    ["une room inconnue", "/api/rooms/celle-ci-n-existe-pas", 404],
    ["une route inconnue", "/api/il-n-y-a-rien-ici", 404],
    ["la sonde de vie", "/health", 200],
  ] as const;

  for (const [nom, url, statut] of chemins) {
    it(`${nom} porte les quatre en-tetes`, async () => {
      const response = await app.inject({ method: "GET", url });
      expect(response.statusCode).toBe(statut);
      for (const [entete, valeur] of ATTENDUS) {
        expect(response.headers[entete], `${entete} sur ${url}`).toBe(valeur);
      }
    });
  }
});

describe("politique de contenu", () => {
  it("une reponse JSON n'a le droit de rien charger", async () => {
    const response = await app.inject({ method: "GET", url: "/api/stats" });
    const csp = response.headers["content-security-policy"];

    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
  });

  it("`/docs` recoit une politique RELACHEE, et elle seule", async () => {
    // Swagger UI a besoin de scripts et de styles en ligne. Sans exception
    // nommee, la page serait blanche — et la reponse evidente serait
    // d'affaiblir la politique pour tout le monde.
    const avecDocs = await buildTestApp({ exposeDocs: true });
    try {
      const docs = await avecDocs.inject({ method: "GET", url: "/docs/" });
      const api = await avecDocs.inject({ method: "GET", url: "/api/stats" });

      expect(docs.headers["content-security-policy"]).toContain(
        "script-src 'self' 'unsafe-inline'",
      );
      expect(api.headers["content-security-policy"]).toContain("default-src 'none'");
      // Le relachement ne touche PAS le detournement de clic.
      expect(docs.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    } finally {
      await avecDocs.close();
    }
  });
});

describe("HSTS ne part qu'en production", () => {
  it("absent hors production", async () => {
    const response = await app.inject({ method: "GET", url: "/api/stats" });
    expect(response.headers["strict-transport-security"]).toBeUndefined();
  });

  it("present, et durable, en production", async () => {
    const enProduction = await buildTestApp({ hsts: true });
    try {
      const response = await enProduction.inject({ method: "GET", url: "/api/stats" });
      expect(response.headers["strict-transport-security"]).toBe(
        "max-age=63072000; includeSubDomains; preload",
      );
    } finally {
      await enProduction.close();
    }
  });

  it("la configuration le lie a la production, pas a un reglage oublie", async () => {
    // Le mode de defaillance vise : quelqu'un pose `hsts: true` par defaut « pour
    // etre tranquille », et un developpeur sur un domaine local se retrouve avec
    // HTTPS force pendant deux ans.
    expect(loadConfig({ NODE_ENV: "production" }).hsts).toBe(true);
    expect(loadConfig({ NODE_ENV: "development" }).hsts).toBe(false);
    expect(loadConfig({ NODE_ENV: "test" }).hsts).toBe(false);
    expect(loadConfig({}).hsts).toBe(false);
  });
});
