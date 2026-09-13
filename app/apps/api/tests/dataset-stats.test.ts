import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkDatasetVersion, DatasetSchema } from "@thm/shared";
import { describe, expect, it } from "vitest";
import {
  analyseToolNames,
  computeStats,
  detectAnomalies,
  EXPECTED,
  runControlChecks,
} from "../src/scripts/dataset-analysis.js";
import { resolveTags, slugify } from "../src/scripts/normalise.js";

/**
 * Tests de NON-REGRESSION sur le dataset.
 *
 * Ils ne testent pas « le code marche » mais « le code compte encore la meme
 * chose ». Toute divergence signifie l'une de deux choses, jamais autre chose :
 *   - le dataset a change    -> mettre a jour EXPECTED dans le meme commit que
 *                               le nouveau dataset, en le justifiant ;
 *   - le comptage a regresse -> corriger le code.
 *
 * Ils tournent SANS base de donnees : ils lisent le fichier. C'est voulu, la CI
 * doit pouvoir les executer sans infrastructure.
 */

const ROOT = resolve(import.meta.dirname, "../../..");
const DATASET = resolve(ROOT, "data/datasets/rooms.v1.json");

const bytes = readFileSync(DATASET);
const parsed = DatasetSchema.parse(JSON.parse(bytes.toString("utf8")));
const stats = computeStats(parsed.rooms);

describe("integrite du dataset", () => {
  it("le SHA-256 des octets bruts correspond au sidecar", () => {
    const actual = createHash("sha256").update(bytes).digest("hex");
    const declared = readFileSync(`${DATASET}.sha256`, "utf8").trim().split(/\s+/)[0];
    expect(actual).toBe(declared);
  });

  it("la version du dataset est dans la plage supportee par l'importer", () => {
    expect(checkDatasetVersion(parsed.meta.datasetVersion).ok).toBe(true);
  });

  it("respecte le contrat Zod, qui transcrit rooms.schema.json", () => {
    expect(() => DatasetSchema.parse(JSON.parse(bytes.toString("utf8")))).not.toThrow();
  });

  it("les rooms sont triees par code croissant", () => {
    const codes = parsed.rooms.map((room) => room.code);
    expect(codes).toEqual([...codes].sort());
  });

  it("aucun code duplique", () => {
    const codes = parsed.rooms.map((room) => room.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("statistiques de controle", () => {
  it("les 22 controles sont conformes", () => {
    const failed = runControlChecks(stats).filter((check) => !check.ok);
    expect(failed.map((c) => `${c.label} : attendu ${c.expected}, obtenu ${c.actual}`)).toEqual([]);
  });

  it.each(Object.entries(EXPECTED.difficulty))("difficulte %s = %i", (key, expected) => {
    expect(stats.byDifficulty.get(key) ?? 0).toBe(expected);
  });

  it.each(Object.entries(EXPECTED.type))("type %s = %i", (key, expected) => {
    expect(stats.byType.get(key) ?? 0).toBe(expected);
  });

  it.each(Object.entries(EXPECTED.team))("equipe %s = %i", (key, expected) => {
    expect(stats.byTeam.get(key) ?? 0).toBe(expected);
  });

  it("714 rooms, 54 sans equipe, 53 426 minutes cumulees", () => {
    expect(stats.roomCount).toBe(EXPECTED.roomCount);
    expect(stats.roomsWithoutTeam).toBe(EXPECTED.roomsWithoutTeam);
    expect(stats.totalDurationMinutes).toBe(EXPECTED.totalDurationMinutes);
  });

  it("186 outils, 103 competences, 15 technologies distincts (valeurs brutes)", () => {
    expect(stats.distinctTools).toBe(EXPECTED.distinctTools);
    expect(stats.distinctSkills).toBe(EXPECTED.distinctSkills);
    expect(stats.distinctTechnologies).toBe(EXPECTED.distinctTechnologies);
  });
});

describe("anomalies connues", () => {
  const anomalies = detectAnomalies(parsed);
  const countOf = (id: string): number => anomalies.find((a) => a.id === id)?.count ?? -1;

  it.each([
    ["titres-espaces", 14],
    ["descriptions-espaces", 37],
    ["sans-technologie", 164],
    ["sans-competence", 85],
    ["sans-equipe", 54],
    ["description-vide", 1],
    ["techno-na", 6],
    ["durees-evenement", 5],
    ["outils-espaces", 1],
    ["titres-identiques", 3],
    ["publishedat-2026", 110],
  ])("%s = %i occurrences", (id, expected) => {
    expect(countOf(id)).toBe(expected);
  });

  it.each([
    ["codes-dupliques", 0],
    ["url-incoherente", 0],
    ["rooms-non-triees", 0],
    ["meta-scrapedat-format", 0],
  ])("%s = %i (aucune occurrence attendue)", (id, expected) => {
    expect(countOf(id)).toBe(expected);
  });
});

describe("normalisation des outils", () => {
  const { merges, renames, spelling } = analyseToolNames(parsed.rooms);

  it("5 merges issus du suffixe NEW et 7 renames orphelins", () => {
    // La regle strip -> trim -> casefold produit ce partage, pas 8 orphelins.
    expect(merges.map((m) => m.canonical).sort()).toEqual([
      "Empire",
      "Enum4Linux",
      "Hydra",
      "MITRE ATT&CK Framework",
      "Responder",
    ]);
    expect(renames).toHaveLength(7);
  });

  it("2 fautes de frappe, 7 paires a fusionner au total", () => {
    expect(spelling.map((s) => s.canonical).sort()).toEqual(["Autopsy", "Burp Suite"]);
    expect(merges.length + spelling.length).toBe(7);
  });

  it("`Empire - NEW` est un merge : le tiret ne doit pas masquer le jumeau", () => {
    const empire = merges.find((m) => m.canonical === "Empire");
    expect(empire?.variants).toContain("Empire - NEW");
  });

  it("`Enum4Linux NEW` est un merge, pas un orphelin : la casefold trouve `Enum4linux`", () => {
    const enumLinux = merges.find((m) => m.canonical === "Enum4Linux");
    expect(enumLinux?.variants).toContain("Enum4linux");
    expect(renames.map((r) => r.from)).not.toContain("Enum4Linux NEW");
  });
});

describe("slug et collisions", () => {
  it("aucune collision de slug sur les donnees BRUTES", () => {
    // Le mapping est le mecanisme, le slug est le filet : sans mapping, le
    // filet n'attrape rien. Cf. ADR-0003.
    const { collisions } = resolveTags(parsed.rooms, {
      version: 0,
      merge: {},
      rename: {},
      canonical: {},
    });
    expect(collisions).toEqual([]);
  });

  it("une collision apparait si le mapping cree une variante de casse", () => {
    // `Enum4Linux NEW` renomme en `Enum4Linux` rejoint `Enum4linux` par la
    // casefold du slug. C'est le seul cas, et il est cree par le mapping.
    const { collisions, unresolved } = resolveTags(parsed.rooms, {
      version: 1,
      merge: {},
      rename: { "Enum4Linux NEW": "Enum4Linux" },
      canonical: {},
    });
    expect(collisions).toHaveLength(1);
    expect(collisions[0]?.slug).toBe("enum4linux");
    // Sans forme canonique declaree, l'importer doit refuser de tourner.
    expect(unresolved).toHaveLength(1);
  });

  it("la meme collision est resolue si `canonical` la declare", () => {
    const { unresolved, tags } = resolveTags(parsed.rooms, {
      version: 1,
      merge: {},
      rename: { "Enum4Linux NEW": "Enum4Linux" },
      canonical: { enum4linux: "enum4linux" },
    });
    expect(unresolved).toEqual([]);
    expect(tags.find((t) => t.slug === "enum4linux")?.name).toBe("enum4linux");
  });

  it("`N/A` n'est jamais un tag", () => {
    const { tags } = resolveTags(parsed.rooms, {
      version: 0,
      merge: {},
      rename: {},
      canonical: {},
    });
    expect(tags.filter((t) => t.kind === "technology")).toHaveLength(14);
    expect(tags.map((t) => t.name)).not.toContain("N/A");
  });

  it.each([
    ["Burp Suite", "burp-suite"],
    ["MITRE ATT&CK Framework", "mitre-att-ck-framework"],
    [" Microsoft Sentinel", "microsoft-sentinel"],
    ["LECmd.exe", "lecmd-exe"],
    ["ICS/SCADA", "ics-scada"],
  ])("slugify(%j) = %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe("casse des codes de rooms", () => {
  const withUppercase = parsed.rooms.filter((room) => room.code !== room.code.toLowerCase());

  it("14 codes contiennent des majuscules, et elles doivent survivre", () => {
    expect(withUppercase).toHaveLength(14);
    expect(withUppercase.map((r) => r.code)).toContain("AIforcyber-aoc2025-y9wWQ1zRgB");
  });

  it("aucune collision une fois replies en minuscules", () => {
    const folded = parsed.rooms.map((room) => room.code.toLowerCase());
    expect(new Set(folded).size).toBe(folded.length);
  });

  it("tous les codes sont utilisables tels quels dans une URL", () => {
    const unsafe = parsed.rooms.filter((room) => !/^[A-Za-z0-9._~-]+$/.test(room.code));
    expect(unsafe.map((r) => r.code)).toEqual([]);
  });

  it("l'URL TryHackMe se deduit du code, casse comprise", () => {
    for (const room of parsed.rooms) {
      expect(room.url).toBe(`https://tryhackme.com/room/${room.code}`);
    }
  });
});
