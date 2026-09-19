import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AppConfig, loadConfig, readTrustProxy } from "../../src/config.js";
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

describe("une adresse fabriquee n'ouvre pas de seau neuf", () => {
  // TOPOLOGIE REELLE REPRODUITE. L'hebergeur ajoute l'adresse reelle du client
  // A DROITE de ce que l'appelant a envoye : l'application recoit donc
  // `X-Forwarded-For: <fabrique>, <reel>` des que quelqu'un essaie de choisir
  // l'adresse sur laquelle il sera compte. La derniere entree est la seule que
  // l'appelant ne peut pas ecrire.
  const REEL = "203.0.113.200";
  const FABRIQUEES = ["198.51.100.1", "198.51.100.2", "198.51.100.3"];

  async function codesAvecEntetes(
    trustProxy: AppConfig["trustProxy"],
    entetes: readonly string[],
    max: number,
  ): Promise<number[]> {
    const app = await buildTestApp({ rateLimitMax: max, rateLimitWindowMs: 60000, trustProxy });
    try {
      const codes: number[] = [];
      for (const valeur of entetes) {
        const reponse = await app.inject({
          method: "GET",
          url: "/api/stats",
          headers: { "x-forwarded-for": valeur },
        });
        codes.push(reponse.statusCode);
      }
      return codes;
    } finally {
      await app.close();
    }
  }

  it("trois adresses fabriquees differentes tombent dans le MEME seau", async () => {
    const codes = await codesAvecEntetes(
      readTrustProxy("1"),
      FABRIQUEES.map((f) => `${f}, ${REEL}`),
      2,
    );
    expect(codes).toEqual([200, 200, 429]);
  });

  it("LE MEME SCENARIO passe avec l'ancien reglage : le test ci-dessus mord donc bien", async () => {
    // Sans ce controle, le test precedent passerait aussi avec `false`, ou avec
    // le nombre brut — deux reglages qui mettent tout le monde dans un seul
    // seau et ne prouvent rien. Ici on reproduit la faille pour montrer que le
    // test sait la voir : `true` rend trois seaux neufs, donc trois 200.
    const codes = await codesAvecEntetes(
      true,
      FABRIQUEES.map((f) => `${f}, ${REEL}`),
      2,
    );
    expect(codes).toEqual([200, 200, 200]);
  });

  it("deux clients REELS distincts gardent chacun leur seau", async () => {
    // Le controle symetrique, sans lequel le premier test ne prouverait rien :
    // un reglage qui mettrait tout le monde dans un seau unique le passerait.
    const codes = await codesAvecEntetes(readTrustProxy("1"), ["203.0.113.10", "203.0.113.11"], 1);
    expect(codes).toEqual([200, 200]);
  });
});

describe("lecture de TRUST_PROXY", () => {
  it("REFUSE `true`, la valeur qui a ouvert la faille", () => {
    expect(() => readTrustProxy("true")).toThrow(/tous les sauts/i);
  });

  it("rend une fonction pour un nombre d'intermediaires", () => {
    const confiance = readTrustProxy("1");
    expect(typeof confiance).toBe("function");
    // `hop < 1` : seul le saut 0, celui du proxy, est cru.
    expect((confiance as (a: string, h: number) => boolean)("10.0.0.7", 0)).toBe(true);
    expect((confiance as (a: string, h: number) => boolean)("10.0.0.7", 1)).toBe(false);
  });

  it("absente, vide, `false` ou `0` : aucune confiance", () => {
    expect(readTrustProxy(undefined)).toBe(false);
    expect(readTrustProxy("")).toBe(false);
    expect(readTrustProxy("false")).toBe(false);
    expect(readTrustProxy("0")).toBe(false);
  });

  it("refuse ce qui n'est ni un nombre ni `false`", () => {
    expect(() => readTrustProxy("oui")).toThrow(/nombre d'intermediaires/);
    expect(() => readTrustProxy("-1")).toThrow(/nombre d'intermediaires/);
  });
});
