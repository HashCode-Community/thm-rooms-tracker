import { pino } from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { REDACTION_JOURNAL } from "../../src/app.js";
import { assertDatabaseReady, buildTestApp, closeDatabase } from "./harness.js";

/**
 * Les promesses de la page « Mentions ».
 *
 * Cette page affirme trois choses a l'utilisateur. Une affirmation publiee sans
 * garde est une affirmation qui devient fausse le jour ou quelqu'un ajoute une
 * route sans y penser — et personne ne relit une page de mentions.
 *
 * Chaque test ici correspond a une phrase de la page. S'il tombe, la phrase est
 * devenue fausse et il faut soit corriger le code, soit corriger la page.
 */

beforeAll(async () => {
  await assertDatabaseReady();
});

afterAll(async () => {
  await closeDatabase();
});

describe("« l'API ne recoit rien : elle ne sait que lire »", () => {
  it("aucune route n'expose autre chose que GET et HEAD", async () => {
    const app = await buildTestApp();
    try {
      const routes = app
        .printRoutes({ commonPrefix: false })
        .split("\n")
        .flatMap((ligne) => [...ligne.matchAll(/\(([A-Z, ]+)\)/g)].map((m) => m[1] ?? ""))
        .flatMap((methodes) => methodes.split(",").map((m) => m.trim()))
        .filter((methode) => methode !== "");

      expect(routes.length).toBeGreaterThan(0);
      const ecritures = routes.filter((m) => !["GET", "HEAD", "OPTIONS"].includes(m));
      expect(ecritures, `methodes d'ecriture exposees : ${ecritures.join(", ")}`).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it("une tentative d'ecriture est refusee, pas ignoree", async () => {
    const app = await buildTestApp();
    try {
      for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
        const reponse = await app.inject({ method, url: "/api/rooms" });
        expect(reponse.statusCode, `${method} /api/rooms`).toBe(404);
      }
    } finally {
      await app.close();
    }
  });
});

describe("« aucune adresse IP n'est conservee »", () => {
  it("un journal construit avec la VRAIE configuration n'ecrit pas l'adresse", async () => {
    // Le test porte sur `REDACTION_JOURNAL`, l'objet reellement passe a Fastify,
    // et non sur une liste de chemins recopiee ici : une copie resterait verte
    // le jour ou l'originale divergerait.
    const lignes: string[] = [];
    const journal = pino({ level: "info", redact: REDACTION_JOURNAL }, {
      write(ligne: string) {
        lignes.push(ligne);
      },
    } as never);

    journal.info(
      {
        req: {
          method: "GET",
          url: "/api/stats",
          remoteAddress: "198.51.100.7",
          remotePort: 54321,
          headers: { "x-forwarded-for": "203.0.113.42", "user-agent": "curl/8" },
        },
      },
      "incoming request",
    );

    const sortie = lignes.join(String.fromCharCode(10));
    expect(sortie).not.toContain("198.51.100.7");
    expect(sortie).not.toContain("203.0.113.42");
    expect(sortie).not.toContain("54321");
    expect(sortie).not.toContain("remoteAddress");
    // On a retire l'adresse, PAS le journal : ce qui sert au diagnostic reste.
    expect(sortie).toContain("/api/stats");
    expect(sortie).toContain("curl/8");
  });

  it("la configuration vise les trois portes d'entree de l'adresse", () => {
    // `remoteAddress` pour une connexion directe, `x-forwarded-for` derriere un
    // proxy. Oublier la seconde rendrait la promesse fausse des la mise en ligne.
    expect(REDACTION_JOURNAL.remove).toBe(true);
    expect(REDACTION_JOURNAL.paths).toContain("req.remoteAddress");
    expect(REDACTION_JOURNAL.paths).toContain("req.remotePort");
    expect(REDACTION_JOURNAL.paths).toContain('req.headers["x-forwarded-for"]');
  });
});
