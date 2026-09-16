import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDuration, formatUsers } from "../src/components/badges.js";

/**
 * Formats d'affichage.
 *
 * Quinze appels dans l'interface, aucun test jusqu'ici. Ce sont des regles de
 * lecture, pas de la mise en forme : le seuil de bascule en heures decide de ce
 * que l'utilisateur arrive a comparer d'un coup d'oeil.
 */

describe("duree", () => {
  it("une absence n'est pas zero", () => {
    // `null` veut dire « TryHackMe ne publie pas cette duree ». Ecrire « 0 min »
    // affirmerait que la room se fait instantanement.
    assert.equal(formatDuration(null), "durée inconnue");
    assert.equal(formatDuration(0), "0 min");
  });

  it("reste en minutes jusqu'a deux heures incluses", () => {
    assert.equal(formatDuration(10), "10 min");
    assert.equal(formatDuration(45), "45 min");
    // Le cas qui justifie le seuil : 90 se compare sans effort a 45 et a 2 h.
    assert.equal(formatDuration(90), "90 min");
    assert.equal(formatDuration(120), "120 min");
  });

  it("passe en heures AU-DELA de deux heures", () => {
    assert.equal(formatDuration(121), "2 h 01");
    assert.equal(formatDuration(150), "2 h 30");
    assert.equal(formatDuration(180), "3 h");
  });

  it("garde deux chiffres aux minutes, pour que la colonne s'aligne", () => {
    assert.equal(formatDuration(125), "2 h 05");
    assert.equal(formatDuration(660), "11 h");
  });

  it("tient sur le cumul du catalogue entier", () => {
    // 53 426 minutes : le chiffre qui a motive la regle.
    assert.equal(formatDuration(53426), "890 h 26");
  });
});

describe("participants", () => {
  it("separe les milliers sans notation abregee", () => {
    // « 1,9 M » demande une conversion mentale ; le chiffre exact n'en demande
    // aucune, et il tient dans la largeur disponible.
    assert.match(formatUsers(1949866), /1\s?949\s?866/);
  });
});
