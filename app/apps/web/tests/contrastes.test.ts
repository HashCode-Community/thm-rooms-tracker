import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Reglages } from "../scripts/contrastes.js";
import {
  analyser,
  clartePercue,
  parseHex,
  ratio,
  trouverLitteraux,
} from "../scripts/contrastes.js";

/**
 * Le controleur de contraste, exerce sur des feuilles fabriquees.
 *
 * Un garde qu'on ne peut eprouver qu'en cassant le depot reel ne s'eprouve
 * jamais : on le casse une fois, a la main, le jour ou on l'ecrit, et plus
 * jamais ensuite. Ces tests lui donnent des feuilles construites pour le faire
 * tomber, et exigent qu'il tombe.
 */

const FEUILLE_SAINE = `
:root {
  --fond: #0f1115;
  --texte: #e6e8eb;
  --marque: #626c80;
  --facile: #93e6b1;
  --dur: #fb7f71;
}

.titre {
  color: var(--texte);
  background: var(--fond);
}
`;

const REGLAGES: Reglages = {
  paires: [{ contexte: "texte sur la page", premierPlan: "--texte", arrierePlan: "--fond" }],
  couleursExternes: [],
  surCouleursExternes: "--texte",
  rampe: ["--facile", "--dur"],
  marques: [],
  seuilTexte: 4.5,
  seuilGrand: 3,
  seuilGris: 8,
};

describe("mesure de la couleur", () => {
  it("calcule le ratio WCAG dans les deux sens", () => {
    const blanc = parseHex("#ffffff");
    const noir = parseHex("#000000");
    assert.equal(ratio(blanc, noir).toFixed(0), "21");
    assert.equal(ratio(noir, blanc).toFixed(0), "21");
  });

  it("lit les formes courtes et longues", () => {
    assert.deepEqual(parseHex("#fff"), parseHex("#ffffff"));
  });

  it("la clarte percue ordonne comme l'oeil, pas comme la somme des canaux", () => {
    // Un jaune vif et un bleu vif ont des sommes de canaux proches et des
    // clartes tres eloignees. C'est exactement ce qu'un rendu en niveaux de
    // gris conserve.
    assert.ok(clartePercue(parseHex("#f0b01b")) > clartePercue(parseHex("#1b5e9e")));
  });
});

describe("le controleur tombe quand il doit", () => {
  it("accepte une feuille saine", () => {
    const rapport = analyser(FEUILLE_SAINE, REGLAGES);
    assert.deepEqual([...rapport.echecs], []);
  });

  it("refuse un contraste sous le seuil", () => {
    const abimee = FEUILLE_SAINE.replace("--texte: #e6e8eb;", "--texte: #3a4048;");
    const rapport = analyser(abimee, REGLAGES);

    assert.equal(rapport.echecs.length, 1);
    assert.match(rapport.echecs[0] ?? "", /texte sur la page/);
    assert.match(rapport.echecs[0] ?? "", /seuil 4\.5/);
  });

  /**
   * LA REGRESSION DU LIEN D'EVITEMENT.
   *
   * Le passage au theme sombre a revele que le premier element focalisable de
   * chaque page peignait `#fff` sur `var(--texte)` : invisible au clavier des
   * que `--texte` est devenu clair. Deux ecritures possibles de la meme faute,
   * et le controleur doit attraper les deux.
   */
  it("attrape la faute par sa couleur ecrite en clair", () => {
    const abimee = `${FEUILLE_SAINE}
.lien-evitement {
  background: var(--texte);
  color: #fff;
}
`;
    const rapport = analyser(abimee, REGLAGES);
    assert.ok(rapport.echecs.some((e) => e.includes("#fff")));
  });

  it("attrape la meme faute ecrite en tokens, par la paire manquante", () => {
    // Ici aucun litteral : `--texte` est peint en FOND, et rien ne mesure ce
    // qui se pose dessus. Sans le controle des fonds, ca passerait.
    const abimee = `${FEUILLE_SAINE}
.lien-evitement {
  background: var(--texte);
  color: var(--fond);
}
`;
    const rapport = analyser(abimee, REGLAGES);
    assert.ok(rapport.echecs.some((e) => e.includes("--texte") && e.includes("fond")));
  });

  it("refuse une rampe qui cesse d'etre monotone", () => {
    const inversee = FEUILLE_SAINE.replace("--facile: #93e6b1;", "--facile: #7a3f38;");
    const rapport = analyser(inversee, REGLAGES);
    assert.ok(rapport.echecs.some((e) => e.includes("monotone")));
  });

  it("refuse deux crans qui se confondent en niveaux de gris", () => {
    const rapprochee = FEUILLE_SAINE.replace("--facile: #93e6b1;", "--facile: #ff9e90;");
    const rapport = analyser(rapprochee, REGLAGES);
    assert.ok(rapport.echecs.some((e) => e.includes("niveaux de gris")));
  });

  it("refuse un token neuf que personne ne mesure", () => {
    const abimee = `${FEUILLE_SAINE}
.surprise {
  color: var(--marque);
}
`;
    const rapport = analyser(abimee, REGLAGES);
    assert.ok(rapport.echecs.some((e) => e.includes("--marque")));
  });
});

describe("couleurs ecrites en clair", () => {
  it("trouve toutes les formes d'ecriture", () => {
    const trouves = trouverLitteraux([
      {
        chemin: "faux.tsx",
        contenu: [
          'const a = { color: "#fff" };',
          'const b = { color: "white" };',
          'const c = { color: "rgb(1,2,3)" };',
          'const d = { color: "hsla(1,2%,3%,0.5)" };',
          'const e = { color: "#0a0b0c" };',
        ].join("\n"),
      },
    ]);
    assert.equal(trouves.length, 5);
  });

  it("ne confond pas `white-space` avec la couleur blanche", () => {
    const trouves = trouverLitteraux([
      { chemin: "faux.css", contenu: ".x { white-space: nowrap; }\n.y { color: black-ish; }" },
    ]);
    assert.deepEqual(trouves, []);
  });

  it("laisse passer la prose des commentaires", () => {
    // L'en-tete de la feuille explique POURQUOI on n'emploie ni #000 ni #fff.
    // Interdire la couleur dans un commentaire interdirait d'expliquer la regle.
    const trouves = trouverLitteraux([
      { chemin: "faux.css", contenu: "/* ni #000 ni #fff, voir ADR-0005 */\n.x { color: red; }" },
    ]);
    assert.deepEqual(trouves, []);
  });

  it("autorise le bloc de tokens, et lui seul", () => {
    const trouves = trouverLitteraux([
      {
        chemin: "faux.css",
        contenu: ":root {\n  --fond: #0f1115;\n}\n\n.x {\n  color: #abcdef;\n}",
      },
    ]);
    assert.deepEqual(
      trouves.map((t) => t.texte),
      ["#abcdef"],
    );
  });
});
