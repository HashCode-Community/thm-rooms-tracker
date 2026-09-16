import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyser, estAffichable, formesTrouvees, sansCommentaires } from "../scripts/accents.js";

/**
 * Le controleur d'accents, exerce sur des sources fabriquees.
 *
 * Les deux premiers tests sont les deux formes que la passe d'accentuation
 * avait reellement laissees passer : un paragraphe JSX reparti sur plusieurs
 * lignes, et un message qui ne s'affiche que quand l'API tombe. Un garde ecrit
 * apres coup doit d'abord prouver qu'il attrape ce qui lui a echappe.
 */

describe("controleur d'accents", () => {
  it("attrape un paragraphe JSX reparti sur plusieurs lignes", () => {
    const source = `
      export function Vue() {
        return (
          <p className="petit doux">
            Les parcours sont un contenu editorial, ecrit et relu a la main.
          </p>
        );
      }
    `;
    const signalements = analyser(source);
    assert.equal(signalements.length, 1);
    assert.deepEqual(signalements[0]?.formes, ["editorial", "ecrit"]);
  });

  it("attrape un message d'erreur, qui ne s'affiche qu'en panne", () => {
    const source = `const message = "L'API ne repond pas. Elle est peut-etre arretee.";`;
    assert.deepEqual(analyser(source)[0]?.formes, ["repond", "etre", "arretee"]);
  });

  it("ne signale rien quand tout est accentue", () => {
    const source = `
      <p>Les parcours sont un contenu éditorial, écrit et relu à la main.</p>
    `;
    assert.deepEqual(analyser(source), []);
  });

  it("ignore les commentaires, ecrits sans accents par convention", () => {
    const source = `
      /* Ce commentaire parle de donnees publiees, et ne doit rien declencher. */
      // Celui-ci aussi : une requete deja verifiee.
      const x = 1;
    `;
    assert.deepEqual(analyser(source), []);
    assert.ok(!sansCommentaires(source).includes("publiees"));
  });

  it("ignore les identifiants interpoles", () => {
    // `${etape.title}` porte un identifiant, pas du texte affiche.
    assert.deepEqual(formesTrouvees("suite : ${etape.title}"), []);
    assert.deepEqual(formesTrouvees("suite : etape"), []);
  });

  it("ignore les noms de classe et les chemins", () => {
    assert.equal(estAffichable("etat etat--erreur"), false);
    assert.equal(estAffichable("badge badge--equipe"), false);
    assert.equal(estAffichable("../theme.js"), false);
    assert.equal(estAffichable("Aucun parcours publie"), true);
  });

  it("distingue le mot du prefixe : « memento » n'est pas « meme »", () => {
    assert.deepEqual(formesTrouvees("un memento des acces"), ["acces"]);
  });
});
