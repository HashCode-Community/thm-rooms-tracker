import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";
import { parseOrigines } from "../../src/http/origines.js";
import { assertDatabaseReady, buildTestApp, closeDatabase } from "./harness.js";

/**
 * Limite de debit et politique d'origine.
 *
 * Les deux gardes sont testes en les faisant MORDRE, pas en verifiant qu'ils
 * sont enregistres. Un greffon enregistre avec une limite de dix mille passerait
 * le second test et aucun utilisateur ne serait protege.
 */

beforeAll(async () => {
  await assertDatabaseReady();
});

afterAll(async () => {
  await closeDatabase();
});

describe("la limite de debit mord", () => {
  it("laisse passer sous le seuil, refuse au-dela", async () => {
    const app = await buildTestApp({ rateLimitMax: 3, rateLimitWindowMs: 60000 });
    try {
      const codes: number[] = [];
      for (let appel = 0; appel < 5; appel += 1) {
        const reponse = await app.inject({ method: "GET", url: "/api/stats" });
        codes.push(reponse.statusCode);
      }
      expect(codes).toEqual([200, 200, 200, 429, 429]);
    } finally {
      await app.close();
    }
  });

  it("le refus est au format RFC 9457, comme toutes les autres erreurs", async () => {
    // Un 429 qui ne ressemblerait pas aux autres erreurs obligerait le front a
    // un cas particulier, et c'est toujours ce cas-la qu'on oublie.
    const app = await buildTestApp({ rateLimitMax: 1, rateLimitWindowMs: 60000 });
    try {
      await app.inject({ method: "GET", url: "/api/stats" });
      const refus = await app.inject({ method: "GET", url: "/api/stats" });

      expect(refus.statusCode).toBe(429);
      const corps = refus.json();
      // `status`, pas `statusCode` : c'est le nom que fixe la RFC 9457, et c'est
      // celui que portent deja toutes les autres erreurs de cette API.
      expect(corps).toMatchObject({
        type: "/problems/rate-limit",
        title: "Trop de requetes",
        status: 429,
      });
      expect(corps.instance).toBe("/api/stats");
      expect(typeof corps.detail).toBe("string");
      expect(refus.headers["retry-after"]).toBeDefined();
      expect(refus.headers["content-type"]).toContain("application/problem+json");
    } finally {
      await app.close();
    }
  });

  it("le refus porte AUSSI les en-tetes de securite", async () => {
    // Le crochet global doit couvrir une reponse produite par un greffon tiers,
    // pas seulement celles de nos routes.
    const app = await buildTestApp({ rateLimitMax: 1, rateLimitWindowMs: 60000 });
    try {
      await app.inject({ method: "GET", url: "/api/stats" });
      const refus = await app.inject({ method: "GET", url: "/api/stats" });

      expect(refus.statusCode).toBe(429);
      expect(refus.headers["x-content-type-options"]).toBe("nosniff");
      expect(refus.headers["content-security-policy"]).toContain("default-src 'none'");
    } finally {
      await app.close();
    }
  });

  it("`/health` n'est JAMAIS limite", async () => {
    // La supervision interroge la sonde plus vite qu'un humain ne navigue. La
    // limiter ferait tomber le controle de sante, c'est-a-dire declencher
    // l'alerte que la limite etait censee eviter.
    const app = await buildTestApp({ rateLimitMax: 1, rateLimitWindowMs: 60000 });
    try {
      const codes: number[] = [];
      for (let appel = 0; appel < 6; appel += 1) {
        const reponse = await app.inject({ method: "GET", url: "/health" });
        codes.push(reponse.statusCode);
      }
      expect(codes).toEqual([200, 200, 200, 200, 200, 200]);
    } finally {
      await app.close();
    }
  });

  it("la valeur par defaut laisse passer une navigation normale", async () => {
    // L'affichage d'une progression complete de 714 rooms fait 12 requetes.
    // Une limite en dessous de ca casserait l'usage qu'on vient de construire.
    const config = loadConfig({});
    expect(config.rateLimitMax).toBe(120);
    expect(config.rateLimitWindowMs).toBe(60000);
    expect(config.rateLimitMax).toBeGreaterThan(12);
  });
});

describe("politique d'origine", () => {
  it("aucune origine declaree : aucun en-tete CORS", async () => {
    // C'est l'etat du developpement, ou le front passe par le proxy de Vite et
    // se presente comme la meme origine.
    const app = await buildTestApp({ corsOrigins: [] });
    try {
      const reponse = await app.inject({
        method: "GET",
        url: "/api/stats",
        headers: { origin: "https://ailleurs.example" },
      });
      expect(reponse.headers["access-control-allow-origin"]).toBeUndefined();
      // Et pas de `Vary: Origin` non plus : il fragmenterait les caches
      // intermediaires pour une politique qui n'existe pas.
      expect(reponse.headers.vary ?? "").not.toContain("Origin");
    } finally {
      await app.close();
    }
  });

  it("une origine declaree est autorisee, les autres non", async () => {
    const app = await buildTestApp({ corsOrigins: ["https://thm.example"] });
    try {
      const permise = await app.inject({
        method: "GET",
        url: "/api/stats",
        headers: { origin: "https://thm.example" },
      });
      const refusee = await app.inject({
        method: "GET",
        url: "/api/stats",
        headers: { origin: "https://pas-nous.example" },
      });

      expect(permise.headers["access-control-allow-origin"]).toBe("https://thm.example");
      expect(refusee.headers["access-control-allow-origin"]).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it("la preverification ne concede que la lecture", async () => {
    const app = await buildTestApp({ corsOrigins: ["https://thm.example"] });
    try {
      const preflight = await app.inject({
        method: "OPTIONS",
        url: "/api/stats",
        headers: {
          origin: "https://thm.example",
          "access-control-request-method": "GET",
        },
      });

      const methodes = preflight.headers["access-control-allow-methods"] ?? "";
      expect(methodes).toContain("GET");
      expect(methodes).not.toContain("POST");
      expect(methodes).not.toContain("DELETE");
      // L'API ne lit ni ne pose de cookie : la progression vit dans le
      // navigateur. Autoriser les identifiants ouvrirait une surface sans usage.
      expect(preflight.headers["access-control-allow-credentials"]).toBeUndefined();
    } finally {
      await app.close();
    }
  });
});

describe("lecture de CORS_ORIGINS", () => {
  it("vide ou absent donne une liste vide", () => {
    expect(parseOrigines(undefined)).toEqual([]);
    expect(parseOrigines("")).toEqual([]);
    expect(parseOrigines("   ")).toEqual([]);
  });

  it("separe sur la virgule et ignore les espaces", () => {
    expect(parseOrigines("https://a.example, https://b.example")).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });

  it("REFUSE l'etoile, au lieu de l'ignorer", () => {
    // Une etoile est une intention. La traiter comme une faute de frappe
    // laisserait quelqu'un croire qu'il a ouvert l'API alors que non, ou
    // l'inverse — et les deux erreurs sont graves.
    expect(() => parseOrigines("*")).toThrow(/n'a pas de politique d'origine/);
    expect(() => parseOrigines("https://a.example,*")).toThrow(/politique d'origine/);
  });

  it("refuse ce qui n'est pas une origine", () => {
    expect(() => parseOrigines("thm.example")).toThrow(/invalide/);
    expect(() => parseOrigines("https://thm.example/chemin")).toThrow(/invalide/);
  });
});
