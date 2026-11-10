import { checkDatasetVersion } from "@thm/shared";
import { describe, expect, it } from "vitest";

describe("compatibilite de version du dataset", () => {
  it.each(["1.0.0", "1.0.1", "1.1.0", "1.99.99"])(
    "accepte %s dans la plage ^1.0.0",
    (version) => {
      expect(checkDatasetVersion(version)).toMatchObject({ ok: true, version });
    },
  );

  it.each(["0.9.9", "2.0.0", "3.1.4"])("refuse %s hors de la plage ^1.0.0", (version) => {
    expect(checkDatasetVersion(version)).toMatchObject({ ok: false, version });
  });

  it("signale une version compatible plus recente sans la bloquer", () => {
    const verdict = checkDatasetVersion("1.1.0");

    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.notice).toContain("compatible avec ^1.0.0");
  });

  it("respecte aussi la borne minimale d'un caret", () => {
    expect(checkDatasetVersion("1.2.2", "^1.2.3").ok).toBe(false);
    expect(checkDatasetVersion("1.2.3", "^1.2.3").ok).toBe(true);
    expect(checkDatasetVersion("1.9.0", "^1.2.3").ok).toBe(true);
    expect(checkDatasetVersion("2.0.0", "^1.2.3").ok).toBe(false);
  });

  it("applique les bornes speciales des versions 0.x", () => {
    expect(checkDatasetVersion("0.2.4", "^0.2.3").ok).toBe(true);
    expect(checkDatasetVersion("0.3.0", "^0.2.3").ok).toBe(false);
    expect(checkDatasetVersion("0.0.3", "^0.0.3").ok).toBe(true);
    expect(checkDatasetVersion("0.0.4", "^0.0.3").ok).toBe(false);
  });

  it.each([undefined, null, "v1", "1.0", "1.0.0-beta"])(
    "refuse une version absente ou mal formee : %j",
    (version) => {
      expect(checkDatasetVersion(version).ok).toBe(false);
    },
  );

  it("refuse une plage illisible", () => {
    expect(checkDatasetVersion("1.0.0", "^version-inconnue")).toMatchObject({
      ok: false,
      reason: expect.stringContaining("Plage supportee illisible"),
    });
  });
});
