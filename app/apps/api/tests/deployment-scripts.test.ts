import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../../../..");
const databaseScript = readFileSync(
  resolve(ROOT, "deploiement/1-base/remplir-la-base.ps1"),
  "utf8",
);
const siteScript = readFileSync(resolve(ROOT, "deploiement/3-site/preparer-le-site.ps1"), "utf8");

describe("les scripts de deploiement nettoient la session appelante", () => {
  it("restaure le dossier courant dans les deux scripts", () => {
    for (const script of [databaseScript, siteScript]) {
      expect(script).toContain("finally {");
      expect(script).toContain("Set-Location -LiteralPath $anciennePosition.Path");
    }
  });

  it("restaure DATABASE_URL, y compris quand elle etait absente", () => {
    expect(databaseScript).toContain("$env:DATABASE_URL = $ancienneDatabaseUrl");
    expect(databaseScript).toContain("Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue");
  });

  it("restaure VITE_API_BASE_URL, y compris quand elle etait absente", () => {
    expect(siteScript).toContain("$env:VITE_API_BASE_URL = $ancienneApiBaseUrl");
    expect(siteScript).toContain("Remove-Item Env:VITE_API_BASE_URL -ErrorAction SilentlyContinue");
  });

  it("rend bloquante la suppression des anciens dossiers construits", () => {
    expect(siteScript).toContain("Remove-Item $dist -Recurse -Force -ErrorAction Stop");
    expect(siteScript).toContain("Remove-Item $sortie -Recurse -Force -ErrorAction Stop");
  });
});
