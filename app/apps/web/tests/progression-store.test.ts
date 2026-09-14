import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createProgressionExport,
  createProgressionStore,
  PROGRESSION_STORAGE_KEY,
  type ProgressionStorage,
  readProgression,
} from "../src/progression-store.js";
import { summarizeCompletedRooms } from "../src/progression-summary.js";

const NOW = new Date("2026-09-13T12:34:56.789Z");

class FakeStorage implements ProgressionStorage {
  value: string | null;
  reads = 0;
  writes = 0;
  throwOnRead = false;
  throwOnWrite = false;

  constructor(value: string | null = null) {
    this.value = value;
  }

  getItem(key: string): string | null {
    assert.equal(key, PROGRESSION_STORAGE_KEY);
    this.reads += 1;
    if (this.throwOnRead) throw new Error("stockage bloque");
    return this.value;
  }

  setItem(key: string, value: string): void {
    assert.equal(key, PROGRESSION_STORAGE_KEY);
    this.writes += 1;
    if (this.throwOnWrite) throw new Error("quota depasse");
    this.value = value;
  }
}

/**
 * Stockage TOTALEMENT inaccessible : c'est l'acces a l'objet lui-meme qui leve,
 * pas l'une de ses methodes. C'est ce que fait reellement un navigateur qui
 * bloque le stockage — `window.localStorage` jette avant qu'on ait pu appeler
 * quoi que ce soit.
 */
function inaccessibleStorage(): () => ProgressionStorage {
  return () => {
    throw new DOMException("acces refuse", "SecurityError");
  };
}

const payload = (rooms: Array<{ code: string; completedAt: string }>): string =>
  JSON.stringify({ version: 1, completedRooms: rooms });

describe("lecture du stockage — aucune reparation silencieuse", () => {
  it("tolere une cle absente sans ecrire", () => {
    const storage = new FakeStorage();
    const result = readProgression(() => storage);

    assert.equal(result.kind, "absent");
    assert.deepEqual(result.completedRooms, []);
    assert.equal(storage.writes, 0);
  });

  it("tolere un JSON malforme sans ecrire", () => {
    const storage = new FakeStorage("{ peut-etre-recuperable");
    const result = readProgression(() => storage);

    assert.equal(result.kind, "malformed-json");
    assert.deepEqual(result.completedRooms, []);
    assert.equal(storage.writes, 0);
    assert.equal(storage.value, "{ peut-etre-recuperable");
  });

  it("tolere une version inconnue sans ecrire", () => {
    const original = JSON.stringify({ version: 2, completedRooms: [] });
    const storage = new FakeStorage(original);
    const result = readProgression(() => storage);

    assert.equal(result.kind, "unknown-version");
    assert.equal(storage.writes, 0);
    assert.equal(storage.value, original);
  });

  it("tolere une forme inattendue sans ecrire", () => {
    const original = JSON.stringify({ version: 1, completedRooms: "toutes" });
    const storage = new FakeStorage(original);
    const result = readProgression(() => storage);

    assert.equal(result.kind, "unexpected-shape");
    assert.equal(storage.writes, 0);
    assert.equal(storage.value, original);
  });

  it("tolere un acces au stockage qui leve", () => {
    const storage = new FakeStorage();
    storage.throwOnRead = true;

    assert.doesNotThrow(() => readProgression(() => storage));
    assert.equal(readProgression(() => storage).kind, "storage-unavailable");
    assert.equal(storage.writes, 0);
  });
});

/**
 * Chaque entree est validee, pas seulement la forme du conteneur.
 *
 * Ce n'est pas de la rigueur pour la rigueur : `completedAt` part directement
 * dans `Intl.DateTimeFormat.format(new Date(value))`. Mesure :
 * `format(new Date(""))` leve `RangeError: Invalid time value`. Sans cette
 * validation, une seule entree malformee fait tomber toute la page.
 */
describe("validation entree par entree", () => {
  const rejette = (rooms: unknown, pourquoi: string) => {
    const storage = new FakeStorage(JSON.stringify({ version: 1, completedRooms: rooms }));
    const result = readProgression(() => storage);
    assert.equal(result.kind, "unexpected-shape", pourquoi);
    assert.deepEqual(result.completedRooms, []);
  };

  it("refuse une date qui n'est pas une date", () => {
    rejette([{ code: "picklerick", completedAt: "hier" }], "date libre");
    rejette([{ code: "picklerick", completedAt: "" }], "date vide");
    rejette([{ code: "picklerick", completedAt: "2026-13-45T99:99:99Z" }], "date impossible");
  });

  it("refuse une date sans fuseau explicite", () => {
    rejette([{ code: "picklerick", completedAt: "2026-09-13T12:34:56" }], "sans Z");
  });

  it("refuse un code de forme impossible", () => {
    rejette([{ code: "avec espace", completedAt: NOW.toISOString() }], "espace");
    rejette([{ code: "", completedAt: NOW.toISOString() }], "vide");
    rejette([{ code: "a".repeat(121), completedAt: NOW.toISOString() }], "trop long");
  });

  it("refuse une cle supplementaire dans une entree", () => {
    rejette([{ code: "picklerick", completedAt: NOW.toISOString(), note: "x" }], "cle en trop");
  });

  it("refuse une entree qui n'est pas un objet", () => {
    rejette(["picklerick"], "chaine");
    rejette([null], "null");
  });

  it("accepte une entree bien formee", () => {
    const storage = new FakeStorage(payload([{ code: "csrfV2", completedAt: NOW.toISOString() }]));
    const result = readProgression(() => storage);
    assert.equal(result.kind, "valid");
    assert.deepEqual(result.completedRooms, [{ code: "csrfV2", completedAt: NOW.toISOString() }]);
  });

  it("refuse deux fois le meme code plutot que d'arbitrer une date", () => {
    const storage = new FakeStorage(
      payload([
        { code: "picklerick", completedAt: "2026-09-01T10:00:00.000Z" },
        { code: "picklerick", completedAt: "2026-09-02T10:00:00.000Z" },
      ]),
    );
    const result = readProgression(() => storage);
    assert.equal(result.kind, "unexpected-shape");
    assert.equal(storage.writes, 0);
    // La valeur d'origine reste intacte : elle est peut-etre recuperable.
    assert.match(storage.value ?? "", /2026-09-02/);
  });
});

describe("ecriture — etat de session sans perte silencieuse", () => {
  it("stocke seulement le code et completedAt dans un format versionne", () => {
    const storage = new FakeStorage();
    const store = createProgressionStore(
      () => storage,
      () => NOW,
    );

    store.setCompleted("AIforcyber-aoc2025-y9wWQ1zRgB", true);

    assert.deepEqual(JSON.parse(storage.value ?? "null"), {
      version: 1,
      completedRooms: [
        {
          code: "AIforcyber-aoc2025-y9wWQ1zRgB",
          completedAt: "2026-09-13T12:34:56.789Z",
        },
      ],
    });
    assert.equal(store.getSnapshot().warning, null);
  });

  it("preserve la casse et distingue deux codes differemment casses", () => {
    const storage = new FakeStorage();
    const store = createProgressionStore(
      () => storage,
      () => NOW,
    );

    store.setCompleted("csrfV2", true);
    store.setCompleted("csrfv2", true);

    assert.deepEqual(
      store.getSnapshot().completedRooms.map((room) => room.code),
      ["csrfV2", "csrfv2"],
    );
  });

  it("refuse un code de forme impossible plutot que de l'ecrire", () => {
    const storage = new FakeStorage();
    const store = createProgressionStore(
      () => storage,
      () => NOW,
    );

    assert.throws(() => {
      store.setCompleted("avec espace", true);
    }, /Code de room invalide/);
    assert.equal(storage.writes, 0);
    assert.equal(store.getSnapshot().completedRooms.length, 0);
  });

  it("ne remplace jamais une valeur illisible, meme au premier changement", () => {
    const original = "{ donnees-a-recuperer";
    const storage = new FakeStorage(original);
    const store = createProgressionStore(
      () => storage,
      () => NOW,
    );

    assert.equal(store.getSnapshot().warning, null);
    store.setCompleted("picklerick", true);

    assert.equal(storage.writes, 0);
    assert.equal(storage.value, original);
    assert.equal(store.isCompleted("picklerick"), true);
    assert.equal(store.getSnapshot().warning, "unreadable-preserved");
  });

  it("retire une completion sans toucher aux autres", () => {
    const storage = new FakeStorage();
    const store = createProgressionStore(
      () => storage,
      () => NOW,
    );
    store.setCompleted("picklerick", true);
    store.setCompleted("csrfV2", true);

    store.setCompleted("picklerick", false);

    assert.equal(store.isCompleted("picklerick"), false);
    assert.equal(store.isCompleted("csrfV2"), true);
  });
});

/**
 * Les trois pannes ne disent pas la meme chose a l'utilisateur.
 *
 * La version precedente les confondait en deux categories, et affichait en
 * navigation privee « la progression existante n'a pas pu etre lue, la donnee
 * existante n'a pas ete remplacee » — une affirmation sur des donnees qui
 * n'existaient pas, et un silence sur la seule chose qui comptait.
 */
describe("les trois modes de defaillance sont distingues", () => {
  it("stockage inaccessible : `storage-unavailable`", () => {
    const store = createProgressionStore(inaccessibleStorage(), () => NOW);
    assert.equal(store.getSnapshot().readKind, "storage-unavailable");

    store.setCompleted("picklerick", true);

    assert.equal(store.getSnapshot().warning, "storage-unavailable");
    assert.equal(store.isCompleted("picklerick"), true);
  });

  it("valeur presente et illisible : `unreadable-preserved`", () => {
    const storage = new FakeStorage("{ donnees-a-recuperer");
    const store = createProgressionStore(
      () => storage,
      () => NOW,
    );

    store.setCompleted("picklerick", true);

    assert.equal(store.getSnapshot().warning, "unreadable-preserved");
    assert.equal(storage.writes, 0);
  });

  it("stockage lisible mais plein : `write-failed`", () => {
    const storage = new FakeStorage();
    storage.throwOnWrite = true;
    const store = createProgressionStore(
      () => storage,
      () => NOW,
    );

    store.setCompleted("picklerick", true);

    assert.equal(store.getSnapshot().readKind, "absent");
    assert.equal(store.getSnapshot().warning, "write-failed");
  });
});

/**
 * L'avertissement dure tant que la panne dure.
 *
 * Mesure au navigateur sur la version precedente, stockage sature : premiere
 * case cochee, alerte correcte ; l'utilisateur la ferme ; cinq cases de plus
 * cochees ; six cases affichees, `localStorage` a `null`, plus aucune alerte.
 * Tout etait perdu au rechargement sans qu'aucun ecran ne l'ait dit.
 */
describe("l'avertissement ne s'efface que lorsque la panne cesse", () => {
  it("chaque mutation supplementaire reessaie et avertit de nouveau", () => {
    const storage = new FakeStorage();
    storage.throwOnWrite = true;
    const store = createProgressionStore(
      () => storage,
      () => NOW,
    );

    store.setCompleted("picklerick", true);
    assert.equal(store.getSnapshot().warning, "write-failed");
    assert.equal(storage.writes, 1);

    store.setCompleted("csrfV2", true);
    assert.equal(store.getSnapshot().warning, "write-failed", "l'avertissement reste");
    assert.equal(storage.writes, 2, "l'ecriture est REESSAYEE, pas abandonnee");

    store.setCompleted("blue", true);
    assert.equal(store.getSnapshot().warning, "write-failed");
    assert.equal(storage.writes, 3);
  });

  it("le magasin n'offre aucun moyen de faire taire l'avertissement", () => {
    const store = createProgressionStore(inaccessibleStorage(), () => NOW);
    assert.equal(
      "dismissWarning" in store,
      false,
      "un avertissement de perte de donnees ne se ferme pas, il cesse",
    );
  });

  it("decocher une room relance l'ecriture et efface l'avertissement", () => {
    // C'est le scenario reel du quota : l'utilisateur libere de la place en
    // retirant des entrees. Refuser de reessayer le tiendrait prisonnier de la
    // panne qu'il est en train de reparer.
    const storage = new FakeStorage();
    const store = createProgressionStore(
      () => storage,
      () => NOW,
    );

    storage.throwOnWrite = true;
    store.setCompleted("picklerick", true);
    assert.equal(store.getSnapshot().warning, "write-failed");

    storage.throwOnWrite = false;
    store.setCompleted("picklerick", false);

    assert.equal(store.getSnapshot().warning, null, "la panne a cesse, l'alerte aussi");
    assert.deepEqual(JSON.parse(storage.value ?? "null").completedRooms, []);
  });
});

describe("forget — retirer les rooms disparues du catalogue", () => {
  it("retire les codes demandes et conserve les autres", () => {
    const storage = new FakeStorage();
    const store = createProgressionStore(
      () => storage,
      () => NOW,
    );
    store.setCompleted("picklerick", true);
    store.setCompleted("csrfV2", true);
    store.setCompleted("blue", true);

    store.forget(["picklerick", "blue"]);

    assert.deepEqual(
      store.getSnapshot().completedRooms.map((room) => room.code),
      ["csrfV2"],
    );
    assert.deepEqual(
      JSON.parse(storage.value ?? "null").completedRooms.map((r: { code: string }) => r.code),
      ["csrfV2"],
    );
  });

  it("n'ecrit rien quand aucun code ne correspond", () => {
    const storage = new FakeStorage();
    const store = createProgressionStore(
      () => storage,
      () => NOW,
    );
    store.setCompleted("picklerick", true);
    const ecrituresAvant = storage.writes;

    store.forget(["jamais-vue"]);

    assert.equal(storage.writes, ecrituresAvant, "aucune ecriture inutile");
    assert.equal(store.isCompleted("picklerick"), true);
  });

  it("respecte la casse", () => {
    const storage = new FakeStorage();
    const store = createProgressionStore(
      () => storage,
      () => NOW,
    );
    store.setCompleted("csrfV2", true);

    store.forget(["csrfv2"]);

    assert.equal(store.isCompleted("csrfV2"), true, "un code d'une autre casse est un autre code");
  });
});

/**
 * Reprise d'un changement venu d'un autre onglet.
 *
 * Tout ce chemin etait sans aucun test : une mutation le neutralisant
 * entierement laissait les 13 tests verts. C'est pourtant le seul mecanisme de
 * coherence entre deux onglets ouverts sur le site.
 */
describe("reloadFromStorage — l'autre onglet", () => {
  const abonne = (store: { subscribe(listener: () => void): () => void }) => {
    const compteur = { notifications: 0 };
    store.subscribe(() => {
      compteur.notifications += 1;
    });
    return compteur;
  };

  it("adopte une valeur saine ecrite ailleurs, et previent l'interface", () => {
    const storage = new FakeStorage();
    const store = createProgressionStore(
      () => storage,
      () => NOW,
    );
    const compteur = abonne(store);

    storage.value = payload([{ code: "kenobi", completedAt: NOW.toISOString() }]);
    store.reloadFromStorage();

    assert.deepEqual(
      store.getSnapshot().completedRooms.map((room) => room.code),
      ["kenobi"],
    );
    assert.equal(
      compteur.notifications,
      1,
      "sans notification, l'interface reste sur l'ancien etat",
    );
  });

  it("adopte une cle effacee ailleurs", () => {
    const storage = new FakeStorage();
    const store = createProgressionStore(
      () => storage,
      () => NOW,
    );
    store.setCompleted("picklerick", true);

    storage.value = null;
    store.reloadFromStorage();

    assert.deepEqual(store.getSnapshot().completedRooms, []);
    assert.equal(store.getSnapshot().readKind, "absent");
  });

  it("ne remplace pas l'etat de session par une valeur devenue illisible", () => {
    const storage = new FakeStorage();
    const store = createProgressionStore(
      () => storage,
      () => NOW,
    );
    store.setCompleted("picklerick", true);
    const compteur = abonne(store);

    storage.value = "{ casse-par-un-autre-onglet";
    store.reloadFromStorage();

    assert.equal(store.isCompleted("picklerick"), true, "l'etat de cette session survit");
    assert.equal(store.getSnapshot().readKind, "malformed-json");
    assert.equal(compteur.notifications, 1);

    // Et plus rien n'est ecrit par-dessus la valeur illisible.
    const ecrituresAvant = storage.writes;
    store.setCompleted("blue", true);
    assert.equal(storage.writes, ecrituresAvant);
    assert.equal(store.getSnapshot().warning, "unreadable-preserved");
  });

  it("une valeur redevenue saine efface l'avertissement", () => {
    const storage = new FakeStorage("{ illisible");
    const store = createProgressionStore(
      () => storage,
      () => NOW,
    );
    store.setCompleted("picklerick", true);
    assert.equal(store.getSnapshot().warning, "unreadable-preserved");

    storage.value = payload([{ code: "kenobi", completedAt: NOW.toISOString() }]);
    store.reloadFromStorage();

    assert.equal(store.getSnapshot().warning, null);
    // Et l'ecriture est de nouveau autorisee.
    store.setCompleted("blue", true);
    assert.equal(store.getSnapshot().warning, null);
    assert.deepEqual(
      JSON.parse(storage.value ?? "null").completedRooms.map((r: { code: string }) => r.code),
      ["kenobi", "blue"],
    );
  });
});

describe("export", () => {
  it("produit un JSON date, versionne et sans metadonnees du catalogue", () => {
    const json = createProgressionExport(
      [{ code: "picklerick", completedAt: "2026-09-13T12:34:56.789Z" }],
      new Date("2026-09-13T13:00:00.000Z"),
    );

    assert.deepEqual(JSON.parse(json), {
      version: 1,
      exportedAt: "2026-09-13T13:00:00.000Z",
      completedRooms: [{ code: "picklerick", completedAt: "2026-09-13T12:34:56.789Z" }],
    });
    assert.equal(json.endsWith("\n"), true);
  });
});

describe("resume des rooms terminees", () => {
  it("compte une room une seule fois et conserve les durees des evenements", () => {
    const summary = summarizeCompletedRooms([
      { code: "advent", durationMinutes: 1_440 },
      { code: "room-a", durationMinutes: 30 },
      { code: "room-b", durationMinutes: 30 },
      { code: "advent", durationMinutes: 1_440 },
    ]);

    assert.deepEqual(summary, {
      roomCount: 3,
      totalMinutes: 1_500,
      unknownDurationCount: 0,
    });
  });

  it("signale les durees inconnues sans les inventer", () => {
    assert.deepEqual(summarizeCompletedRooms([{ code: "sans-duree", durationMinutes: null }]), {
      roomCount: 1,
      totalMinutes: 0,
      unknownDurationCount: 1,
    });
  });
});
