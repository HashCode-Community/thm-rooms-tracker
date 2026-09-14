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

  it("garde l'etat en memoire et avertit au premier echec d'ecriture", () => {
    const storage = new FakeStorage();
    storage.throwOnWrite = true;
    const store = createProgressionStore(
      () => storage,
      () => NOW,
    );

    assert.equal(store.getSnapshot().warning, null);
    store.setCompleted("picklerick", true);

    assert.equal(store.isCompleted("picklerick"), true);
    assert.equal(store.getSnapshot().warning, "write-failed");
    assert.equal(storage.writes, 1);

    store.dismissWarning();
    store.setCompleted("csrfV2", true);

    assert.equal(store.isCompleted("csrfV2"), true);
    assert.equal(store.getSnapshot().warning, null);
    assert.equal(storage.writes, 1);
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
