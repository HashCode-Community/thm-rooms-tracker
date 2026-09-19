import {
  computeTrackProgress,
  nextStepPosition,
  type TrackRoom,
  type TrackStep,
} from "@thm/shared";
import { describe, expect, it } from "vitest";

/**
 * Progression des parcours.
 *
 * Tourne SANS base de donnees : `computeTrackProgress` est une fonction pure, et
 * c'est deliberement une fonction pure — le front en aura besoin sur des donnees
 * de `localStorage` (phase 8a), le serveur sur `user_room_progress` plus tard.
 * Une seule definition de la regle, des deux cotes.
 */

function room(code: string, requirement: TrackRoom["requirement"] = "core"): TrackRoom {
  return {
    code,
    title: code,
    difficulty: { key: "easy", label: "Facile", level: 1 },
    type: { key: "walkthrough", label: "Guide" },
    durationMinutes: 30,
    requirement,
    note: null,
  };
}

function step(position: number, rooms: TrackRoom[]): TrackStep {
  return { position, title: `Etape ${position}`, objective: null, estimatedMinutes: null, rooms };
}

describe("le denominateur ne compte que les rooms `core`", () => {
  it("une room `optional` terminee ne gonfle pas le pourcentage", () => {
    const steps = [step(1, [room("a"), room("b"), room("c", "optional")])];

    expect(computeTrackProgress(steps, new Set(["c"]))).toMatchObject({
      coreTotal: 2,
      coreDone: 0,
      percent: 0,
    });
  });

  it("une room `bonus` non plus", () => {
    const steps = [step(1, [room("a"), room("z", "bonus")])];
    expect(computeTrackProgress(steps, new Set(["z"])).percent).toBe(0);
    expect(computeTrackProgress(steps, new Set(["a"])).percent).toBe(100);
  });

  it("terminer toutes les `core` donne 100 %, meme sans les optionnelles", () => {
    const steps = [
      step(1, [room("a"), room("b", "optional")]),
      step(2, [room("c"), room("d", "bonus")]),
    ];
    expect(computeTrackProgress(steps, new Set(["a", "c"])).percent).toBe(100);
  });

  it("une etape n'est complete que si TOUTES ses `core` le sont", () => {
    const steps = [step(1, [room("a"), room("b")])];
    expect(computeTrackProgress(steps, new Set(["a"])).steps[0]?.complete).toBe(false);
    expect(computeTrackProgress(steps, new Set(["a", "b"])).steps[0]?.complete).toBe(true);
  });

  it("arrondit le pourcentage a l'entier", () => {
    const steps = [step(1, [room("a"), room("b"), room("c")])];
    expect(computeTrackProgress(steps, new Set(["a"])).percent).toBe(33);
    expect(computeTrackProgress(steps, new Set(["a", "b"])).percent).toBe(67);
  });
});

/**
 * LE CAS QUI CASSE SILENCIEUSEMENT.
 *
 * `cyberkillchainzmt` apparait dans DEUX parcours : Fondamentaux etape 6, et Blue
 * Team etape 2. C'est voulu, et c'est le seul cas du contenu editorial actuel.
 *
 * Consequence : la progression se compte par CODE DE ROOM, jamais par couple
 * (etape, room). Quelqu'un qui termine Cyber Kill Chain dans Fondamentaux doit la
 * voir deja cochee en arrivant dans Blue Team.
 *
 * Si la progression etait scopee a l'etape, 60 rooms sur 61 se comporteraient
 * correctement et personne ne remarquerait rien.
 */
describe("une room partagee entre deux parcours ne se termine qu'une fois", () => {
  const PARTAGEE = "cyberkillchainzmt";

  const fondamentaux = [
    step(5, [room("autre-room-etape-5")]),
    step(6, [room(PARTAGEE), room("compagnon")]),
  ];
  const blueTeam = [step(1, [room("intro-blue")]), step(2, [room(PARTAGEE), room("autre-blue")])];

  it("terminee dans un parcours, elle compte dans l'autre", () => {
    const termine = new Set([PARTAGEE]);

    expect(computeTrackProgress(fondamentaux, termine).coreDone).toBe(1);
    expect(computeTrackProgress(blueTeam, termine).coreDone).toBe(1);
  });

  it("l'etape qui la contient avance dans les DEUX parcours", () => {
    const termine = new Set([PARTAGEE]);

    const etapeFondamentaux = computeTrackProgress(fondamentaux, termine).steps.find(
      (entry) => entry.position === 6,
    );
    const etapeBlue = computeTrackProgress(blueTeam, termine).steps.find(
      (entry) => entry.position === 2,
    );

    expect(etapeFondamentaux).toMatchObject({ coreTotal: 2, coreDone: 1, complete: false });
    expect(etapeBlue).toMatchObject({ coreTotal: 2, coreDone: 1, complete: false });
  });

  it("l'entree est un ensemble de CODES, pas de couples etape-room", () => {
    // Formulation directe de l'invariant : la fonction ne recoit aucune notion
    // d'etape dans son second argument. Impossible d'y scoper quoi que ce soit.
    const termine = new Set([PARTAGEE, "compagnon"]);
    expect(computeTrackProgress(fondamentaux, termine).steps).toContainEqual({
      position: 6,
      coreTotal: 2,
      coreDone: 2,
      complete: true,
    });
  });
});

describe("cas limites", () => {
  it("un parcours sans room `core` vaut 100 %, pas une division par zero", () => {
    const steps = [step(1, [room("a", "optional")])];
    expect(computeTrackProgress(steps, new Set()).percent).toBe(100);
  });

  it("un parcours sans etape vaut 100 %", () => {
    expect(computeTrackProgress([], new Set()).percent).toBe(100);
  });

  it("un code termine qui n'appartient pas au parcours est ignore", () => {
    const steps = [step(1, [room("a")])];
    expect(computeTrackProgress(steps, new Set(["inconnue", "a"])).coreDone).toBe(1);
  });

  it("la comparaison des codes est SENSIBLE A LA CASSE", () => {
    // Meme regle que partout ailleurs (ADR-0001 Q1). Replier ici ferait diverger
    // la progression de l'identite reelle de la room.
    const steps = [step(1, [room("AIforcyber-aoc2025-y9wWQ1zRgB")])];
    expect(computeTrackProgress(steps, new Set(["aiforcyber-aoc2025-y9wwq1zrgb"])).coreDone).toBe(
      0,
    );
    expect(computeTrackProgress(steps, new Set(["AIforcyber-aoc2025-y9wWQ1zRgB"])).coreDone).toBe(
      1,
    );
  });
});

describe("la prochaine etape est la variable visuelle principale", () => {
  const parcours = [step(1, [room("a"), room("b")]), step(2, [room("c")]), step(3, [room("d")])];

  it("designe la premiere etape non terminee", () => {
    const progress = computeTrackProgress(parcours, new Set(["a", "b"]));
    expect(nextStepPosition(progress)).toBe(2);
  });

  it("une etape ENTAMEE mais pas finie reste la prochaine", () => {
    // Le contraire donnerait « prochaine : etape 2 » alors qu'il reste une room
    // a faire a l'etape 1 : l'utilisateur sauterait ce qu'il a commence.
    const progress = computeTrackProgress(parcours, new Set(["a"]));
    expect(nextStepPosition(progress)).toBe(1);
  });

  it("vaut la premiere etape quand rien n'est commence", () => {
    expect(nextStepPosition(computeTrackProgress(parcours, new Set()))).toBe(1);
  });

  it("vaut `null` quand tout est termine", () => {
    const progress = computeTrackProgress(parcours, new Set(["a", "b", "c", "d"]));
    expect(nextStepPosition(progress)).toBeNull();
  });

  it("SAUTE une etape sans aucune room recommandee", () => {
    // `complete` vaut faux pour une telle etape, par definition. La retenir
    // comme prochaine arreterait le parcours sur une etape ou l'utilisateur ne
    // peut rien cocher : il n'en sortirait jamais.
    const avecEtapeVide = [
      step(1, [room("a")]),
      step(2, [room("lecture", "optional")]),
      step(3, [room("b")]),
    ];
    const progress = computeTrackProgress(avecEtapeVide, new Set(["a"]));

    expect(progress.steps[1]?.complete).toBe(false);
    expect(nextStepPosition(progress)).toBe(3);
  });

  it("l'ordre des etapes fait foi, pas leur ordre d'arrivee", () => {
    const desordre = [step(3, [room("d")]), step(1, [room("a")]), step(2, [room("c")])];
    const progress = computeTrackProgress(desordre, new Set(["d"]));
    // `computeTrackProgress` conserve l'ordre recu : la premiere non terminee
    // de CETTE liste est l'etape 1. C'est a l'appelant de fournir les etapes
    // triees, ce que fait l'API.
    expect(nextStepPosition(progress)).toBe(1);
  });
});
