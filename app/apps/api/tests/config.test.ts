import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("NODE_ENV", () => {
  it("utilise development uniquement quand la variable est absente", () => {
    expect(loadConfig({})).toMatchObject({
      nodeEnv: "development",
      exposeDocs: true,
      exposeErrorDetail: true,
      hsts: false,
    });
  });

  it("accepte development explicitement", () => {
    expect(loadConfig({ NODE_ENV: "development" }).nodeEnv).toBe("development");
  });

  it("configure le mode test sans exposer HSTS", () => {
    expect(loadConfig({ NODE_ENV: "test" })).toMatchObject({
      nodeEnv: "test",
      exposeDocs: true,
      exposeErrorDetail: true,
      hsts: false,
      logLevel: "silent",
    });
  });

  it("ferme la documentation et les details d'erreur en production", () => {
    expect(loadConfig({ NODE_ENV: "production" })).toMatchObject({
      nodeEnv: "production",
      exposeDocs: false,
      exposeErrorDetail: false,
      hsts: true,
    });
  });

  it.each(["", "prod", "Production", "staging", " production "])(
    "refuse la valeur inconnue %j",
    (nodeEnv) => {
      expect(() => loadConfig({ NODE_ENV: nodeEnv })).toThrowError(
        /NODE_ENV doit etre development, test ou production/,
      );
    },
  );
});
