import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkDatasetVersion, DatasetSchema, type RoomSource } from "@thm/shared";
import { describe, expect, it } from "vitest";
import {
  analyseToolNames,
  computeStats,
  detectAnomalies,
  EXPECTED,
  runControlChecks,
} from "../src/scripts/dataset-analysis.js";
import {
  buildTagLedger,
  findSuffixedMappingKeys,
  loadMapping,
  resolveTags,
  slugify,
  stripDisplaySuffix,
} from "../src/scripts/normalise.js";

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
  it("aucune collision de slug sur les valeurs SOURCE, avant toute normalisation", () => {
    // Le slug est le FILET : sur les ecritures telles que le dataset les livre,
    // il n'attrape rien. C'est le mecanisme — regle du badge et mapping — qui
    // fait tout le travail. Cf. ADR-0003.
    //
    // Mesure sur les valeurs brutes elles-memes, sans passer par
    // `resolveTags` : depuis 2026-09-14 celui-ci applique TOUJOURS la regle du
    // badge, meme avec un mapping vide, donc « mapping vide » ne veut plus dire
    // « aucune normalisation ».
    for (const champ of ["tools", "technologies", "skills"] as const) {
      const noms = new Set<string>();
      for (const room of parsed.rooms) for (const valeur of room[champ] ?? []) noms.add(valeur);
      const slugs = new Set([...noms].map((nom) => slugify(nom)));
      expect(slugs.size).toBe(noms.size);
    }
  });

  it("la regle du badge CREE une collision de casse, que le garde intercepte", () => {
    // La regle rabat `Enum4Linux NEW` sur `Enum4Linux`, qui rejoint `Enum4linux`
    // par la casefold du slug. ADR-0003 avait prevu exactement ce scenario et
    // pose le garde pour lui : il n'etait dormant que parce que le mapping
    // listait les deux variantes a la main.
    const { collisions, unresolved } = resolveTags(parsed.rooms, {
      version: 1,
      merge: {},
      rename: {},
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
      rename: {},
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

/**
 * LA REGLE DU BADGE D'AFFICHAGE, ET POURQUOI CE N'ETAIT PAS UNE LISTE.
 *
 * Le mapping figeait 12 entrees `"X NEW"`. Le defaut : une valeur badgee INEDITE
 * n'y figure pas, donc rien ne la rabat, donc un tag `nmap-new` nait a cote de
 * `nmap` — et la reconciliation du journal tombe juste, puisque rien n'a ete
 * ecarte ni absorbe. Le garde ne voyait pas le cas qu'il etait cense couvrir.
 *
 * Ces tests fabriquent des rooms : ils portent sur la REGLE, pas sur le contenu
 * du dataset livre.
 */
describe("badge d'affichage : une regle, pas une liste", () => {
  const MAPPING_REEL = loadMapping(resolve(ROOT, "data/mappings/normalisation-outils.yaml"));

  const room = (code: string, tools: string[]): RoomSource =>
    ({
      code,
      title: code,
      description: "",
      difficulty: "easy",
      type: "walkthrough",
      durationMinutes: 30,
      usersCount: 1,
      publishedAt: "2026-01-01",
      teams: [],
      skills: [],
      technologies: [],
      tools,
      url: `https://tryhackme.com/room/${code}`,
    }) as RoomSource;

  it("un `<existant> NEW` INEDIT est absorbe, pas cree a cote", () => {
    // `Nmap NEW` n'existe nulle part dans le mapping ni dans le dataset.
    const rooms = [room("a", ["Nmap"]), room("b", ["Nmap NEW"])];
    const { tags } = resolveTags(rooms, MAPPING_REEL);

    expect(tags.map((tag) => tag.slug)).toEqual(["nmap"]);
    expect(tags).toHaveLength(1);
  });

  it("le journal NOMME la valeur rabattue et la dit absorbee", () => {
    const rooms = [room("a", ["Nmap"]), room("b", ["Nmap NEW"])];
    const ledger = buildTagLedger(rooms, MAPPING_REEL);

    expect(ledger.suffixStripped).toEqual([
      { kind: "tool", from: "Nmap NEW", to: "Nmap", occurrences: 1, absorbed: true },
    ]);
    expect(ledger.totals.incoming).toBe(2);
    expect(ledger.totals.absorbed).toBe(1);
    expect(ledger.totals.resulting).toBe(1);
    expect(ledger.reconciled).toBe(true);
  });

  it("un badge SANS jumeau donne un tag, journalise comme tel", () => {
    const rooms = [room("a", ["Outil Jamais Vu NEW"])];
    const ledger = buildTagLedger(rooms, MAPPING_REEL);

    expect(ledger.suffixStripped).toEqual([
      {
        kind: "tool",
        from: "Outil Jamais Vu NEW",
        to: "Outil Jamais Vu",
        occurrences: 1,
        absorbed: false,
      },
    ]);
    expect(resolveTags(rooms, MAPPING_REEL).tags.map((t) => t.name)).toEqual(["Outil Jamais Vu"]);
  });

  it("le tiret et la casse du badge sont couverts par la meme regle", () => {
    for (const badge of ["Nmap NEW", "Nmap - NEW", "Nmap -NEW", "Nmap new", "Nmap  -  NEW"]) {
      expect(stripDisplaySuffix(badge)).toBe("Nmap");
    }
  });

  it("un nom qui se TERMINE par les lettres NEW n'est pas ampute", () => {
    // Le garde du garde. L'espace est EXIGE devant le badge, sinon la regle
    // insensible a la casse mangerait la fin de n'importe quel mot :
    // `Renew` deviendrait `Re`. Ecart assume avec la lettre d'ADR-0001, qui
    // ecrit `\s*`. Mesure : 0 valeur du dataset finit par NEW sans espace.
    expect(stripDisplaySuffix("Renew")).toBe("Renew");
    expect(stripDisplaySuffix("NEWT")).toBe("NEWT");
    expect(stripDisplaySuffix("NEW")).toBe("NEW");
    expect(stripDisplaySuffix("Nmap-NEW")).toBe("Nmap-NEW");
  });

  it("une cle de mapping encore badgee est refusee, pas ignoree", () => {
    expect(findSuffixedMappingKeys(MAPPING_REEL)).toEqual([]);
    expect(
      findSuffixedMappingKeys({
        version: 1,
        merge: { Hydra: ["Hydra NEW"] },
        rename: {},
        canonical: {},
      }),
    ).toEqual(["Hydra NEW"]);
  });

  it("une ressemblance de badge que la regle RATE est signalee, avec son jumeau", () => {
    // Le cas que la mesure d'aujourd'hui ne couvre pas : la source ecrit le
    // badge sans espace. La regle ne mord pas — et c'est voulu, sinon `Renew`
    // serait ampute — donc `nmap-new` naitrait a cote de `nmap`. Le filet large
    // est la seule chose qui rende ce cas visible.
    const rooms = [room("a", ["Nmap"]), room("b", ["Nmap-NEW"]), room("c", ["NmapNEW"])];
    const ledger = buildTagLedger(rooms, MAPPING_REEL);

    expect(ledger.suffixSuspects).toEqual([
      { kind: "tool", raw: "Nmap-NEW", occurrences: 1, twinSlug: "nmap" },
      { kind: "tool", raw: "NmapNEW", occurrences: 1, twinSlug: "nmap" },
    ]);
    // Et le doublon EXISTE bel et bien : c'est ce que l'avertissement annonce.
    expect(
      resolveTags(rooms, MAPPING_REEL)
        .tags.map((t) => t.slug)
        .sort(),
    ).toEqual(["nmap", "nmap-new", "nmapnew"]);
  });

  it("un mot qui finit legitimement par new est signale sans jumeau", () => {
    // Faux positif assume. L'avertissement nomme la valeur et dit qu'aucun
    // jumeau n'existe : on l'ecarte en une seconde. L'inverse — se taire — est
    // ce qui a produit le defaut d'origine.
    const ledger = buildTagLedger([room("a", ["Renew"])], MAPPING_REEL);

    expect(ledger.suffixSuspects).toEqual([
      { kind: "tool", raw: "Renew", occurrences: 1, twinSlug: null },
    ]);
    expect(ledger.reconciled).toBe(true); // avertissement, jamais blocage
  });

  it("une valeur que la regle a RABATTUE n'est pas signalee deux fois", () => {
    const rooms = [room("a", ["Nmap"]), room("b", ["Nmap NEW"])];
    const ledger = buildTagLedger(rooms, MAPPING_REEL);

    expect(ledger.suffixSuspects).toEqual([]);
    expect(ledger.suffixStripped).toHaveLength(1);
  });

  it("le dataset livre ne contient aucune ressemblance non rabattue", () => {
    // La mesure qui justifie l'ecart avec ADR-0001, rendue executable : si une
    // livraison future du scraper introduit `Outil-NEW`, ce test tombe.
    const ledger = buildTagLedger(parsed.rooms, MAPPING_REEL);
    expect(ledger.suffixSuspects).toEqual([]);
  });
  it("le mapping reel ne garde que les vraies coquilles", () => {
    expect(Object.keys(MAPPING_REEL.merge).sort()).toEqual(["Autopsy", "Burp Suite"]);
    expect(Object.keys(MAPPING_REEL.rename)).toEqual([]);
  });
});
